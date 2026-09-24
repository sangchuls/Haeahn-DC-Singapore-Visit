const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const alerts=[],opened=[];
const context=vm.createContext({Intl,Date,console,setTimeout,clearTimeout,document:{addEventListener(){},getElementById(){return null;}},navigator:{},window:{open(...args){opened.push(args);}},location:{protocol:'file:'},alert:s=>alerts.push(s)});
scripts.forEach(s=>new vm.Script(s));
vm.runInContext(scripts.at(-1),context);
const evaluate=s=>vm.runInContext(s,context);
const fa=evaluate('FieldAssistant');
test('all six dates and stable source data are available',()=>{
  assert.equal(new Set(fa.schedules().map(s=>s.WHEN.date)).size,6);
  assert.equal(evaluate("DAYS.find(d=>d.date==='9/29').items.find(i=>i.title.includes('Brightray')).time"),'14:00');
  assert.equal(evaluate("DAYS.find(d=>d.date==='10/2').items.find(i=>i.title.includes('SIN→ICN')).title"),'SQ606 출발 SIN→ICN');
});
test('KDCEA answers never present reference address as confirmed',()=>{
  for(const q of ['KDCEA 어디로 가?','Brightray 어떻게 가?','조호바루 어디야']){
    const a=fa.answer(q,new Date('2026-09-29T04:00:00Z'));
    assert.match(a,/참고 위치/);assert.match(a,/전용버스/);assert.match(a,/확정 안내 확인/);
  }
  const s=fa.schedules().find(s=>s.title.includes('Brightray'));
  assert.equal(s.metadata.verification_status,'unverified');assert.equal(s.WHERE.map_url,null);
});
test('all unsafe external navigation paths are blocked',()=>{
  for(const key of ['bus_mbs_jb','bus_jb_hotel','d4_airport'])evaluate(`openGoogleNav('${key}','bus');openGrab('${key}')`);
  evaluate("openGmapsDay(DAYS.findIndex(d=>d.date==='9/29'));openGmapsDay(DAYS.findIndex(d=>d.date==='10/2'))");
  assert.equal(opened.length,0);assert.equal(alerts.length,8);
  assert.doesNotMatch(evaluate("buildDetailHTML(DAYS.find(d=>d.date==='9/29').items.find(i=>i.title.includes('Brightray')))"),/maps\/search/);
});
test('Singapore date boundary, trip boundaries and Korean flight timezone',()=>{
  assert.equal(fa.timeline(new Date('2026-09-28T16:00:00Z')).today,'2026-09-29');
  assert.equal(fa.timeline(new Date('2026-09-24T00:00:00Z')).current,null);
  assert.equal(fa.timeline(new Date('2026-10-03T00:00:00Z')).next,null);
  const out=fa.schedules().find(s=>s.title.includes('ICN→SIN'));
  assert.equal(new Date(out.start).toISOString(),'2026-09-27T00:00:00.000Z');
  const back=fa.schedules().find(s=>s.title==='인천공항 T1 도착 · 해산');
  assert.equal(new Date(back.start).toISOString(),'2026-10-02T06:30:00.000Z');
});
test('today never silently becomes selected preview date',()=>{
  assert.match(fa.answer('오늘 일정 알려줘',new Date('2026-09-24T00:00:00Z')),/등록된 출장 일정이 없습니다/);
  assert.match(fa.answer('내일 일정 알려줘',new Date('2026-09-28T05:00:00Z')),/2026-09-29/);
});
test('flight summary stays provisional and correct per traveller',()=>{
  const a=fa.answer('임상철 비행기 좌석',new Date());
  assert.match(a,/PDF 확인 전/);assert.match(a,/SQ600/);assert.match(a,/66G/);assert.match(a,/64G/);assert.match(a,/25kg/);
});
test('Monday selection maps to active route without altering itinerary',()=>{
  evaluate("curRoute='B'");
  const list=fa.schedules().filter(s=>s.WHEN.date==='2026-09-28');
  assert.ok(list.length>0);assert.ok(list.every(s=>s.id.includes('-B-')));
  assert.equal(list[0].title,evaluate("DAYS.find(d=>d.monday).routes.find(r=>r.id==='B').spots[0].name"));
  evaluate("curRoute='A'");
});
test('schema contains requested domains and no invented contact',()=>{
  const s=fa.schedules()[0];
  for(const k of ['WHEN','WHERE','HOW','ARRIVAL','WHAT','ACTION','PEOPLE','MATERIAL','NEXT','NOTE','metadata'])assert.ok(s[k]);
  assert.equal(s.ARRIVAL.contact_person,null);assert.equal(s.WHEN.end_time,null);
  assert.equal(Object.keys(fa.checks).length,7);
});
test('model fallback receives safety context before long scenario material',()=>{
  const text=evaluate('buildDayContext(3)');assert.match(text.slice(0,1000),/참고용/);assert.match(text.slice(0,1000),/PDF 미첨부/);
});

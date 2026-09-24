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
  assert.equal(evaluate("DAYS.find(d=>d.date==='10/2').items.find(i=>i.title.includes('SIN→ICN')).title"),'SQ600 출발 SIN→ICN');
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
  for(const key of ['bus_mbs_jb','bus_jb_hotel'])evaluate(`openGoogleNav('${key}','bus');openGrab('${key}')`);
  evaluate("openGmapsDay(DAYS.findIndex(d=>d.date==='9/29'));openGmapsDay(DAYS.findIndex(d=>d.date==='10/2'))");
  assert.equal(opened.length,0);assert.equal(alerts.length,6);
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
  for(const q of ['10월 2일 일정 알려줘','10/2 일정','2026-10-02 일정'])assert.match(fa.answer(q,new Date()),/SQ600/);
  assert.match(fa.answer('2027-10-02 일정',new Date()),/등록된 출장 일정이 없습니다/);
});
test('flight summary uses verified tickets and leaves blank terminal unknown',()=>{
  const a=fa.answer('임상철 비행기 좌석',new Date());
  assert.match(a,/PDF 4명분 대조 완료/);assert.match(a,/verified/);assert.match(a,/SQ600/);assert.match(a,/66G/);assert.match(a,/64G/);assert.match(a,/25kg/);assert.match(a,/도착 터미널 미기재/);
  assert.doesNotMatch(a,/PDF 확인 전|manual input|SQ606/);
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
  const text=evaluate('buildDayContext(3)');assert.match(text.slice(0,1000),/참고용/);assert.match(text.slice(0,1000),/PDF 4명분 대조 완료/);
});
test('all four seats and baggage allowances match source tickets',()=>{
  const expected=[['김상범','18A','20K','출국 40kg / 귀국 40kg'],['정재수','64D','66D','출국 25kg / 귀국 30kg'],['임상철','66G','64G','출국 25kg / 귀국 30kg'],['류환재','67D','63G','출국 25kg / 귀국 30kg']];
  assert.equal(fa.flights.metadata.source,'e-ticket');assert.equal(fa.flights.metadata.verification_status,'verified');
  for(const [name,out,back,baggage] of expected){const p=fa.people.find(p=>p.name===name);assert.equal(p.out,out);assert.equal(p.back,back);assert.equal(p.baggage,baggage);}
  assert.equal(fa.flights.outbound.arrival_terminal,null);
  assert.equal(fa.flights.outbound.arrival_terminal_metadata.verification_status,'unverified');
  assert.equal(fa.flights.inbound.departure_terminal,'2');assert.equal(fa.flights.inbound.arrival_terminal,'1');
});
test('return navigation resolves T2 by name and never reuses T3 coordinates',()=>{
  evaluate("openGoogleNav('d4_airport','grab')");
  const url=new URL(opened.at(-1)[0]);assert.equal(url.searchParams.get('destination'),'Singapore Changi Airport Terminal 2 Departure Hall');
  assert.equal(evaluate('TR.d4_airport[0].to'),null);
  const s=fa.schedules().find(s=>s.title.includes('SIN→ICN'));
  assert.equal(s.WHERE.latitude,null);assert.equal(s.WHERE.terminal,'2');
  assert.equal(s.metadata.fields['WHERE.terminal'].verification_status,'verified');
  assert.equal(s.metadata.fields['WHERE.latitude'].verification_status,'unverified');
  assert.equal(s.metadata.fields['WHEN.start_time'].source,'e-ticket');
  const hotel=fa.schedules().find(s=>s.title==='호텔 출발 → 창이공항 T2');
  assert.equal(hotel.metadata.fields['WHEN.start_time'].verification_status,'provisional');
  evaluate("openGoogleNav('d0_arrive','grab')");assert.equal(new URL(opened.at(-1)[0]).searchParams.has('origin'),false);
});
test('old return flight, baggage and terminal-specific arrival copy are removed',()=>{
  assert.doesNotMatch(html,/SQ606|23kg|T3 Row|T3 출구|Terminal 3 Departure/);
  const arrival=evaluate("DAYS.find(d=>d.date==='9/27').items.find(i=>i.title.includes('창이공항 도착'))");
  assert.equal(arrival.map_pin_usage,'reference_only');assert.match(arrival.verification_note,/공란/);
  assert.equal(evaluate('TR.d0_arrive[0].from'),null);
});

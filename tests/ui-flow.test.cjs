// DOM contract tests only: these do not replace real mobile layout/voice testing.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(extraWindow={},storage=new Map()){
  const nodes=[],listeners=[];
  class Element {
    constructor(tag){this.tagName=tag;this.children=[];this.style={};this.events={};this.value='';this.textContent='';nodes.push(this);}
    appendChild(child){this.children.push(child);return child;}
    replaceChildren(...children){this.children=children;}
    setAttribute(k,v){this[k]=v;}
    addEventListener(k,fn){this.events[k]=fn;}
    showModal(){this.open=true;}
    close(){this.open=false;this.events.close?.();}
    focus(){}
  }
  const document={head:new Element('head'),body:new Element('body'),addEventListener:(event,fn)=>listeners.push(fn),createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text}),getElementById:id=>nodes.find(n=>n.id===id),activeElement:null};
  const context=vm.createContext({Date,Intl,console,document,navigator:{onLine:false},location:{protocol:'file:'},window:{crypto:require('node:crypto').webcrypto,...extraWindow},TextEncoder,TextDecoder,btoa,atob,Uint8Array,SpeechSynthesisUtterance:class {constructor(text){this.text=text;}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setInterval(){},setTimeout,clearTimeout,AbortController,AbortSignal,alert(){}});
  const script=[...fs.readFileSync('index.html','utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1];
  vm.runInContext(script,context);
  listeners.at(-1)();
  return {context,storage,vault:vm.runInContext('PersonalAI',context),get:id=>document.getElementById(id),button:text=>nodes.find(n=>n.tagName==='button'&&n.textContent===text)};
}
test('assistant initializes without speech support, opens, answers and saves notes',async()=>{
  const ui=setup();assert.equal(ui.button('음성 입력 미지원').disabled,true);
  ui.get('fa-launch').onclick();assert.equal(ui.get('fa-panel').open,true);
  ui.get('fa-question').value='KDCEA 어디로 가?';await ui.get('fa-send').onclick();assert.match(ui.get('fa-answer').textContent,/참고 위치/);
  const select=ui.get('fa-schedule');select.value='2026-09-29-3';select.onchange();
  ui.get('fa-note').value='냉각 설명 추가 요청';ui.button('이 기기에 메모 저장').onclick();assert.equal(ui.storage.get('sg_field_note_2026-09-29-3'),'냉각 설명 추가 요청');
  ui.get('fa-question').value='처음 보는 복잡한 요청';await ui.get('fa-send').onclick();assert.match(ui.get('fa-answer').textContent,/오프라인/);
  assert.equal(ui.get('fa-send').disabled,false);
  ui.button('닫기').onclick();assert.equal(ui.get('fa-panel').open,false);
});
test('failed model request restores controls and offers local questions',async()=>{
  const ui=setup();ui.context.navigator.onLine=true;ui.context.location.protocol='https:';
  ui.get('fa-launch').onclick();
  await ui.vault.save('test-key-not-real-123');
  ui.context.fetch=async()=>({ok:false,json:async()=>({code:'UPSTREAM_ERROR'})});
  ui.get('fa-question').value='처음 보는 복잡한 요청';await ui.get('fa-send').onclick();
  assert.match(ui.get('fa-answer').textContent,/연결이 원활하지 않습니다/);assert.equal(ui.get('fa-send').disabled,false);
});
test('chat keeps alternating bubbles and sends conversation history',async()=>{
  assert.doesNotMatch(fs.readFileSync('index.html','utf8'),/FieldAssistant\.overview\(|fa-overview/);
  const ui=setup();ui.get('fa-launch').onclick();
  assert.equal(ui.get('fa-options').open,undefined);
  assert.equal(ui.get('fa-overview'),undefined);
  ui.get('fa-question').value='KDCEA 어디야';await ui.get('fa-send').onclick();
  assert.equal(ui.get('fa-question').value,'');
  assert.equal(ui.get('fa-messages').children.length,3);
  assert.equal(ui.get('fa-messages').children[1].className,'fa-message fa-user');
  ui.context.navigator.onLine=true;ui.context.location.protocol='https:';let body;
  await ui.vault.save('test-key-not-real-123');
  ui.context.fetch=async(url,args)=>{body=JSON.parse(args.body);return {ok:true,json:async()=>({answer:'확정 안내를 확인해주세요.'})};};
  ui.get('fa-question').value='좀 더 자세히 설명해줘';await ui.get('fa-send').onclick();
  assert.equal(body.history[0].content,'KDCEA 어디야');assert.equal(body.history[1].role,'assistant');
  assert.equal(ui.get('fa-messages').children.length,5);
});
test('voice conversation reads answers, resumes listening and stops on close',async()=>{
  const sessions=[],spoken=[];
  class Recognition{
    constructor(){sessions.push(this);}
    start(){this.onstart?.();}
    stop(){}
    abort(){this.onend?.();}
  }
  const ui=setup({SpeechRecognition:Recognition,speechSynthesis:{cancel(){},speak(u){spoken.push(u);}}});
  ui.get('fa-launch').onclick();ui.get('fa-mic').onclick();
  assert.equal(sessions.length,1);assert.equal(ui.get('fa-mic')['aria-pressed'],'true');
  const speech=[{transcript:'KDCEA 어디로 가'}];speech.isFinal=true;
  sessions[0].onresult({resultIndex:0,results:[speech]});
  assert.equal(spoken.length,1);assert.match(spoken[0].text,/참고 위치/);
  spoken[0].onend();assert.equal(sessions.length,2);
  ui.button('닫기').onclick();assert.equal(ui.get('fa-mic')['aria-pressed'],'false');
  sessions[1].onend();assert.equal(sessions.length,2);
});
test('microphone permission denial stops the voice session cleanly',()=>{
  let r;class Recognition{constructor(){r=this;}start(){}abort(){this.onend?.();}}
  const ui=setup({SpeechRecognition:Recognition});ui.get('fa-launch').onclick();ui.get('fa-mic').onclick();
  r.onerror({error:'not-allowed'});assert.match(ui.get('fa-status').textContent,/권한/);assert.equal(ui.get('fa-mic')['aria-pressed'],'false');
});
test('saved provider keys are ready after reload and can be deleted separately',()=>{
  const ui=setup();ui.vault.save('dummy-gemini-secret-123');
  ui.vault.select('openai');ui.vault.save('dummy-openai-secret-123');
  const fresh=setup({},ui.storage);
  assert.equal(fresh.vault.connection().provider,'openai');
  assert.equal(fresh.vault.connection().key,'dummy-openai-secret-123');
  fresh.vault.remove();assert.equal(fresh.vault.connection(),null);
  fresh.vault.select('gemini');assert.equal(fresh.vault.connection().key,'dummy-gemini-secret-123');
  assert.equal(fresh.get('fa-key-password'),undefined);assert.equal(fresh.get('fa-ai-profile'),undefined);
});

test('saving a key alone makes no paid request',async()=>{
  const ui=setup();ui.get('fa-launch').onclick();let calls=0;
  ui.context.fetch=async()=>{calls++;throw new Error('Save must not call API');};
  ui.get('fa-api-key').value='dummy-saved-key-123';await ui.button('저장').onclick();
  assert.equal(calls,0);assert.equal(ui.vault.connection().key,'dummy-saved-key-123');
  assert.equal(ui.get('fa-api-key').value,'');assert.equal(ui.get('fa-ai-settings').open,false);
});

test('saving after a question automatically answers it once',async()=>{
  const ui=setup();ui.context.navigator.onLine=true;ui.context.location.protocol='https:';ui.get('fa-launch').onclick();let calls=0,body;
  ui.context.fetch=async(url,args)=>{calls++;body=JSON.parse(args.body);return {ok:true,json:async()=>({answer:'답변입니다.'})};};
  ui.get('fa-question').value='출장 준비를 자세히 설명해줘';await ui.get('fa-send').onclick();assert.equal(calls,0);
  ui.get('fa-api-key').value='dummy-saved-key-123';await ui.button('저장').onclick();
  assert.equal(calls,1);assert.equal(body.question,'출장 준비를 자세히 설명해줘');
  assert.equal(ui.get('fa-answer').textContent,'답변입니다.');
  assert.equal(ui.get('fa-messages').children.filter(n=>n.className==='fa-message fa-user').length,1);
});

test('missing key opens settings instead of making a doomed API request',async()=>{
  const ui=setup();ui.context.navigator.onLine=true;ui.context.location.protocol='https:';ui.get('fa-launch').onclick();
  ui.context.fetch=async()=>{throw new Error('Must not fetch without key');};
  ui.get('fa-question').value='좀 더 자세한 설명 부탁해';await ui.get('fa-send').onclick();
  assert.match(ui.get('fa-answer').textContent,/API 키/);assert.equal(ui.get('fa-ai-settings').open,true);
});
test('specific date questions work online without any key and headers never enter history',async()=>{
  const ui=setup();ui.context.navigator.onLine=true;ui.context.location.protocol='https:';ui.get('fa-launch').onclick();
  ui.context.fetch=async()=>{throw new Error('Date lookup must be local');};
  ui.get('fa-question').value='10월 2일 일정을 알려줘';await ui.get('fa-send').onclick();assert.match(ui.get('fa-answer').textContent,/SQ600/);
  await ui.vault.save('dummy-private-key-value');let request;
  ui.context.fetch=async(url,args)=>{request=args;return {ok:true,json:async()=>({answer:'확인 필요합니다.'})};};
  ui.get('fa-question').value='좀 더 설명 부탁해';await ui.get('fa-send').onclick();
  assert.equal(request.headers['x-ai-key'],'dummy-private-key-value');assert.doesNotMatch(request.body,/dummy-private-key|private-pass/);
});

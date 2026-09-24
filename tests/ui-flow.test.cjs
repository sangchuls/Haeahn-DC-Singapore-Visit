// DOM contract tests only: these do not replace real mobile layout/voice testing.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(extraWindow={}){
  const nodes=[],listeners=[],storage=new Map();
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
  const context=vm.createContext({Date,Intl,console,document,navigator:{onLine:false},location:{protocol:'file:'},window:extraWindow,SpeechSynthesisUtterance:class {constructor(text){this.text=text;}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setInterval(){},setTimeout,clearTimeout,AbortController,alert(){}});
  const script=[...fs.readFileSync('index.html','utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1];
  vm.runInContext(script,context);
  listeners.at(-1)();
  return {context,storage,get:id=>document.getElementById(id),button:text=>nodes.find(n=>n.tagName==='button'&&n.textContent===text)};
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
  ui.context.fetch=async()=>({ok:false});
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

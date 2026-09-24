const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('api/claude.js','utf8');
const handlerPromise=import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')).then(m=>m.default);
function response(){return {statusCode:200,headers:{},status(n){this.statusCode=n;return this;},json(data){this.data=data;return this;},setHeader(k,v){this.headers[k]=v;}};}
test('API contract, grounded chat, scenario compatibility and failures',async()=>{
  const handler=await handlerPromise,oldKey=process.env.ANTHROPIC_API_KEY,oldFetch=global.fetch;
  try{
    let res=response();await handler({method:'GET'},res);assert.equal(res.statusCode,405);
    delete process.env.ANTHROPIC_API_KEY;res=response();await handler({method:'POST',body:{context:'test'}},res);assert.equal(res.statusCode,500);
    process.env.ANTHROPIC_API_KEY='test-placeholder-not-a-real-key';
    res=response();await handler({method:'POST',body:{context:'test',mode:'assistant',question:''}},res);assert.equal(res.statusCode,400);
    res=response();await handler({method:'POST',body:{context:'x'.repeat(40001)}},res);assert.equal(res.statusCode,400);
    let sent;
    global.fetch=async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({content:[{text:'목적지는 확정 안내 확인이 필요합니다.'}]})};};
    res=response();await handler({method:'POST',body:{mode:'assistant',question:'KDCEA?',context:'등록 자료'}},res);
    assert.equal(res.statusCode,200);assert.match(res.data.answer,/확정 안내/);assert.match(sent.system,/Jalan Digital 11/);assert.match(sent.system,/PDF/);assert.equal(res.headers['Cache-Control'],'no-store');
    global.fetch=async()=>({ok:true,json:async()=>({content:[{text:'{"scenarios":[{"dialogs":[{"side":"invalid","text":"hello"}]}]}'}]})});
    res=response();await handler({method:'POST',body:{context:'existing scenario'}},res);assert.equal(res.statusCode,200);assert.equal(res.data.scenarios[0].dialogs[0].side,'left');
    global.fetch=async()=>({ok:false,text:async()=>('sensitive-upstream-content')});
    res=response();await handler({method:'POST',body:{context:'test'}},res);assert.equal(res.statusCode,502);assert.doesNotMatch(JSON.stringify(res.data),/sensitive/);
    global.fetch=async()=>{throw new Error('secret-in-error');};res=response();await handler({method:'POST',body:{context:'test'}},res);assert.equal(res.statusCode,500);assert.doesNotMatch(JSON.stringify(res.data),/secret/);
  }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=oldKey;}
});

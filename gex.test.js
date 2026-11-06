import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
import {validateSnapshot,analyzeSnapshot} from './gex.mjs';
import {parseRows} from './public/gex-input.js';
import {createServer} from './server.mjs';
const now=Date.parse('2026-11-04T15:30:00Z');
const fixture=()=>({symbol:'SPY',spot:600,asOf:'2026-11-04T15:00:00Z',source:'Test fixture',scope:'0DTE',unit:'USD per 1% move',rows:[{strike:595,gex:-20},{strike:600,gex:30}]});
test('CSV and spreadsheet tabs parse; blank and malformed cells fail',()=>{
 assert.deepEqual(parseRows('strike,gex\n595,-20\n600,30'),fixture().rows);
 assert.deepEqual(parseRows('595\t-20\n600\t30'),fixture().rows);
 assert.throws(()=>parseRows('595,'));
 assert.throws(()=>parseRows('595,1,000'));
});
test('validation rejects duplicate strikes, missing values and future timestamps',()=>{
 for(const patch of [{spot:''},{rows:[{strike:600,gex:1},{strike:600,gex:2}]},{asOf:'2026-11-04T16:00:00Z'},{unit:'unknown'}])assert.throws(()=>validateSnapshot({...fixture(),...patch},now));
});
test('freshness uses observation time, including exact 30-minute boundary',()=>{
 const s=validateSnapshot(fixture(),now);
 assert.equal(analyzeSnapshot(s,null,now-1).stale,false);
 assert.equal(analyzeSnapshot(s,null,now).stale,true);
 assert.equal(analyzeSnapshot(s,null,now).total,10);
});
test('comparison refuses changed scope or units',()=>{
 const first=validateSnapshot(fixture(),now),second=validateSnapshot({...fixture(),rows:[{strike:595,gex:-10},{strike:600,gex:40}]},now);
 assert.equal(analyzeSnapshot(second,first,now).change,20);
 assert.equal(analyzeSnapshot({...second,scope:'all'},first,now).change,null);
});
test('API persists snapshots across restart, sorts by data time, and rejects cross-origin writes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hth-gex-'));
 let server,cookie;
 async function start(){server=createServer(pathToFileURL(dir+'/'));server.listen(0,'127.0.0.1');await once(server,'listening');return 'http://127.0.0.1:'+server.address().port;}
 async function stop(){await new Promise(resolve=>server.close(resolve));}
 try{
  let base=await start();
  const login=async(setup=false)=>{await fetch(base+'/api/account');const setupCode=await readFile(join(dir,'accounts/setup-code.txt'),'utf8');const r=await fetch(base+'/api/account/'+(setup?'setup':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@example.com',password:'test-password-12345',setupCode})});cookie=r.headers.get('set-cookie').split(';')[0];};
  await login(true);
  const post=(data,headers={})=>fetch(base+'/api/gex',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,...headers},body:JSON.stringify(data)});
  assert.equal((await post(fixture(),{Origin:'https://example.com'})).status,403);
  assert.equal((await post({...fixture(),spot:''})).status,400);
  assert.equal((await post(fixture())).status,201);
  assert.equal((await post({...fixture(),asOf:'2026-11-04T14:00:00Z'})).status,201);
  await stop();base=await start();await login();
  const history=await fetch(base+'/api/gex',{headers:{Cookie:cookie}}).then(r=>r.json());assert.equal(history.snapshots.length,2);
  const context=await fetch(base+'/api/gex/context?symbol=SPY',{headers:{Cookie:cookie}}).then(r=>r.json());assert.equal(context.snapshot.asOf,'2026-11-04T15:00:00.000Z');assert.equal(context.analysis.total,10);
  assert.equal((await fetch(base+'/data/gex/anything.json')).status,404);
 }finally{if(server?.listening)await stop();await rm(dir,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {validateImage,normalizeExtraction,photoRoutes} from './analyst.mjs';
const image={role:'gex',name:'fixture.png',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN6kAAAAASUVORK5CYII='};
test('images reject spoofed types and unsupported content',()=>{
 assert.equal(validateImage(image).role,'gex');
 assert.throws(()=>validateImage({...image,dataUrl:'data:image/png;base64,aGVsbG8gd29ybGQ='}));
 assert.throws(()=>validateImage({...image,role:'unknown'}));
});
test('uncertain headers and missing put GEX never become zero or a false total',()=>{
 const uncertain=normalizeExtraction({headersConfirmed:false,rows:[{strike:760,call:10611686,put:-2692700}]});
 assert.equal(uncertain.rows[0].net,null);assert.equal(uncertain.rows[0].call,null);
 const confirmed=normalizeExtraction({headersConfirmed:true,rows:[{strike:760,call:1.0611686E7,put:-2692700},{strike:770,call:73266023,put:null}]});
 assert.equal(confirmed.rows[0].net,7918986);assert.equal(confirmed.rows[1].net,null);
});
test('photo workflow persists uploads, uses confirmed snapshot, requires news and rejects stale inputs',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hth-photos-'));
 const now=new Date().toISOString();let calls=[],searched=true;
 const snapshot={id:'snapshot-test',symbol:'SPY',asOf:now,rows:[{strike:600,gex:10}]};
 const respond=async body=>{calls.push(body);return body.tools?{parts:[{type:'output_text',text:'Conditional report',annotations:[]}],searched}:{parts:[{type:'output_text',text:JSON.stringify({headersConfirmed:true,rows:[{strike:600,net:10}]})}]}};
 const handler=photoRoutes(root,async()=>[snapshot],respond);
 async function call(path,body,method='POST'){
  const req=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]);req.method=method;req.headers={'content-type':'application/json'};
  let result;await handler(req,new URL('http://localhost'+path),(status,data)=>{result={status,data};});return result;
 }
 try{
  const saved=await call('/api/analyst/uploads',{symbol:'SPY',asOf:now,images:[image]});assert.equal(saved.status,201);
  const uploadId=saved.data.id;
  const history=await call('/api/analyst/uploads',null,'GET');assert.equal(history.data.uploads.length,1);assert.equal(history.data.uploads[0].images[0].dataUrl,undefined);
  assert.equal((await call('/api/analyst/extract',{uploadId})).data.draft.rows[0].net,10);
  const run=await call('/api/analyst/run',{uploadId});assert.equal(run.status,200);assert.equal(calls.at(-1).tool_choice,'required');
  assert.match(calls.at(-1).input[0].content[0].text,/snapshot-test/);
  const sent=JSON.parse(calls.at(-1).input[0].content[0].text);
  assert.equal(sent.learningMemory.version,'outcome-memory-v1');
  assert.equal(sent.learningMemory.counts.reports,0);
  assert.equal(sent.strategies['30'].revision,0);
  assert.equal(run.data.report.policyDecision.accepted,false);
  assert.equal(run.data.report.strategy.revision,0);
  assert.equal(JSON.parse(await readFile(join(root,'reports',run.data.report.id+'.json'),'utf8')).snapshotId,'snapshot-test');
  const memoryView=await call('/api/analyst/learning',null,'GET');
  assert.equal(memoryView.data.memory.counts.unscored,1);
  searched=false;assert.equal((await call('/api/analyst/run',{uploadId})).status,400);
  const count=calls.length;snapshot.asOf=new Date(Date.now()-31*60000).toISOString();
  assert.equal((await call('/api/analyst/run',{uploadId})).status,400);assert.equal(calls.length,count);
  assert.equal((await call('/api/analyst/extract',{uploadId:'../../secret'})).status,400);
 }finally{await rm(root,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
import {createServer} from './server.mjs';
test('roles protect raw data, publication and subscriber feed; sessions revoke on logout',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hth-access-'));const server=createServer(pathToFileURL(dir+'/'));server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 const call=(path,body,cookie,method='POST')=>fetch(base+path,{method:body?method:'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 try{
 await call('/api/account');const setupCode=await readFile(join(dir,'accounts/setup-code.txt'),'utf8');const creds={email:'owner@example.com',password:'testing-password-123',setupCode};
 assert.equal((await call('/api/gex')).status,401);assert.equal((await call('/api/account/setup',{...creds,setupCode:'wrong'})).status,400);
 const setup=await call('/api/account/setup',creds);assert.equal(setup.status,200);const admin=setup.headers.get('set-cookie').split(';')[0];assert.match(setup.headers.get('set-cookie'),/HttpOnly/);
 const registration=await call('/api/account/register',{email:'member@example.com',password:'customer-password-123',role:'admin',subscription:'active'});const customer=registration.headers.get('set-cookie').split(';')[0];const account=await registration.json();assert.equal(account.user.role,'customer');assert.equal(account.user.subscription,'inactive');
 for(const path of ['/api/gex','/api/analyst/uploads','/api/analyst/learning','/api/admin/reports','/api/admin/publications','/api/customer/reports'])assert.equal((await call(path,null,customer)).status,403,path);
 assert.equal((await call('/api/analyst/run',{uploadId:'fake'},customer)).status,403);
 assert.equal((await call('/api/gex',null,admin)).status,200);
 const publication={title:'Reviewed scenario',symbol:'SPY',risk:'Balanced',position:'Wait / no trade',entry:'Wait',reason:'Conflicting evidence',analysis:'Reviewed evidence',invalidation:'Reassess after release',sources:'Manual source',asOf:new Date(Date.now()-60000).toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),reviewed:true};
 assert.equal((await call('/api/admin/publications',publication,customer)).status,403);
 assert.equal((await call('/api/admin/publications',{...publication,reviewed:false},admin)).status,400);
 assert.equal((await call('/api/admin/publications',{...publication,position:'Call scenario'},admin)).status,400);
 assert.equal((await call('/api/admin/publications',{...publication,position:'Call scenario',tradePlan:{contract:'SPY 600 call 2026-11-12',entryPrice:600,targetPrice:590,stopPrice:598,holdMinutes:60}},admin)).status,400);
 const saved=await call('/api/admin/publications',publication,admin);assert.equal(saved.status,201);const {report}=await saved.json();const feed=await call('/api/customer/reports',null,admin).then(r=>r.json());assert.equal(feed.reports[0].reason,publication.reason);
 assert.equal((await call('/api/admin/publications',{id:report.id},admin,'DELETE')).status,200);assert.equal((await call('/api/customer/reports',null,admin).then(r=>r.json())).reports.length,0);
 const directional={...publication,position:'Call scenario',tradePlan:{contract:'SPY 600 call 2026-11-12',entryPrice:600,targetPrice:605,stopPrice:598,holdMinutes:60}};
 assert.equal((await call('/api/admin/publications',{...directional,asOf:new Date(Date.now()-1800001).toISOString()},admin)).status,400);
 const active=await call('/api/admin/publications',directional,admin).then(r=>r.json());
 const change={id:active.report.id,status:'entered',observedAt:new Date().toISOString(),note:'Manual price and volume confirmation.',expectedVersion:0};
 assert.equal((await call('/api/admin/trade-status',change,customer)).status,403);
 assert.equal((await call('/api/admin/trade-status',change,admin)).status,200);
 assert.equal((await call('/api/admin/trade-status',change,admin)).status,400);
 assert.equal((await call('/api/customer/reports',null,admin).then(r=>r.json())).reports[0].statusHistory[0].source,'administrator');
 await call('/api/account/logout',{},admin);assert.equal((await call('/api/gex',null,admin)).status,401);
 }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});

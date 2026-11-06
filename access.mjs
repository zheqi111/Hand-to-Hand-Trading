import {validateOption,validateChart} from './public/research-data.js';
import {readReports,evaluateForecast} from './learning.mjs';
import {readRevisions} from './strategy.mjs';
import {evaluateCandidate} from './strategy-review.mjs';
import {freshness,validateStatusUpdate} from './public/lifecycle.js';
import {validateTradePlan} from './public/trade-plan.js';
import {randomBytes,scryptSync,timingSafeEqual,createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
export function workspaceAccess(root){
 const dir=join(root,'accounts'),pub=join(root,'published'),sessions=new Map(),attempts=new Map();
 const ready=(async()=>{await mkdir(dir,{recursive:true});await mkdir(pub,{recursive:true});try{await writeFile(join(dir,'setup-code.txt'),randomBytes(24).toString('hex'),{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}})();
 let statusQueue=Promise.resolve();
 const read=async p=>{try{return JSON.parse(await readFile(p,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
 const userPath=email=>join(dir,createHash('sha256').update(email).digest('hex')+'.json');
 const publicUser=u=>u?{email:u.email,role:u.role,subscription:u.subscription}:null;
 async function current(req){await ready;const token=/\bhth_session=([a-f0-9]{64})\b/.exec(req.headers.cookie||'')?.[1],session=sessions.get(token);if(!session||session.until<Date.now()){sessions.delete(token);return null;}return read(session.path);}
 async function body(req){if(!req.headers['content-type']?.startsWith('application/json'))throw new Error('JSON required.');let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>50000)throw new Error('Request too large.');}return JSON.parse(raw);}
 async function withStatus(record){if(!record)return record;const folder=join(pub,'status',record.id);let names=[];try{names=await readdir(folder);}catch(e){if(e.code!=='ENOENT')throw e;}const events=await Promise.all(names.filter(n=>n.endsWith('.json')).sort().map(n=>read(join(folder,n))));const withdrawal=await read(join(pub,'withdrawals',record.id+'.json'));return {...record,statusHistory:events,withdrawal};}
 async function allSnapshots(){return Promise.all((await readdir(root)).filter(n=>n.endsWith('.json')).map(n=>read(join(root,n))));}
 async function published(includeWithdrawn=false){await ready;return (await Promise.all((await readdir(pub)).filter(x=>x.endsWith('.json')).map(n=>read(join(pub,n)).then(withStatus)))).filter(r=>r&&(includeWithdrawn||!r.withdrawal)).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));}
 async function route(req,res,url,json){await ready;
  if(url.pathname==='/api/account'&&req.method==='GET'){json(200,{user:publicUser(await current(req)),adminExists:Boolean(await read(join(dir,'admin.json'))),billingConnected:false});return true;}
  if(['/api/account/login','/api/account/register','/api/account/setup','/api/account/logout'].includes(url.pathname)){
   if(req.method!=='POST'){json(405,{error:'POST required.'});return true;}
   try{
    if(url.pathname.endsWith('/logout')){const t=/\bhth_session=([a-f0-9]{64})\b/.exec(req.headers.cookie||'')?.[1];sessions.delete(t);res.setHeader('Set-Cookie','hth_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');json(200,{ok:true});return true;}
    const ip=req.socket.remoteAddress,rate=attempts.get(ip)||{count:0,until:Date.now()+60000};if(rate.until<Date.now()){rate.count=0;rate.until=Date.now()+60000;}attempts.set(ip,rate);if(++rate.count>12){json(429,{error:'Too many attempts. Try again in a minute.'});return true;}
    const b=await body(req),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<12||password.length>256)throw new Error('Use a valid email and a password of 12–256 characters.');
    const setup=url.pathname.endsWith('/setup');let path=setup?join(dir,'admin.json'):userPath(email),u;
    if(url.pathname.endsWith('/login')){const admin=await read(join(dir,'admin.json'));if(admin?.email===email)path=join(dir,'admin.json');u=await read(path);const salt=u?.salt||'missing-user',digest=scryptSync(password,salt,64);if(!u||!timingSafeEqual(digest,Buffer.from(u.hash,'hex')))throw new Error('Email or password is incorrect.');}
    else{if(setup){const code=await readFile(join(dir,'setup-code.txt'),'utf8');if(b.setupCode!==code)throw new Error('The local administrator setup code is incorrect.');}const admin=await read(join(dir,'admin.json'));if(admin?.email===email||(!setup&&await read(userPath(email))))throw new Error('Account already exists. Sign in instead.');const salt=randomBytes(16).toString('hex');u={email,salt,hash:scryptSync(password,salt,64).toString('hex'),role:setup?'admin':'customer',subscription:'inactive',createdAt:new Date().toISOString()};await writeFile(path,JSON.stringify(u),{flag:'wx'});}
    const token=randomBytes(32).toString('hex');sessions.set(token,{path,until:Date.now()+8*3600000});res.setHeader('Set-Cookie',`hth_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);json(200,{user:publicUser(u)});
   }catch(e){json(400,{error:e.code==='EEXIST'?'Administrator already configured. Sign in instead.':e instanceof SyntaxError?'Invalid request.':e.message});}return true;
  }
  if(['/api/customer/reports','/api/customer/journal'].includes(url.pathname)){
   if(req.method!=='GET'){json(405,{error:'GET required.'});return true;}const u=await current(req);if(!u){json(401,{error:'Sign in to view your membership.'});return true;}if(u.role!=='admin'&&u.subscription!=='active'){json(403,{error:'An active subscription is required. Billing is not connected yet.'});return true;}if(url.pathname.endsWith('/journal')){const [publications,reports,snapshots]=await Promise.all([published(true),readReports(root),allSnapshots()]);json(200,{entries:publications.map(p=>{const source=reports.find(r=>r.id===p.sourceReportId);return {id:p.id,sourceReportId:p.sourceReportId||null,title:p.title,symbol:p.symbol,position:p.position,risk:p.risk,publishedAt:p.publishedAt,expiresAt:p.expiresAt,reason:p.reason,withdrawal:p.withdrawal,statusHistory:p.statusHistory,outcome:source?evaluateForecast(source,snapshots):{status:'unscored',reason:'No linked agent forecast.'},optionReturn:null};})});return true;}json(200,{reports:await published()});return true;
  }
  if(url.pathname==='/api/admin/strategy-reviews'){
   const u=await current(req);if(u?.role!=='admin'){json(u?403:401,{error:'Administrator sign-in required.'});return true;}
   try{const [revisions,reports,snapshots]=await Promise.all([readRevisions(root),readReports(root),allSnapshots()]);
    if(req.method==='GET'){json(200,{candidates:revisions.map(r=>({...r,evaluation:evaluateCandidate(r,reports,snapshots)}))});return true;}
    if(req.method!=='POST'){json(405,{error:'POST required.'});return true;}const b=await body(req),r=revisions.find(r=>r.id===b.id);if(!r||!['approve','reject'].includes(b.decision))throw new Error('Choose a valid proposal and decision.');if(r.review)throw new Error('This proposal already has a recorded decision.');if(typeof b.note!=='string'||b.note.trim().length<10||b.note.length>2000)throw new Error('Add a review reason of at least 10 characters.');const evaluation=evaluateCandidate(r,reports,snapshots);if(b.decision==='approve'&&!evaluation.ready)throw new Error('Forward evaluation requirements have not been met. Approval is blocked.');const review={decision:b.decision,note:b.note.trim(),createdAt:new Date().toISOString(),evaluation};await mkdir(join(root,'strategies','reviews'),{recursive:true});await writeFile(join(root,'strategies','reviews',r.id+'.json'),JSON.stringify(review),{flag:'wx'});json(200,{review});
   }catch(e){json(400,{error:e.code==='EEXIST'?'Review already recorded.':e.message});}return true;
  }
  if(url.pathname==='/api/admin/trade-status'){
   const u=await current(req);if(u?.role!=='admin'){json(u?403:401,{error:'Administrator sign-in required.'});return true;}
   if(req.method!=='POST'){json(405,{error:'POST required.'});return true;}
   try{const b=await body(req);if(!/^[a-f0-9-]{36}$/.test(b.id))throw new Error('Invalid publication.');const work=statusQueue.then(async()=>{const record=await withStatus(await read(join(pub,b.id+'.json')));if(!record)throw new Error('Publication not found.');const event=validateStatusUpdate(record,b);const folder=join(pub,'status',b.id);await mkdir(folder,{recursive:true});await writeFile(join(folder,String(record.statusHistory.length+1).padStart(6,'0')+'.json'),JSON.stringify(event),{flag:'wx'});return event;});statusQueue=work.catch(()=>{});json(200,{event:await work});}catch(e){json(400,{error:e.message});}return true;
  }
  if(url.pathname==='/api/admin/publications'){
   const u=await current(req);if(u?.role!=='admin'){json(u?403:401,{error:'Administrator sign-in required.'});return true;}
   if(req.method==='GET'){json(200,{reports:await published()});return true;}
   try{const b=await body(req);if(req.method==='DELETE'){if(!/^[a-f0-9-]{36}$/.test(b.id))throw new Error('Invalid publication.');if(!await read(join(pub,b.id+'.json')))throw new Error('Publication not found.');await mkdir(join(pub,'withdrawals'),{recursive:true});try{await writeFile(join(pub,'withdrawals',b.id+'.json'),JSON.stringify({at:new Date().toISOString(),reason:'Withdrawn by administrator; original publication retained.'}),{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}json(200,{ok:true});return true;}
    if(req.method!=='POST'){json(405,{error:'Method not allowed.'});return true;}
    const fields=['title','symbol','risk','position','entry','reason','analysis','invalidation','sources','asOf','expiresAt'];const record={};for(const f of fields){if(typeof b[f]!=='string'||!b[f].trim()||b[f].length>12000)throw new Error('Complete every publication field.');record[f]=b[f].trim();}
    if(!['Conservative','Balanced','Aggressive'].includes(record.risk))throw new Error('Select a risk mode.');if(!['Call scenario','Put scenario','Wait / no trade'].includes(record.position))throw new Error('Select a position.');if(!Number.isFinite(Date.parse(record.asOf))||!Number.isFinite(Date.parse(record.expiresAt))||Date.parse(record.asOf)>Date.now()+60000||Date.parse(record.expiresAt)<=Date.now()||Date.parse(record.expiresAt)<=Date.parse(record.asOf))throw new Error('Use a valid observation time and future expiry.');if(b.reviewed!==true)throw new Error('Review and approve the customer-facing content first.');
    if(record.position!=='Wait / no trade'&&freshness(record).stale)throw new Error('Data is over 30 minutes old. Review fresh evidence before publishing a directional plan.');
    if(b.sourceReportId){if(!/^[a-f0-9-]{36}$/.test(b.sourceReportId))throw new Error('Invalid source report.');const source=await read(join(root,'reports',b.sourceReportId+'.json'));if(!source||!/^[a-f0-9-]{36}$/.test(source.snapshotId))throw new Error('Source report not found.');const snapshot=await read(join(root,source.snapshotId+'.json'));if(!snapshot||snapshot.symbol!==record.symbol||Math.abs(Date.parse(snapshot.asOf)-Date.parse(record.asOf))>=60000)throw new Error('Publication must retain the source snapshot symbol and observation time.');record.asOf=snapshot.asOf;if(record.position!=='Wait / no trade'&&(freshness(snapshot).stale||!source.policyDecision?.accepted))throw new Error('Source report is stale or its directional outlook was withheld. Use Wait or obtain fresh approved analysis.');record.sourceReportId=b.sourceReportId;}
    record.tradePlan=validateTradePlan(record.position,b.tradePlan);
    record.optionDetails=validateOption(b.optionDetails,record.position);record.chartData=validateChart(b.chartData,record.asOf);if(record.tradePlan&&record.optionDetails)record.tradePlan.contract=record.symbol+' '+record.optionDetails.strike+' '+record.optionDetails.type.toUpperCase()+' · '+record.optionDetails.expiration;
    record.id=randomUUID();record.publishedAt=new Date().toISOString();record.author=u.email;await writeFile(join(pub,record.id+'.json'),JSON.stringify(record),{flag:'wx'});json(201,{report:record});
   }catch(e){json(400,{error:e.code==='ENOENT'?'Publication not found.':e.message});}return true;
  }
  return false;
 }
 return {route,current};
}

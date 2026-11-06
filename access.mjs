import {randomBytes,scryptSync,timingSafeEqual,createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,readdir,unlink} from 'node:fs/promises';
import {join} from 'node:path';
export function workspaceAccess(root){
 const dir=join(root,'accounts'),pub=join(root,'published'),sessions=new Map(),attempts=new Map();
 const ready=(async()=>{await mkdir(dir,{recursive:true});await mkdir(pub,{recursive:true});try{await writeFile(join(dir,'setup-code.txt'),randomBytes(24).toString('hex'),{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}})();
 const read=async p=>{try{return JSON.parse(await readFile(p,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
 const userPath=email=>join(dir,createHash('sha256').update(email).digest('hex')+'.json');
 const publicUser=u=>u?{email:u.email,role:u.role,subscription:u.subscription}:null;
 async function current(req){await ready;const token=/\bhth_session=([a-f0-9]{64})\b/.exec(req.headers.cookie||'')?.[1],session=sessions.get(token);if(!session||session.until<Date.now()){sessions.delete(token);return null;}return read(session.path);}
 async function body(req){if(!req.headers['content-type']?.startsWith('application/json'))throw new Error('JSON required.');let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>50000)throw new Error('Request too large.');}return JSON.parse(raw);}
 async function published(){await ready;return (await Promise.all((await readdir(pub)).filter(x=>x.endsWith('.json')).map(n=>read(join(pub,n))))).filter(Boolean).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));}
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
  if(url.pathname==='/api/customer/reports'){
   if(req.method!=='GET'){json(405,{error:'GET required.'});return true;}const u=await current(req);if(!u){json(401,{error:'Sign in to view your membership.'});return true;}if(u.role!=='admin'&&u.subscription!=='active'){json(403,{error:'An active subscription is required. Billing is not connected yet.'});return true;}json(200,{reports:await published()});return true;
  }
  if(url.pathname==='/api/admin/publications'){
   const u=await current(req);if(u?.role!=='admin'){json(u?403:401,{error:'Administrator sign-in required.'});return true;}
   if(req.method==='GET'){json(200,{reports:await published()});return true;}
   try{const b=await body(req);if(req.method==='DELETE'){if(!/^[a-f0-9-]{36}$/.test(b.id))throw new Error('Invalid publication.');await unlink(join(pub,b.id+'.json'));json(200,{ok:true});return true;}
    if(req.method!=='POST'){json(405,{error:'Method not allowed.'});return true;}
    const fields=['title','symbol','risk','position','entry','reason','analysis','invalidation','sources','asOf','expiresAt'];const record={};for(const f of fields){if(typeof b[f]!=='string'||!b[f].trim()||b[f].length>12000)throw new Error('Complete every publication field.');record[f]=b[f].trim();}
    if(!['Conservative','Balanced','Aggressive'].includes(record.risk))throw new Error('Select a risk mode.');if(!['Call scenario','Put scenario','Wait / no trade'].includes(record.position))throw new Error('Select a position.');if(!Number.isFinite(Date.parse(record.asOf))||!Number.isFinite(Date.parse(record.expiresAt))||Date.parse(record.asOf)>Date.now()+60000||Date.parse(record.expiresAt)<=Date.now()||Date.parse(record.expiresAt)<=Date.parse(record.asOf))throw new Error('Use a valid observation time and future expiry.');if(b.reviewed!==true)throw new Error('Review and approve the customer-facing content first.');
    record.id=randomUUID();record.publishedAt=new Date().toISOString();record.author=u.email;await writeFile(join(pub,record.id+'.json'),JSON.stringify(record),{flag:'wx'});json(201,{report:record});
   }catch(e){json(400,{error:e.code==='ENOENT'?'Publication not found.':e.message});}return true;
  }
  return false;
 }
 return {route,current};
}

import {randomUUID} from 'node:crypto';
export function validateSnapshot(input, now=Date.now()){
 const fail=m=>{throw new Error(m);};
 if(!input||typeof input!=='object')fail('Snapshot required.');
 const symbol=String(input.symbol||'').trim().toUpperCase();
 if(!/^[A-Z][A-Z0-9.^-]{0,14}$/.test(symbol))fail('Enter a valid symbol.');
 const time=Date.parse(input.asOf);
 if(!Number.isFinite(time)||!/(Z|[+-]\d{2}:\d{2})$/.test(input.asOf)||time>now+60000)fail('Enter a valid data time with timezone, not in the future.');
 const source=String(input.source||'').trim(),scope=String(input.scope||'').trim();
 if(!source||source.length>200||!scope||scope.length>200)fail('Source and expiration scope are required (up to 200 characters).');
 if(!['USD per 1% move','USD per $1 move','Provider units'].includes(input.unit))fail('Choose units.');
 const num=(v,name)=>{if(!['string','number'].includes(typeof v)||String(v).trim()===''||!Number.isFinite(Number(v)))fail(name+' must be numeric.');return Number(v);};
 const spot=num(input.spot,'Spot');if(spot<=0)fail('Spot must be positive.');
 if(!Array.isArray(input.rows)||!input.rows.length||input.rows.length>2000)fail('Enter 1–2,000 strike rows.');
 const seen=new Set();
 const rows=input.rows.map(r=>{const strike=num(r.strike,'Strike'),gex=num(r.gex,'Net GEX');if(strike<=0||seen.has(strike))fail('Strikes must be positive and unique.');seen.add(strike);return {strike,gex};}).sort((a,b)=>a.strike-b.strike);
 if(!Number.isFinite(rows.reduce((n,r)=>n+r.gex,0)))fail('GEX values are too large.');
 const notes=String(input.notes||'');if(notes.length>4000)fail('Notes must be under 4,000 characters.');
 return {id:randomUUID(),symbol,asOf:new Date(time).toISOString(),savedAt:new Date(now).toISOString(),source,scope,unit:input.unit,spot,rows,notes};
}
export function analyzeSnapshot(s,previous,now=Date.now()){
 const ageMinutes=Math.max(0,(now-Date.parse(s.asOf))/60000),total=s.rows.reduce((n,r)=>n+r.gex,0);
 const positive=s.rows.filter(r=>r.gex>0).sort((a,b)=>b.gex-a.gex)[0]||null;
 const negative=s.rows.filter(r=>r.gex<0).sort((a,b)=>a.gex-b.gex)[0]||null;
 const comparable=previous&&previous.symbol===s.symbol&&previous.source===s.source&&previous.scope===s.scope&&previous.unit===s.unit&&previous.rows.length===s.rows.length&&previous.rows.every((r,i)=>r.strike===s.rows[i].strike);
 return {snapshotId:s.id,asOf:s.asOf,ageMinutes,stale:ageMinutes>=30,nextUpdateAt:new Date(Date.parse(s.asOf)+1800000).toISOString(),total,positive,negative,previousId:comparable?previous.id:null,change:comparable?total-previous.rows.reduce((n,r)=>n+r.gex,0):null,method:'Arithmetic summary of submitted GEX. No AI model call or external verification.',limitations:['Totals cover only submitted strikes and expiration scope.','GEX sign depends on source methodology; it is not a buy or sell signal.','No live quotes, news, or execution are connected.']};
}

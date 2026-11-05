import {parseRows} from './gex-input.js';
const form=document.querySelector('#gex-form'), message=document.querySelector('#gex-message'), selector=document.querySelector('#gex-symbol');
let context=null;
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);
const stamp=s=>new Date(s).toLocaleString();
function currentTime(){const d=new Date();return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
form.elements.asOf.value=currentTime();
async function api(path,options){const response=await fetch(path,options);const body=await response.json();if(!response.ok)throw new Error(body.error||'Request failed.');return body;}
function showAnalysis(){
 const target=document.querySelector('#gex-analysis');
 if(!context){target.innerHTML='<p>No snapshots yet. Save your first update above.</p>';return;}
 const {snapshot:s,analysis:a}=context;
 const age=Math.max(0,(Date.now()-Date.parse(s.asOf))/60000),stale=age>=30;
 const concentration=r=>r?esc(fmt(r.strike))+' ('+esc(fmt(r.gex))+')':'None in submitted rows';
 target.innerHTML=`<div class="freshness ${stale?'overdue':''}"><b>${stale?'Update due · data is stale':'Fresh snapshot'}</b> · ${Math.floor(age)} minutes old · next update ${esc(stamp(a.nextUpdateAt))}</div><p><b>${esc(s.symbol)}</b> · Data as of ${esc(stamp(s.asOf))} · ${esc(s.source)} · ${esc(s.scope)}</p><div class="trade-values"><div><small>Submitted net GEX · ${esc(s.unit)}</small><b>${esc(fmt(a.total))}</b></div><div><small>Largest positive strike</small><b>${concentration(a.positive)}</b></div><div><small>Largest negative strike</small><b>${concentration(a.negative)}</b></div></div><p>Change from preceding compatible snapshot: <b>${a.change===null?'Unavailable (no matching scope, source, units, and strikes)':esc(fmt(a.change))}</b></p><p>${stale?'This snapshot is historical context; upload a new update before treating it as current.':'This summary is based only on your submitted values, not an independently verified market feed.'}</p><details><summary>Evidence and analysis limits</summary><p>${esc(a.method)}</p><ul>${a.limitations.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul><p>Notes: ${esc(s.notes||'None')}</p><small>Snapshot ID: ${esc(s.id)}</small></details><p><a href="/api/gex/context?symbol=${encodeURIComponent(s.symbol)}" download="gex-context.json">Download agent context ↓</a></p>`;
}
async function loadContext(){
 context=null;showAnalysis();
 if(selector.value)context=await api('/api/gex/context?symbol='+encodeURIComponent(selector.value));
 showAnalysis();
}
async function load(preferred){
 const {snapshots}=await api('/api/gex');
 const symbols=[...new Set(snapshots.map(s=>s.symbol))];
 const selected=preferred||selector.value;
 selector.innerHTML=symbols.map(s=>'<option>'+esc(s)+'</option>').join('');
 if(symbols.includes(selected))selector.value=selected;
 document.querySelector('#gex-history').innerHTML=snapshots.length?'<div class="table-scroll"><table><thead><tr><th>Symbol</th><th>Data time</th><th>Source / scope</th><th>Rows</th></tr></thead><tbody>'+snapshots.slice(0,100).map(s=>'<tr><td>'+esc(s.symbol)+'</td><td>'+esc(stamp(s.asOf))+'</td><td>'+esc(s.source)+' / '+esc(s.scope)+'</td><td>'+s.rows.length+'</td></tr>').join('')+'</tbody></table></div><small>Showing latest '+Math.min(100,snapshots.length)+' of '+snapshots.length+' snapshots. Export includes all.</small>':'<p>No saved updates.</p>';
 await loadContext();
}
form.addEventListener('submit',async event=>{
 event.preventDefault();const button=document.querySelector('#gex-submit');button.disabled=true;message.textContent='';
 let saved=false;
 try{
  const values=Object.fromEntries(new FormData(form));values.asOf=new Date(values.asOf).toISOString();values.rows=parseRows(values.rows);
  const result=await api('/api/gex',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});saved=true;
  await load(result.snapshot.symbol);
  message.textContent='Snapshot saved on this computer. Analysis updated.';form.elements.asOf.value=currentTime();document.dispatchEvent(new Event('gex-saved'));
 }catch(error){message.textContent=(saved?'Saved, but refresh failed. Do not resubmit; use Refresh. ':'')+error.message;}
 finally{button.disabled=false;}
});
document.querySelector('#gex-file').addEventListener('change',async event=>{
 const file=event.target.files[0];if(!file)return;
 try{if(file.size>200000)throw new Error('Use a file under 200 KB.');const text=await file.text();parseRows(text);form.elements.rows.value=text;message.textContent='File loaded. Confirm symbol, timestamp, units, and scope before saving.';}catch(error){message.textContent=error.message;}
});
selector.addEventListener('change',()=>loadContext().catch(e=>message.textContent=e.message));
document.querySelector('#gex-refresh').addEventListener('click',()=>load().catch(e=>message.textContent=e.message));
setInterval(showAnalysis,15000);
load().catch(e=>message.textContent='Could not load saved snapshots: '+e.message);

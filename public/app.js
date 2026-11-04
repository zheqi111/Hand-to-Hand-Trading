import {filterSetups,maxLoss,setups} from './model.js';
let mode='Conservative';
let saved=[];
try {const stored=JSON.parse(localStorage.getItem('hth-scenarios')||'[]');if(Array.isArray(stored))saved=stored.filter(id=>setups.some(s=>s.id===id));} catch {}
const descriptions={Conservative:'Strict confirmation requirements. Waiting is a valid decision.',Balanced:'Explore a hypothetical directional setup with more time to expiration.',Aggressive:'Explore a hypothetical short-dated setup with higher time-decay exposure.'};
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
function render(){
 document.querySelector('#mode-description').textContent=descriptions[mode];
 const results=filterSetups(mode,document.querySelector('#symbol').value);
 document.querySelector('#ideas').innerHTML=results.length?results.map(s=>`<article class="panel idea"><div class="section-head"><div><span class="tag">HYPOTHETICAL · ${s.mode.toUpperCase()}</span><h2>${s.symbol} <span class="${s.type==='CALL'?'green':'red'}">${s.strike} ${s.type}</span></h2></div><button class="save" data-save="${s.id}" ${saved.includes(s.id)?'disabled':''}>${saved.includes(s.id)?'Saved':'Save scenario + '}</button></div><div class="trade-values"><div><small>Expiration</small><b>${s.expiry}</b></div><div><small>Sample premium / share</small><b>${money(s.premium)}</b></div><div><small>Max loss · 1 standard contract</small><b>${money(maxLoss(s.premium))} + fees</b></div></div><p><b>Entry condition:</b> ${s.trigger}</p><details><summary>Read the reasoning</summary><div class="reason"><h3>Why this scenario?</h3><p>${s.reason}</p><h3>What invalidates it?</h3><p>${s.invalid}</p><h3>Exit / reassessment</h3><p>${s.target}</p><h3>Risk</h3><p>${s.risk}</p><small>Source: authored demo fixture. No live market or news evidence.</small></div></details></article>`).join(''):'<div class="panel empty"><span class="empty-icon">◎</span><h3>No qualifying setup</h3><p>There is no demo scenario for this selection. Live recommendations remain disabled until fresh provider data and validated rules are available.</p></div>';
 document.querySelector('#saved').innerHTML=saved.length?saved.map(id=>{const s=setups.find(s=>s.id===id);return `<div class="saved-row"><span><b>${s.symbol} ${s.strike} ${s.type}</b> · ${s.mode} · synthetic</span><button data-remove="${s.id}">Remove</button></div>`;}).join(''):'<p class="muted">Save a scenario to revisit its reasoning here. No orders are placed.</p>';
}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();}));
document.querySelector('#symbol').addEventListener('change',render);
document.addEventListener('click',e=>{const b=e.target.closest('[data-save],[data-remove]');if(!b)return;if(b.dataset.save&&!saved.includes(b.dataset.save))saved.push(b.dataset.save);if(b.dataset.remove)saved=saved.filter(id=>id!==b.dataset.remove);try{localStorage.setItem('hth-scenarios',JSON.stringify(saved));}catch{}render();});
render();

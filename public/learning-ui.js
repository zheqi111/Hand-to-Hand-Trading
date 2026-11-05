let loading=false;
async function refresh(){
 if(loading)return;loading=true;
 const message=document.querySelector('#learning-message');
 try{
  const response=await fetch('/api/analyst/learning');const {memory,error}=await response.json();if(!response.ok)throw new Error(error||'Unable to load learning history.');
  const c=memory.counts;
  document.querySelector('#learning-summary').textContent=c.reports?c.reports+' reports · '+c.resolved+' resolved · '+c.correct+' matched outlook · '+c.abstained+' abstentions · '+c.pending+' pending · '+c.missing+' missing outcomes · '+c.unscored+' unscored':'No learning history yet. Run an analyst report after configuring your API key, then add later GEX snapshots with observed spot prices.';
  const tbody=document.querySelector('#learning-rows');tbody.replaceChildren();
  const labels={resolved:'Resolved',pending:'Waiting for deadline',awaiting_update:'Awaiting price update',missing_outcome:'No qualifying price update',abstained:'Wait / no forecast',unscored:'No valid forecast'};
  for(const item of memory.evaluations.slice(0,100)){
   const row=document.createElement('tr');
   const values=[item.createdAt?new Date(item.createdAt).toLocaleString():'—',item.symbol||'—',item.direction?item.direction+' · '+item.horizonMinutes+'m':'—',item.dueAt?new Date(item.dueAt).toLocaleString():'—',item.status==='resolved'?(item.correct?'Matched':'Missed')+' · actual '+item.actual:labels[item.status],item.movePct===undefined?'—':item.movePct.toFixed(3)+'%'];
   for(const value of values){const td=document.createElement('td');td.textContent=value;row.append(td);}tbody.append(row);
  }
  document.querySelector('#learning-groups').textContent=memory.groups.map(g=>g.horizonMinutes+'m: '+g.correct+'/'+g.resolved+' matched; always-up baseline '+g.alwaysUpCorrect+'/'+g.resolved+'. '+g.interpretation).join('\n');
  message.textContent='Updated '+new Date(memory.cutoff).toLocaleTimeString()+'. Scoring: up > +0.2%, down < −0.2%, range inside ±0.2%. Fixed rules; this is not a calibrated probability.';
 }catch(e){message.textContent=e.message;}finally{loading=false;}
}
document.querySelector('#learning-refresh').addEventListener('click',refresh);
document.addEventListener('gex-saved',refresh);
document.addEventListener('analyst-saved',refresh);
setInterval(refresh,60000);
refresh();

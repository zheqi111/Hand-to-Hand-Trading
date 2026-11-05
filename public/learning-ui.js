let loading=false;
async function refresh(){
 if(loading)return;loading=true;
 const message=document.querySelector('#learning-message');
 try{
  const response=await fetch('/api/analyst/learning');const {memory,error,strategies=[]}=await response.json();if(!response.ok)throw new Error(error||'Unable to load learning history.');
  renderStrategies(strategies);const c=memory.counts;
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
function renderStrategies(strategies){
 const target=document.querySelector('#strategy-revisions');target.replaceChildren();
 if(!strategies.length){target.textContent='Baseline confirmation policy. No resolved non-overlapping misses have triggered a revision yet.';return;}
 for(const {active,versions,history}of strategies){
  const article=document.createElement('article');article.className='panel strategy-card';
  const heading=document.createElement('h4');heading.textContent=active.group.symbol+' · '+active.group.horizonMinutes+'m · '+active.name+' · revision '+active.revision;article.append(heading);
  const metadata=document.createElement('small');metadata.textContent=active.group.source+' / '+active.group.scope+' / '+active.group.unit+' / GEX sign '+active.group.regime;article.append(metadata);
  const change=document.createElement('p');change.textContent=active.change;article.append(change);
  const reason=document.createElement('p');reason.textContent=active.reason;article.append(reason);
  const limit=document.createElement('small');limit.textContent='Evidence categories are model-declared, not independently verified. These changes are unproven hypotheses; higher confirmation counts do not guarantee better predictions.';article.append(limit);
  const stats=document.createElement('p');stats.textContent=versions.map(v=>'Revision '+v.revision+': '+v.matched+'/'+v.resolved+' matched, '+v.withheld+' wait, '+v.missing+' missing outcomes, '+v.reports+' total reports').join(' | ');article.append(stats);
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Change history and triggering errors';details.append(summary);
  for(const revision of history){const p=document.createElement('p');p.textContent='Revision '+revision.revision+' · '+new Date(revision.createdAt).toLocaleString()+' · missed report '+revision.triggerReportId+' · '+revision.change;details.append(p);}
  article.append(details);target.append(article);
 }
}

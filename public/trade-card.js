import {planState} from './trade-plan.js';
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
export function reportCard(r){
 const card=make('article',undefined,'trade-card'),state=planState(r),p=state.plan;
 const top=make('div',undefined,'trade-top');top.append(make('span',r.symbol,'trade-ticker'),make('span',r.risk,'risk-pill'),make('span',r.demo?'SAMPLE · NOT LIVE':state.status==='conditional'?'CONDITIONAL SETUP':state.status.toUpperCase(),'trade-status'));card.append(top);
 const layout=make('div',undefined,'trade-layout'),left=make('div',undefined,'trade-overview');
 left.append(make('p','THE PLAN','eyebrow'),make('h2',state.action,'trade-action'));
 if(p){left.append(make('p',p.contract,'contract-name'));const boxes=make('div',undefined,'trade-numbers');
 for(const [label,value,cls]of [['ENTRY',money(p.entryPrice),'entry'],['TAKE PROFIT',money(p.targetPrice),'profit'],['STOP LOSS',money(p.stopPrice),'stop']]){const box=make('div',undefined,'number-box '+cls);box.append(make('span',label),make('strong',value));boxes.append(box);}left.append(boxes);
 const hold=make('div',undefined,'hold-line');hold.append(make('span','◷'),make('b',`Estimated hold: ${p.holdMinutes<60?p.holdMinutes+' min':Number((p.holdMinutes/60).toFixed(1))+(p.holdMinutes===60?' hour':' hours')}`));left.append(hold,make('p','After entry confirms · an estimate, not a deadline or guarantee.','micro'));
 left.append(make('p',r.entry,'entry-condition'));left.append(make('small','All levels use the underlying stock/ETF price in USD. They are not option-premium prices.'));
 }else left.append(make('p',state.status==='wait'?r.reason:state.status==='expired'?'This setup is no longer valid. Open the analysis for historical context.':'No complete entry, target and stop have been published. No actionable trade plan is shown.','entry-condition'));
 layout.append(left);
 if(p){const chart=make('div',undefined,'trade-chart');chart.append(make('p','YOUR LEVELS AT A GLANCE','eyebrow'));
 const low=Math.min(p.stopPrice,p.targetPrice),high=Math.max(p.stopPrice,p.targetPrice),pad=(high-low)*.24,y=v=>32+(high+pad-v)/(high-low+2*pad)*205;
 const levels=[{key:'targetPrice',label:'TAKE PROFIT',color:'#c8f78a'},{key:'entryPrice',label:'ENTRY',color:'#a9baff'},{key:'stopPrice',label:'STOP LOSS',color:'#ff9caa'}];
 const area=(a,b,color)=>`<rect x="16" y="${Math.min(y(a),y(b))}" width="428" height="${Math.abs(y(a)-y(b))}" fill="${color}" opacity=".08"/>`;
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 460 275');svg.setAttribute('role','img');svg.setAttribute('aria-label',`Underlying price plan: entry ${money(p.entryPrice)}, take profit ${money(p.targetPrice)}, stop loss ${money(p.stopPrice)}. This is a level diagram, not a price history or predicted path.`);
 svg.innerHTML=area(p.entryPrice,p.targetPrice,'#b5ec7e')+area(p.entryPrice,p.stopPrice,'#ef8d9d')+levels.map(l=>`<g data-level="${l.key}"><line x1="16" x2="444" y1="${y(p[l.key])}" y2="${y(p[l.key])}" stroke="${l.color}" stroke-width="1.5" stroke-dasharray="${l.key==='entryPrice'?'5 5':'0'}"/><rect x="235" y="${y(p[l.key])-14}" width="209" height="28" rx="5" fill="#19232d"/><text x="247" y="${y(p[l.key])+4}" fill="${l.color}" font-family="system-ui" font-size="14">${l.label} · ${money(p[l.key])}</text></g>`).join('');chart.append(svg);
 const tabs=make('div',undefined,'level-tabs'),hint=make('p','Select a level to see how it is used.','level-hint');hint.setAttribute('aria-live','polite');
 const explanations={entryPrice:`Wait for the published entry condition at ${money(p.entryPrice)}. Reaching this price alone does not confirm entry. No live price is being monitored here.`,targetPrice:`Take-profit reference: ${money(p.targetPrice)} on the underlying. Reassess or exit according to the reviewed plan. The option's actual return depends on its premium and market conditions.`,stopPrice:`Stop-loss reference: ${money(p.stopPrice)} on the underlying. It is an invalidation level, not an automated stop order; gaps and slippage can cause larger losses.`};
 levels.forEach(l=>{const b=make('button',l.label);b.type='button';b.setAttribute('aria-pressed','false');b.onclick=()=>{tabs.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));svg.querySelectorAll('[data-level]').forEach(g=>g.setAttribute('opacity',g.dataset.level===l.key?'1':'.35'));hint.textContent=explanations[l.key];};tabs.append(b);});chart.append(tabs,hint,make('small','Price-level diagram · no live candles or forecast path'));layout.append(chart);
 }
 card.append(layout);
 const details=make('details',undefined,'trade-deep-dive');details.append(make('summary','Why this trade? Explore the analysis ↗'));
 details.append(make('h3',r.title));for(const [key,title]of [['reason','The reason'],['analysis','Evidence & counterevidence'],['invalidation','What changes the plan'],['sources','Sources & limitations']]){const section=make('section');section.append(make('h4',title),make('p',r[key]));details.append(section);}details.append(make('small',`Observed: ${new Date(r.asOf).toLocaleString()} · Valid until: ${new Date(r.expiresAt).toLocaleString()}`));card.append(details);
 card.append(make('div',r.demo?'Fictional example · No live signal, current contract or executable trade.':`Valid until ${new Date(r.expiresAt).toLocaleString()} · No automatic order execution.`,'trade-bottom'));return card;
}

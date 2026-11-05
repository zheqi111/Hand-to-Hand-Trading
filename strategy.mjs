import {createHash} from 'node:crypto';
import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {evaluateForecast} from './learning.mjs';

export const STRATEGY_VERSION='confirmation-policy-v1';
const queues=new Map();
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,24);
export function strategyGroup(value,horizon=value.horizonMinutes){
 return {symbol:value.symbol,source:value.source,scope:value.scope,unit:value.unit,regime:value.regime??Math.sign(value.rows.reduce((sum,row)=>sum+row.gex,0)),horizonMinutes:horizon};
}
export const groupKey=group=>digest(group);
export function baseline(group){
 return {id:'baseline-'+groupKey(group),group,revision:0,level:0,name:'Baseline',minSupportingCategories:1,requiredCategories:['price_action'],requireCounterEvidence:false,requireInvalidation:false,ruleVersion:STRATEGY_VERSION,reason:'No independent resolved miss has triggered a change.',reviewedWindows:[]};
}
export async function readRevisions(root){
 const dir=resolve(root,'strategies');await mkdir(dir,{recursive:true});
 return Promise.all((await readdir(dir)).filter(name=>name.endsWith('.json')).map(name=>readFile(resolve(dir,name),'utf8').then(JSON.parse)));
}
export function selectStrategy(revisions,group,cutoff=Date.now()){
 return revisions.filter(r=>groupKey(r.group)===groupKey(group)&&Date.parse(r.createdAt)<=cutoff).sort((a,b)=>b.revision-a.revision)[0]||baseline(group);
}
function overlaps(a,b){return Date.parse(a.start)<Date.parse(b.end)&&Date.parse(b.start)<Date.parse(a.end);}
export async function reviseStrategies(root,reports,snapshots,cutoff=Date.now()){
 // Serialize local writes so simultaneous uploads cannot produce competing revisions.
 const previous=queues.get(root)||Promise.resolve();
 const task=previous.catch(()=>{}).then(async()=>{
  const revisions=await readRevisions(root);
  const misses=reports.filter(r=>r.forecast&&Date.parse(r.createdAt)<=cutoff).map(report=>({report,outcome:evaluateForecast(report,snapshots,cutoff)})).filter(x=>x.outcome.status==='resolved'&&!x.outcome.correct).sort((a,b)=>Date.parse(a.report.createdAt)-Date.parse(b.report.createdAt)||a.report.id.localeCompare(b.report.id));
  for(const {report,outcome}of misses){
   const group=strategyGroup(report.forecast),prior=selectStrategy(revisions,group,cutoff);
   const window={start:report.createdAt,end:report.forecast.dueAt,reportId:report.id};
   if(prior.reviewedWindows.some(w=>w.reportId===report.id||overlaps(w,window)))continue;
   const level=Math.min(2,prior.level+1);
   const failure=outcome.actual==='range'?'Expected movement did not exceed the fixed neutral band.':report.forecast.direction==='range'?'The endpoint moved outside the forecast range.':'The endpoint moved opposite to the forecast.';
   const revision={...prior,id:digest([STRATEGY_VERSION,group,report.id]),createdAt:new Date(cutoff).toISOString(),revision:prior.revision+1,parentId:prior.id,level,name:level===1?'Guarded confirmation':'Defensive confirmation',minSupportingCategories:level+1,requireCounterEvidence:true,requireInvalidation:true,triggerReportId:report.id,outcomeSnapshotId:outcome.outcomeSnapshotId,reason:failure+' Cause is unknown; this revision increases confirmation requirements rather than guessing why.',change:level===prior.level?'Confirmation requirements are already at the configured maximum. Added this miss to the review history.':'Require '+(level+1)+' distinct supporting evidence categories, including price action, plus counterevidence review and an invalidation condition.',reviewedWindows:[...prior.reviewedWindows,window],status:'Forward testing; effectiveness unproven'};
   try{await writeFile(resolve(root,'strategies',revision.id+'.json'),JSON.stringify(revision,null,2),{flag:'wx'});revisions.push(revision);}catch(error){if(error.code!=='EEXIST')throw error;}
  }
  return revisions;
 });
 queues.set(root,task);
 try{return await task;}finally{if(queues.get(root)===task)queues.delete(root);}
}
const categories=['price_action','momentum','volume','gex','news'];
export function extractEvidence(parts){
 const matches=[...parts.map(p=>p.text||'').join('\n').matchAll(/<forecast>([\s\S]*?)<\/forecast>/g)];
 if(matches.length!==1)return {signals:[],counterEvidence:'',invalidation:''};
 try{
  const data=JSON.parse(matches[0][1]);
  const signals=Array.isArray(data.supportingSignals)?data.supportingSignals.filter(s=>s&&categories.includes(s.category)&&typeof s.detail==='string'&&s.detail.trim().length>=15).map(s=>({category:s.category,detail:s.detail.slice(0,2000)})):[];
  return {signals,counterEvidence:typeof data.counterEvidence==='string'?data.counterEvidence.slice(0,2000):'',invalidation:typeof data.invalidation==='string'?data.invalidation.slice(0,2000):''};
 }catch{return {signals:[],counterEvidence:'',invalidation:''};}
}
export function applyStrategy(forecast,parts,strategy){
 const evidence=extractEvidence(parts),reasons=[];
 if(!forecast)return {forecast:null,decision:{accepted:false,reasons:['No valid forecast.'],strategyId:strategy.id,evidence}};
 if(forecast.direction!=='wait'){
  const unique=[...new Set(evidence.signals.map(s=>s.category))];
  if(unique.length<strategy.minSupportingCategories)reasons.push('Requires '+strategy.minSupportingCategories+' distinct supporting evidence categories; received '+unique.length+'.');
  for(const category of strategy.requiredCategories)if(!unique.includes(category))reasons.push('Missing supporting '+category+' evidence.');
  if(strategy.requireCounterEvidence&&evidence.counterEvidence.trim().length<15)reasons.push('Missing explicit counterevidence review.');
  if(strategy.requireInvalidation&&evidence.invalidation.trim().length<15)reasons.push('Missing explicit invalidation condition.');
 }
 const accepted=reasons.length===0;
 return {forecast:{...forecast,direction:accepted?forecast.direction:'wait',reason:accepted?forecast.reason:'Withheld by strategy policy: '+reasons.join(' '),strategyId:strategy.id,strategyRevision:strategy.revision},decision:{accepted,reasons,strategyId:strategy.id,evidence,limitation:'Checks model-declared evidence structure, not independent verification of its truth or predictive value.'}};
}
export const STRATEGY_INSTRUCTION=`Apply the active strategy for the selected horizon. Include supportingSignals:[{"category":"price_action|momentum|volume|gex|news","detail":"specific observed evidence, timestamp/source and why it supports this outlook"}], counterEvidence:"explicit contradictory evidence or evidence-based review", and invalidation:"specific condition invalidating this outlook" inside the forecast JSON. Choose one allowed category per item. List only actual supporting evidence; never invent or relabel evidence to meet the count. Multiple indicators in one category count once. GEX alone is not directional proof, and category diversity is not statistical independence. If policy requirements are unmet, choose wait. Clearly label all conditional scenarios as scenarios, separate from the policy-approved outlook. Include a Strategy revision paragraph naming the version, triggering error, change, and uncertainty. A failed endpoint forecast does not establish a causal explanation. Do not rewrite old predictions, risk limits, or scoring rules.`;
export function strategySummary(revisions,reports,snapshots,cutoff=Date.now()){
 const keys=[...new Set(revisions.map(r=>groupKey(r.group)))];
 return keys.map(key=>{
  const history=revisions.filter(r=>groupKey(r.group)===key).sort((a,b)=>b.revision-a.revision);
  const active=history[0];
  const versions=[baseline(active.group),...history.slice().reverse()].map(policy=>{
   const evaluated=reports.filter(r=>r.strategy?.id===policy.id||(policy.revision===0&&!r.strategy&&r.forecast&&groupKey(strategyGroup(r.forecast))===key)).map(r=>evaluateForecast(r,snapshots,cutoff));
   const resolved=evaluated.filter(e=>e.status==='resolved');
   return {id:policy.id,revision:policy.revision,level:policy.level,reports:evaluated.length,resolved:resolved.length,matched:resolved.filter(e=>e.correct).length,withheld:evaluated.filter(e=>e.status==='abstained').length,missing:evaluated.filter(e=>e.status==='missing_outcome').length};
  });
  return {active,versions,history:history.slice(0,10)};
 });
}

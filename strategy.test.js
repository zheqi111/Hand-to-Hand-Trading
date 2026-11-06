import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseForecast} from './learning.mjs';
import {strategyGroup,baseline,reviseStrategies,selectStrategy,readRevisions,applyStrategy,strategySummary} from './strategy.mjs';
const t=Date.parse('2026-11-04T15:00:00Z'),iso=n=>new Date(n).toISOString();
const snapshot={symbol:'SPY',source:'Source',scope:'0DTE',unit:'Provider units',spot:100,asOf:iso(t),savedAt:iso(t),rows:[{strike:100,gex:10}]};
const text=extra=>[{text:'<forecast>'+JSON.stringify({direction:'up',horizonMinutes:30,reason:'Test hypothesis',...extra})+'</forecast>'}];
function report(id,offset=0,extra={}){const createdAt=iso(t+offset*60000);return {id,createdAt,forecast:parseForecast(text(extra),snapshot,createdAt)};}
function outcome(id,offset,spot=99){return {...snapshot,id,spot,asOf:iso(t+offset*60000),savedAt:iso(t+offset*60000+1000)};}
test('miss revisions persist, are idempotent, bounded and isolate market/horizon',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hth-strategy-'));
 try{
  const r1=report('one'),r2=report('two',40),snapshots=[outcome('a',30),outcome('b',70)];
  const group=strategyGroup(snapshot,30);
  assert.equal((await reviseStrategies(root,[r1],snapshots,t+29*60000)).length,0);
  const first=await reviseStrategies(root,[r1],snapshots,t+35*60000);
  assert.equal(selectStrategy(first,group,t+35*60000).minSupportingCategories,1);assert.equal(first[0].minSupportingCategories,2);assert.equal(selectStrategy([{...first[0],review:{decision:'approve',createdAt:iso(t+36*60000)}}],group,t+37*60000).minSupportingCategories,2);
  const second=await reviseStrategies(root,[r1,r2],snapshots,t+80*60000);
  assert.equal(second.length,2);assert.equal(selectStrategy(second,group,t+80*60000).minSupportingCategories,1);assert.equal(second[1].minSupportingCategories,3);
  assert.equal(selectStrategy(second,strategyGroup(snapshot,60),t+80*60000).revision,0);
  assert.equal(selectStrategy(second,strategyGroup({...snapshot,symbol:'QQQ'},30),t+80*60000).revision,0);
  await Promise.all([reviseStrategies(root,[r1,r2],snapshots,t+90*60000),reviseStrategies(root,[r1,r2],snapshots,t+90*60000)]);
  assert.equal((await readRevisions(root)).length,2);
  assert.equal(selectStrategy(second,group,t+34*60000).revision,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('overlapping misses do not cause repeated tightening; wins/wait/missing do not revise',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hth-overlap-'));
 try{
  const reports=[report('one'),report('duplicate',1),report('wait',40,{direction:'wait'}),report('win',80),report('missing',120)];
  const result=await reviseStrategies(root,reports,[outcome('a',32),outcome('b',110,101)],t+180*60000);
  assert.equal(result.length,1);assert.equal(result[0].revision,1);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('policy rejects unsupported forecasts without changing original proposal; duplicate signals do not count twice',()=>{
 const policy={...baseline(strategyGroup(snapshot,30)),revision:1,minSupportingCategories:2,requireCounterEvidence:true,requireInvalidation:true};
 const proposal=report('one').forecast;
 const weak=text({supportingSignals:[{category:'price_action',detail:'Price broke above prior resistance.'},{category:'price_action',detail:'Higher price highs are visible.'}],counterEvidence:'Opposing volume remains present.',invalidation:'A close beneath the prior low.'});
 const result=applyStrategy(proposal,weak,policy);
 assert.equal(result.forecast.direction,'wait');assert.equal(proposal.direction,'up');assert.equal(result.decision.accepted,false);
 const strong=text({supportingSignals:[{category:'price_action',detail:'Price broke above prior resistance.'},{category:'volume',detail:'Observed volume expanded on the break.'}],counterEvidence:'Opposing volume remains present.',invalidation:'A close beneath the prior low.'});
 assert.equal(applyStrategy(proposal,strong,policy).decision.accepted,true);
 assert.equal(applyStrategy({...proposal,direction:'wait'},[],policy).decision.accepted,true);
});
test('version statistics exclude pre-change reports from revised strategy results',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hth-version-'));
 try{
  const first=report('one'),prices=[outcome('a',30),outcome('b',70,101)];
  const revisions=await reviseStrategies(root,[first],prices,t+35*60000);
  const second={...report('two',40),strategy:revisions[0]};
  const summary=strategySummary(revisions,[first,second],prices,t+80*60000)[0];
  assert.equal(summary.versions[0].matched,0);assert.equal(summary.versions[0].resolved,1);
  assert.equal(summary.versions[1].matched,1);assert.equal(summary.versions[1].resolved,1);
 }finally{await rm(root,{recursive:true,force:true});}
});

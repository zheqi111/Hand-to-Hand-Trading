import test from 'node:test';
import assert from 'node:assert/strict';
import {parseForecast,evaluateForecast,buildMemory} from './learning.mjs';
const t=Date.parse('2026-11-04T15:00:00Z'),iso=ms=>new Date(ms).toISOString();
const base={id:'base',symbol:'SPY',spot:100,source:'Manual',scope:'0DTE',unit:'Provider units',asOf:iso(t),savedAt:iso(t),rows:[{strike:100,gex:10}]};
const parts=direction=>[{text:'Research\n<forecast>'+JSON.stringify({direction,horizonMinutes:30,reason:'Test hypothesis'})+'</forecast>'}];
const report=(direction='up')=>({id:'r1',createdAt:iso(t),forecast:parseForecast(parts(direction),base,iso(t))});
const later=(offset=30,spot=101,extra={})=>({...base,id:'later',asOf:iso(t+offset*60000),savedAt:iso(t+offset*60000+1000),spot,...extra});
test('forecast requires a bounded predeclared horizon and valid reference price',()=>{
 assert.equal(report().forecast.neutralBandPct,0.2);
 assert.equal(parseForecast([{text:'No outlook'}],base,iso(t)),null);
 assert.equal(parseForecast(parts('maybe'),base,iso(t)),null);
 assert.equal(parseForecast(parts('up'),{...base,spot:NaN},iso(t)),null);
 assert.equal(parseForecast(parts('up').concat(parts('down')),base,iso(t)),null);
});
test('no future outcome leaks into memory cutoff, including late uploads',()=>{
 const candidate=later();
 assert.equal(evaluateForecast(report(),[candidate],t+29*60000).status,'pending');
 assert.equal(evaluateForecast(report(),[candidate],t+30*60000).status,'awaiting_update');
 assert.equal(evaluateForecast(report(),[candidate],t+31*60000).correct,true);
 const late=later(30,101,{savedAt:iso(t+90*60000)});
 assert.equal(buildMemory([report()],[late],base,t+40*60000).examples.length,0);
});
test('outcome matching rejects wrong symbols, source, and outside tolerance',()=>{
 for(const s of [later(36),later(29),later(30,101,{symbol:'QQQ'}),later(30,101,{source:'Other'})]){
  assert.equal(evaluateForecast(report(),[s],t+60*60000).status,'missing_outcome');
 }
});
test('wait, misses and missing data stay distinct; baseline is disclosed',()=>{
 const wait={...report('wait'),id:'wait'},miss={...report('down'),id:'miss'};
 const memory=buildMemory([report(),wait,miss],[later()],base,t+60*60000);
 assert.equal(memory.counts.resolved,2);assert.equal(memory.counts.correct,1);assert.equal(memory.counts.abstained,1);
 assert.equal(memory.groups[0].alwaysUpCorrect,2);
 assert.equal(memory.groups[0].resolved,2);
 assert.match(memory.groups[0].interpretation,/Insufficient/);
});
test('historical retrieval respects comparable regime and metadata',()=>{
 const r=report();const memory=buildMemory([r],[later()],{...base,scope:'all'},t+60*60000);
 assert.equal(memory.examples.length,0);
 assert.equal(memory.counts.resolved,1);
 assert.equal(buildMemory([r],[later()],{...base,rows:[{strike:100,gex:-10}]},t+60*60000).examples.length,0);
});
test('earliest uploaded outcome remains selected when later correction arrives',()=>{
 const first=later(32,99),second=later(30,101,{id:'second',savedAt:iso(t+34*60000)});
 const evaluated=evaluateForecast(report(),[second,first],t+60*60000);
 assert.equal(evaluated.outcomeSnapshotId,'later');assert.equal(evaluated.correct,false);
});
test('exact neutral band boundary is range, not a floating-point directional hit',()=>{
 assert.equal(evaluateForecast(report('range'),[later(30,100.2)],t+60*60000).actual,'range');
 assert.equal(evaluateForecast(report('range'),[later(30,99.8)],t+60*60000).actual,'range');
});

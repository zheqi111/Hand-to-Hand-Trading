import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTradePlan,planState} from './public/trade-plan.js';
const plan={contract:'SPY 600 call expiring 2026-11-12',entryPrice:600,targetPrice:605,stopPrice:598,holdMinutes:60};
test('trade plans require correctly ordered levels for call and put directions',()=>{
 assert.equal(validateTradePlan('Call scenario',plan).basis,'underlying');
 assert.equal(validateTradePlan('Put scenario',{...plan,targetPrice:595,stopPrice:602}).targetPrice,595);
 for(const patch of [{targetPrice:599},{stopPrice:601},{stopPrice:600},{entryPrice:NaN},{targetPrice:Infinity},{holdMinutes:0},{holdMinutes:1.5},{contract:''}])assert.throws(()=>validateTradePlan('Call scenario',{...plan,...patch}));
 assert.throws(()=>validateTradePlan('Put scenario',plan));assert.equal(validateTradePlan('Wait / no trade',null),null);
});
test('expired and incomplete reports never show actionable levels; demo is explicitly distinguished',()=>{
 const report={asOf:'2026-11-05T15:50:00Z',position:'Call scenario',expiresAt:'2026-11-05T16:00:00Z',tradePlan:plan};
 assert.equal(planState(report,Date.parse(report.expiresAt)-1).status,'conditional');
 assert.equal(planState(report,Date.parse(report.expiresAt)).status,'expired');
 assert.equal(planState(report,Date.parse(report.expiresAt)).plan,undefined);
 assert.equal(planState({...report,expiresAt:'invalid'}).status,'expired');
 assert.equal(planState({...report,tradePlan:null},Date.parse(report.expiresAt)-1).status,'incomplete');
 assert.equal(planState({...report,position:'Wait / no trade'}).status,'wait');
 assert.equal(planState({...report,demo:true}).status,'conditional');
});

test('support and resistance require evidence and valid ordering without being confused with exits',()=>{
 const value=validateTradePlan('Call scenario',{...plan,supportPrice:596,resistancePrice:606,levelEvidence:'Five-minute chart, repeated tests at stated observation time.'});assert.equal(value.supportPrice,596);assert.equal(value.stopPrice,598);
 assert.throws(()=>validateTradePlan('Call scenario',{...plan,supportPrice:596}));
 assert.throws(()=>validateTradePlan('Call scenario',{...plan,supportPrice:606,resistancePrice:596,levelEvidence:'Repeated chart tests.'}));
 assert.throws(()=>validateTradePlan('Call scenario',{...plan,supportPrice:NaN}));
 assert.equal(validateTradePlan('Call scenario',plan).supportPrice,undefined);
});

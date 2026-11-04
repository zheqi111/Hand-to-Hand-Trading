import test from 'node:test';
import assert from 'node:assert/strict';
import {filterSetups,maxLoss} from './public/model.js';
test('conservative mode does not invent a trade',()=>assert.deepEqual(filterSetups('Conservative','ALL'),[]));
test('symbol and risk filters are both enforced',()=>{assert.equal(filterSetups('Balanced','SPY').length,1);assert.equal(filterSetups('Balanced','QQQ').length,0);});
test('standard option contract loss uses 100 shares',()=>{assert.equal(maxLoss(4.2),420);assert.equal(maxLoss(3.1,2),620);});
test('invalid position inputs are rejected',()=>{for(const args of [[-1],[NaN],[2,0],[2,1.5]])assert.throws(()=>maxLoss(...args));});

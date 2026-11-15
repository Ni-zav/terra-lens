import test from 'node:test';
import assert from 'node:assert/strict';
import {csvCell} from '../src/csv.js';

test('spreadsheet CSV neutralizes formula-like text but retains negative numbers',()=>{
  assert.equal(csvCell('  =1+1'),'"\'  =1+1"');
  assert.equal(csvCell('@SUM(A1)'),'"\'@SUM(A1)"');
  assert.equal(csvCell('-1+2'),'"\'-1+2"');
  assert.equal(csvCell(-7.8),'"-7.8"');
  assert.equal(csvCell('quoted "value"'),'"quoted ""value"""');
});

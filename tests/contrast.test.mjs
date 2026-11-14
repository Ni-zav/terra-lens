import test from 'node:test';
import assert from 'node:assert/strict';
import {pairedContrast} from '../src/contrast.js';

test('paired difference slope B minus A uses aligned calendar years', () => {
  const a=Array.from({length:24},(_,i)=>({year:2001+i,value:25+.2*i+Math.sin(i)/4}));
  const b=a.map((r,i)=>({year:r.year,value:r.value+3+.04*i}));
  const result=pairedContrast(a,b);
  assert.equal(result.n,24);
  assert.ok(Math.abs(result.classical.slopePerDecade-.4)<1e-10);
  assert.ok(Math.abs(result.hac.slopePerDecade-.4)<1e-10);
  assert.equal(result.excludedYearsA.length,0);
  assert.ok(result.hac.lag>=1);
});
test('missing paired years never substitute zeros or compare unmatched windows',()=>{
 const a=Array.from({length:15},(_,i)=>({year:2001+i,value:i}));
 const b=a.slice(3).map(p=>({...p,value:p.value+.2*p.year}));
 const result=pairedContrast(a,b);
 assert.equal(result.n,12);
 assert.deepEqual(result.excludedYearsA,[2001,2002,2003]);
 assert.equal(pairedContrast(a,b.slice(4)),null);
});
test('noisy constant difference produces finite, nonnegative HAC interval and p in [0,1]',()=>{
 const a=Array.from({length:30},(_,i)=>({year:1985+i,value:i*.12+Math.sin(i)}));
 const b=a.map((p,i)=>({year:p.year,value:p.value+2+Math.sin(i*.78)}));
 const result=pairedContrast(a,b);
 assert.ok(Number.isFinite(result.hac.sePerDecade)&&result.hac.sePerDecade>=0);
 assert.ok(result.hac.pValue>=0&&result.hac.pValue<=1);
 assert.ok(result.hac.ciLowPerDecade<=result.hac.slopePerDecade);
 assert.ok(result.hac.ciHighPerDecade>=result.hac.slopePerDecade);
});
test('reject duplicate annual years',()=>{
 const rows=Array.from({length:12},(_,i)=>({year:2000+i,value:i}));
 assert.throws(()=>pairedContrast([...rows,rows[0]],rows),/Duplicate/);
});

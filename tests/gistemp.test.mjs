import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGISTEMP,rebaseMonthlyAnomalies,compareLocalGlobal} from '../src/science/gistemp.js';
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const example=['Land-Ocean: Global Means','Year,'+months.join(',')+',J-D'];
for(let y=2000;y<=2024;y++)example.push([y,...Array.from({length:12},(_,i)=>((y-2000)*.02+i*.001).toFixed(3)),'***'].join(','));
const csv=example.join('\n');
test('parse GISTEMP actual table layout and reject duplicate years',()=>{
 const g=parseGISTEMP(csv);
 assert.equal(g.series.length,25*12);
 assert.equal(g.series[0].value,0);
 assert.equal(g.originalBaseline,'1951–1980 by calendar month');
 assert.throws(()=>parseGISTEMP(csv+'\n'+example.at(-1)),/Duplicate/);
 assert.throws(()=>parseGISTEMP('bad header'),/header/);
});
test('rebase monthly anomalies with per-calendar-month normals, no hidden gap filling',()=>{
 const parsed=parseGISTEMP(csv);
 const rebased=rebaseMonthlyAnomalies(parsed.series,{baselineStart:2001,baselineEnd:2020});
 assert.equal(rebased.monthly.length,300);
 const jan=rebased.monthly.filter(r=>r.year>=2001&&r.year<=2020&&r.month===1);
 assert.ok(Math.abs(jan.reduce((s,r)=>s+r.value,0))<1e-12);
 assert.throws(()=>rebaseMonthlyAnomalies(parsed.series.filter(r=>!(r.year===2010&&r.month===2))),/complete/);
});
test('align correctly rebased global vs local histories without claiming significance of difference',()=>{
 const global=parseGISTEMP(csv);
 const local=global.series.map(x=>({...x,value:23+x.value*1.3}));
 const result=compareLocalGlobal({localPowerMonthly:local,globalGISTEMP:global,from:2001,to:2024});
 assert.equal(result.schema,'terra-lens-local-global-context-v1');
 assert.equal(result.advanced.sources[0].annual.length,24);
 assert.equal(result.advanced.sources[1].annual.length,24);
 assert.ok(result.simple.pointFittedTrendCPerDecade>result.simple.globalFittedTrendCPerDecade);
 assert.equal(result.advanced.differencesNotTested,true);
 assert.match(result.simple.meaning,/NOT a formal/);
});
test('GISTEMP incomplete final year is excluded from complete-year trend',()=>{
 const altered=csv.replace('2024,','2024,***,');
 const result=parseGISTEMP(altered);
 assert.ok(result.incomplete.some(o=>o.year===2024));
});

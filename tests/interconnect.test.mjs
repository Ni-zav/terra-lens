import test from 'node:test';
import assert from 'node:assert/strict';
import {powerMonthlyContext,alignSWOTandPOWER,descriptiveAssociation,buildWaterCase} from '../src/science/interconnect.js';
import {scienceForAudience} from '../src/science/catalog.js';
const swotMonths=[
 {month:'2025-03',count:2,meanObserved:121,minObserved:120,maxObserved:122,maxQuality:1},
 {month:'2025-04',count:2,meanObserved:131,minObserved:130,maxObserved:132,maxQuality:2},
 {month:'2025-05',count:1,meanObserved:125,minObserved:125,maxObserved:125,maxQuality:1}
];
const power=[{year:2025,month:3,value:2},{year:2025,month:4,value:5},{year:2025,month:5,value:1}];
test('POWER monthly context enforces actual units and unique months',()=>{
 const parsed=powerMonthlyContext(power);
 assert.equal(parsed.length,3);assert.equal(parsed[1].unit,'mm/day');
 assert.throws(()=>powerMonthlyContext([...power,power[0]]),/Duplicate/);
});
test('overlap is transparent, not a fabricated climate causal claim',()=>{
 const aligned=alignSWOTandPOWER(swotMonths,powerMonthlyContext(power));
 assert.equal(aligned.pairs.length,3);
 assert.deepEqual(aligned.excludedSWOTMonthsMissingPOWER,[]);
 assert.equal(aligned.pairs[1].swotPasses,2);
 assert.match(aligned.interpretation,/NOT physically harmonized/);
 const insufficient=descriptiveAssociation(aligned.pairs);
 assert.equal(insufficient.status,'insufficient');
 assert.equal(insufficient.n,3);
});
test('descriptive association returns no causal p-value or significance claim',()=>{
 const pairs=Array.from({length:8},(_,i)=>({powerValue:i,swotMeanObservedM:i*2}));
 const result=descriptiveAssociation(pairs);
 assert.equal(result.status,'descriptive');
 assert.ok(Math.abs(result.pearsonR-1)<1e-12);
 assert.equal('pValue' in result,false);
 assert.match(result.inference,/No p-value/);
});
test('builds separate plain-language and raw evidence contract',()=>{
 const swot={source:'NASA SWOT',collection:'SWOT_L2_HR_RiverSP_D',sourceURL:'https://example',retrievedAt:'2026-11-14Z',
  observations:[{time:'2025-03-01T00:00:00Z',value:120},{time:'2025-05-01T00:00:00Z',value:131}],
  monthly:swotMonths,excluded:[],qualityCounts:{1:2},quantity:'wse',unit:'m'};
 const powerObj={source:'NASA POWER',url:'https://example2',fetchedAt:'2026-11-14Z',monthly:power};
 const product=buildWaterCase({swot,power:powerObj,contextLocation:'Nearby Louisville POWER grid point'});
 assert.equal(product.schema,'terra-lens-cross-source-water-v1');
 assert.equal(product.simple.commonMonths,3);
 assert.match(product.simple.limitation,/Neither indicates a forecast/);
 assert.equal(product.advanced.harmonization.pairs.length,3);
 assert.equal(product.advanced.association.status,'insufficient');
});
test('catalog exposes honest live vs planned source status',()=>{
 const simple=scienceForAudience();
 assert.ok(simple.sources.some(s=>s.id==='nasa-swot-river'&&s.integration==='dated-official-snapshot'));
 assert.ok(!simple.sources.some(s=>s.id==='gpm-imerg'));
 const advanced=scienceForAudience({advanced:true});
 assert.ok(advanced.sources.some(s=>s.id==='gpm-imerg'&&s.integration==='planned'));
 assert.ok(advanced.questions.some(q=>q.id==='vegetation-heat'));
});

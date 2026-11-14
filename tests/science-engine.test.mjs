import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {analyzeRiverContext,analyzeLocalGlobal,SCIENCE_QUESTIONS} from '../src/science/index.js';
const reach='74267300251';
const swotCsv=['reach_id,time_str,wse,wse_u,width,reach_q,crid',
  '74267300251,2025-03-22T23:55:38Z,120.84,0.1,800,2,PGD0',
  '74267300251,2025-03-23T13:09:48Z,122.49,0.1,772,1,PGD0',
  '74267300251,2025-04-12T20:40:43Z,131.24,0.1,950,1,PGD0',
  '74267300251,2025-04-23T19:03:35Z,121.05,0.1,746,1,PGD0',
  '74267300251,2025-05-03T17:25:47Z,122.07,0.1,757,1,PGD0'].join('\n');
const responseFrom=monthly=>({ok:true,headers:{get:()=> 'application/json'},
  json:async()=>({header:{title:'SYNTHETIC TEST ONLY'},properties:{parameter:monthly}})});
const fakePOWER=(url)=> {
  const u=new URL(url,'https://example.test');
  const code=u.searchParams.get('parameters')||'PRECTOTCORR';
  const start=Number(u.searchParams.get('start'));
  const end=Number(u.searchParams.get('end'));
  const series={};
  for(let y=start;y<=end;y++)for(let m=1;m<=12;m++)
    series[String(y)+String(m).padStart(2,'0')]=Number((12+(y-start)*.04+m*.02).toFixed(4));
  return responseFrom({[code]:series});
};
test('river simple and advanced contract composes two mock NASA sources only in tests',async()=>{
  const result=await analyzeRiverContext({},{
    swotFetcher:async()=>({ok:true,json:async()=>({results:{csv:swotCsv}})}),
    powerFetcher:async url=>fakePOWER(url)
  });
  assert.equal(result.schema,'terra-lens-cross-source-water-v1');
  assert.equal(result.advanced.sourceA.overpasses.length,5);
  assert.equal(result.simple.commonMonths,3);
  assert.match(result.simple.limitation,/Neither indicates a forecast/);
  assert.equal(result.advanced.association.status,'insufficient');
  assert.equal(result.context.featureId,reach);
});
test('local-vs-global engine can use dated original NASA text and a test-only POWER fetcher',async()=>{
  const source=await readFile(new URL('../data/source-snapshots/nasa-giss-gistemp-global-2001-2024.txt',
    import.meta.url),'utf8');
  const result=await analyzeLocalGlobal({gistempSourceText:source},{
    powerFetcher:async url=>fakePOWER(url)
  });
  assert.equal(result.schema,'terra-lens-local-global-context-v1');
  assert.equal(result.advanced.sources[0].annual.length,24);
  assert.equal(result.advanced.sources[1].annual.length,24);
  assert.equal(result.simple.baseline,'2001–2020');
  assert.match(result.simple.meaning,/NOT a formal/);
  assert.ok(result.context.localSourceURL.includes('power.larc.nasa.gov'));
});
test('engine rejects invalid coordinate and time support without NASA calls',async()=>{
  await assert.rejects(analyzeRiverContext({powerPoint:{lat:100,lon:10}}),/latitude/);
  await assert.rejects(analyzeLocalGlobal({powerPoint:{lat:0,lon:-181}}),/latitude/);
  assert.ok(SCIENCE_QUESTIONS.some(q=>q.id==='global-local-temperature'));
});

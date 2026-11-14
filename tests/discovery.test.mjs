import test from 'node:test';
import assert from 'node:assert/strict';
import {SENTINEL_POINTS, samplePoints, summarizeDiscovery, makeResearchBrief, discoveryEvidence} from '../src/discovery.js';

function monthlyFor(slope,missingYear=null) {
  return Array.from({length:20},(_,j)=>2001+j).flatMap(y=>
    Array.from({length:12},(_,i)=>({year:y,month:i+1,value:20+slope*(y-2001)}))
      .filter(r=>r.year!==missingYear));
}
const points=SENTINEL_POINTS.slice(0,3);
const fakeFetch=async ({lat})=>({
  monthly:monthlyFor(lat===points[0].lat?-0.03:lat===points[1].lat?0.02:0.05),
  url:'https://power.larc.nasa.gov/example',source:'NASA POWER fixture',fetchedAt:'2026-11-14T00:00:00Z'
});
test('bounded sampling is ordered and preserves raw months even when responses finish out of order',async()=>{
  let running=0,max=0;
  const records=await samplePoints({points,variable:'T2M',start:2001,end:2020,concurrency:2,
    fetchPoint:async (...args)=>{
      running++;max=Math.max(max,running);
      if(args[0].lat===points[0].lat) await new Promise(r=>setTimeout(r,8));
      const response=await fakeFetch(...args);running--;return response;
    }});
  assert.deepEqual(records.map(r=>r.id),points.map(p=>p.id));
  assert.equal(max,2);
  assert.equal(records[0].monthly.length,240);
  assert.equal(records[0].annual.length,20);
  assert.equal(records[0].status,'ok');
  const sum=summarizeDiscovery(records,points);
  assert.equal(sum.completed,true);
  assert.equal(sum.low.label,points[0].label);
  assert.equal(sum.high.label,points[2].label);
  assert.equal(sum.oppositeSigns,true);
  assert.equal(sum.candidatePairs,3);
  assert.ok(sum.selectedPair);
  assert.equal(sum.selectedPair.n,20);
  const brief=makeResearchBrief(sum,'T2M',2001,2020);
  assert.match(brief.finding,/opposite signs/);
  assert.match(brief.uncertainty,/post-selection/);
});
test('failed and insufficient points are reported, not silently dropped',async()=>{
  const records=await samplePoints({points,variable:'PRECTOTCORR',start:2001,end:2020,
    fetchPoint:async ({lat})=>{
      if(lat===points[1].lat)throw Error('HTTP 429');
      if(lat===points[2].lat)return {monthly:monthlyFor(.2,2004)};
      return fakeFetch({lat});
    }});
  const sum=summarizeDiscovery(records,points);
  assert.equal(sum.failures.length,1);
  assert.equal(sum.failures[0].error,'HTTP 429');
  assert.equal(sum.insufficient.length,0);
  assert.equal(sum.ranked.length,2);
  assert.equal(sum.ranked[1].annual.length,19);
  const evidence=discoveryEvidence({records,variable:'PRECTOTCORR',start:2001,end:2020});
  assert.equal(evidence.count.failures,1);
  assert.equal(evidence.records.length,3);
  assert.match(evidence.brief.doNotConclude,/NOT annual rainfall total/);
});
test('incomplete annual coverage is recorded without inventing a slope',async()=>{
  const records=await samplePoints({points:points.slice(0,2),variable:'T2M',start:2001,end:2020,
    fetchPoint:async ({lat})=>({monthly:monthlyFor(.1).filter(r=>r.year<2009&&r.month!==2)})});
  assert.ok(records.every(r=>r.status==='insufficient-years'));
  const sum=summarizeDiscovery(records,points.slice(0,2));
  assert.equal(sum.ranked.length,0);
  assert.equal(sum.selectedPair,null);
});
test('cancellation halts the scan and cannot generate a completed ranking',async()=>{
  const controller=new AbortController();
  await assert.rejects(samplePoints({points,variable:'T2M',start:2001,end:2020,signal:controller.signal,
    fetchPoint:async ()=>{controller.abort();throw Error('Aborted');}}),{name:'AbortError'});
});
test('rejects excess concurrency, invalid period, and duplicate IDs',async()=>{
  const req={points,variable:'T2M',start:2001,end:2020,fetchPoint:fakeFetch};
  await assert.rejects(samplePoints({...req,concurrency:4}),/Concurrency/);
  await assert.rejects(samplePoints({...req,end:2005}),/at least 10/);
  await assert.rejects(samplePoints({...req,points:[points[0],points[0]]}),/uniquely/);
});

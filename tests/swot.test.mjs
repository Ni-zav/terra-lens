import test from 'node:test';
import assert from 'node:assert/strict';
import {SWOT_EXAMPLE,swotRequestURL,parseSWOTHydrocron,swotMonthlySnapshots} from '../src/science/swot.js';
const sample=['reach_id,time_str,wse,wse_u,width,reach_q,crid,wse_units',
'74267300251,2025-03-22T23:55:38Z,120.8400,0.10,800,2,PGD0,m',
'74267300251,2025-03-23T13:09:48Z,122.4912,0.11,772,1,PGD0,m',
'74267300251,2025-04-12T20:40:43Z,131.2465,0.09,956,1,PGD0,m',
'74267300251,no_data,-999999999999.0,,0,3,PGD0,m',
'74267300251,2025-04-23T19:03:35Z,121.055,0.11,746,1,PGD0,m'].join('\n');
const request={featureId:SWOT_EXAMPLE.featureId,start:SWOT_EXAMPLE.start,end:SWOT_EXAMPLE.end};
test('Hydrocron URL locks product and fields, rejects unsafe or invalid selectors',()=>{
 const url=new URL(swotRequestURL(request));
 assert.equal(url.hostname,'soto.podaac.earthdatacloud.nasa.gov');
 assert.equal(url.searchParams.get('collection_name'),'SWOT_L2_HR_RiverSP_D');
 assert.match(url.searchParams.get('fields'),/reach_q/);
 assert.throws(()=>swotRequestURL({...request,featureId:'abc'}),/11-digit/);
 assert.throws(()=>swotRequestURL({...request,end:request.start}),/precede/);
 assert.throws(()=>swotRequestURL({...request,collection:'evil'}),/Unsupported/);
});
test('SWOT keeps pass-time and QA, discards Hydrocron fill/no_data without zero substitution',()=>{
 const parsed=parseSWOTHydrocron({results:{csv:sample}},{featureId:SWOT_EXAMPLE.featureId});
 assert.equal(parsed.rawRows,5);
 assert.equal(parsed.observations.length,4);
 assert.equal(parsed.excluded.length,1);
 assert.equal(parsed.excluded[0].reason,'no-observation');
 assert.deepEqual(parsed.observations.map(x=>x.quality),[2,1,1,1]);
 assert.deepEqual(parsed.qualityCounts,{0:0,1:3,2:1,3:0});
 const months=swotMonthlySnapshots(parsed);
 assert.deepEqual(months.map(x=>x.month),['2025-03','2025-04']);
 assert.equal(months[0].count,2);
 assert.ok(Math.abs(months[0].meanObserved-(120.84+122.4912)/2)<1e-12);
 assert.match(months[1].support,/NOT a time-weighted/);
});
test('QA threshold, duplicate and mismatched rows are visible as exclusions',()=>{
 const duplicated=sample+'\n74267300251,2025-04-23T19:03:35Z,999,0.1,20,1,PGD0,m';
 const r=parseSWOTHydrocron({results:{csv:duplicated}},{featureId:SWOT_EXAMPLE.featureId,maxQuality:1});
 assert.equal(r.observations.length,3);
 assert.ok(r.excluded.some(x=>x.reason==='quality-filter'));
 assert.ok(r.excluded.some(x=>x.reason==='duplicate-time'));
 assert.throws(()=>parseSWOTHydrocron({results:{csv:sample}},{featureId:'12345678901',maxQuality:4}),/Quality/);
});
test('CSV parser detects missing required columns, malformed quote and fails closed',()=>{
 assert.throws(()=>parseSWOTHydrocron({results:{csv:'id,time\n1,2'}}),/required/);
 assert.throws(()=>parseSWOTHydrocron({results:{csv:'reach_id,time_str,wse,wse_u,width,reach_q,crid\n"unclosed'}}),/unclosed quote/);
 assert.throws(()=>parseSWOTHydrocron({results:{csv:'something'}},{maxQuality:2}),/required/);
});

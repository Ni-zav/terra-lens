import test from 'node:test';
import assert from 'node:assert/strict';
import {cmrCollectionURL,searchCmrCollections} from '../src/cmr.js';
const region={west:'110',south:'-8',east:'111',north:'-7',start:'2001',end:'2024'};
test('CMR collection request is scoped and validates inputs',()=>{
 const u=new URL(cmrCollectionURL('soil moisture',region));
 assert.equal(u.origin,'https://cmr.earthdata.nasa.gov');assert.equal(u.searchParams.get('bounding_box'),'110,-8,111,-7');
 assert.equal(u.searchParams.get('temporal'),'2001-01-01T00:00:00Z,2024-12-31T23:59:59Z');
 assert.equal(u.searchParams.get('page_size'),'10');
 assert.throws(()=>cmrCollectionURL('a',region),/2–100/);
 assert.throws(()=>cmrCollectionURL('water',{...region,west:170,east:-170}),/bounds/);
});
test('CMR results use verified IDs, bounded cache and no invented availability',async()=>{
 let calls=0,clock=1000000;
 const fetcher=async()=>{calls++;return {ok:true,json:async()=>({feed:{entry:[{id:'C1276812859-GES_DISC',title:'Test collection',short_name:'TEST',version_id:'1',time_start:'2001-01-01T00:00:00Z'},{id:'javascript:bad',title:'bad'}]}})}};
 let a=await searchCmrCollections('test unique',region,{fetcher,now:()=>clock});
 assert.equal(a.entries.length,1);assert.equal(a.entries[0].end,null);assert.match(a.entries[0].url,/C1276812859-GES_DISC/);assert.equal(a.cached,false);
 a=await searchCmrCollections('test unique',region,{fetcher,now:()=>clock});assert.equal(a.cached,true);assert.equal(calls,1);
 clock+=15*60*1000;a=await searchCmrCollections('test unique',region,{fetcher,now:()=>clock});assert.equal(a.cached,false);assert.equal(calls,2);
 await assert.rejects(searchCmrCollections('failure unique',region,{fetcher:async()=>({ok:false,status:503})}),/503/);
});

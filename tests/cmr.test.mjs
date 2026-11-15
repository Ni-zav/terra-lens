import test from 'node:test';
import assert from 'node:assert/strict';
import {cmrCollectionURL,searchCmrCollections,searchCmrVariables} from '../src/cmr.js';
const region={west:'110',south:'-8',east:'111',north:'-7',start:'2001',end:'2024'};
test('CMR collection request is scoped and validates inputs',()=>{
 const u=new URL(cmrCollectionURL('soil moisture',region));
 assert.equal(u.origin,'https://cmr.earthdata.nasa.gov');assert.equal(u.searchParams.get('bounding_box'),'110,-8,111,-7');
 assert.equal(u.searchParams.get('temporal'),'2001-01-01T00:00:00Z,2024-12-31T23:59:59Z');
 assert.equal(u.searchParams.get('page_size'),'10');
 assert.throws(()=>cmrCollectionURL('a',region),/2–100/);
 assert.throws(()=>cmrCollectionURL('water',{...region,west:170,east:-170}),/bounds/);
});
test('CMR variables require explicit collection association and retain documented units and fill',async()=>{
 const fetcher=async url=>({ok:true,json:async()=>({hits:101,items:[
  {meta:{'concept-id':'V123-TEST'},umm:{Name:'T2M',LongName:'temperature',Units:'K',FillValues:[{Value:1e15}]},associations:{collections:[{'concept-id':'C123-TEST'}]}},
  {meta:{'concept-id':'V124-TEST'},umm:{Name:'WRONG',Units:'K'},associations:{collections:[{'concept-id':'C999-TEST'}]}},
  {meta:{'concept-id':'V125-TEST'},umm:{Name:'UNKNOWN'}}]})});
 const r=await searchCmrVariables('C123-TEST',{fetcher,now:()=>1000000});
 assert.equal(r.entries.length,1);assert.equal(r.entries[0].name,'T2M');assert.equal(r.entries[0].unit,'K');assert.deepEqual(r.entries[0].fillValues,['1000000000000000']);assert.equal(r.truncated,true);
 assert.equal(new URL(r.url).searchParams.get('keyword'),'C123-TEST');
 const cached=await searchCmrVariables('C123-TEST',{fetcher,now:()=>1000001});assert.equal(cached.cached,true);
 await assert.rejects(searchCmrVariables('javascript:bad',{fetcher}),/Invalid/);
 await assert.rejects(searchCmrVariables('C456-TEST',{fetcher:async()=>({ok:false,status:503})}),/503/);
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

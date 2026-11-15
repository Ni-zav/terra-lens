/** Bounded collection discovery via NASA's public CMR. Metadata discovery is
 * not proof of variable compatibility, granule availability or data quality. */
const ENDPOINT='https://cmr.earthdata.nasa.gov/search/collections.json';
const TTL=15*60*1000, cache=new Map();
export function cmrCollectionURL(keyword,region) {
 const term=String(keyword??'').trim();
 if(term.length<2||term.length>100)throw Error('Enter a search term of 2–100 characters.');
 const vals=['west','south','east','north'].map(k=>String(region[k]??'').trim()===''?NaN:Number(region[k]));
 const [w,s,e,n]=vals,first=Number(region.start),last=Number(region.end);
 if(vals.some(v=>!Number.isFinite(v))||w < -180||e>180||s < -90||n>90||w>=e||s>=n)
  throw Error('Enter valid non-antimeridian bounds.');
 if(!Number.isInteger(first)||!Number.isInteger(last)||first<1900||last>2100||first>last)
  throw Error('Enter a valid range of whole years.');
 const q=new URLSearchParams({keyword:term,bounding_box:vals.join(','),temporal:`${first}-01-01T00:00:00Z,${last}-12-31T23:59:59Z`,page_size:'10'});
 return `${ENDPOINT}?${q}`;
}
export async function searchCmrCollections(keyword,region,{fetcher=fetch,signal,now=Date.now}={}) {
 const url=cmrCollectionURL(keyword,region),hit=cache.get(url),t=now();
 if(hit&&t-hit.time<TTL)return {...hit.data,cached:true};
 const response=await fetcher(url,{signal});
 if(!response.ok)throw Error(`NASA catalog request failed (HTTP ${response.status}).`);
 const json=await response.json();
 if(!Array.isArray(json?.feed?.entry))throw Error('NASA catalog returned an unexpected response.');
 const entries=json.feed.entry.slice(0,10).filter(e=>/^C\d+-[A-Za-z0-9_]+$/.test(e.id||''))
  .map(e=>({id:e.id,title:String(e.title||e.short_name||e.id),shortName:String(e.short_name||''),version:String(e.version_id||''),
   start:e.time_start||null,end:e.time_end||null,url:`https://search.earthdata.nasa.gov/search/granules?p=${encodeURIComponent(e.id)}`}));
 const data={url,entries,retrievedAt:new Date(t).toISOString()};
 if(cache.size>=25)cache.delete(cache.keys().next().value);
 cache.set(url,{time:t,data});return {...data,cached:false};
}

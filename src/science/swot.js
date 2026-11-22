/**
 * NASA SWOT RiverSP water-surface elevation via NASA PO.DAAC Hydrocron.
 * Real observations are irregular satellite overpasses, never daily gauges.
 * See https://podaac.github.io/hydrocron/timeseries/
 */
export const HYDROCRON_URL='https://soto.podaac.earthdatacloud.nasa.gov/hydrocron/v1/timeseries';
export const SWOT_RIVER_COLLECTION='SWOT_L2_HR_RiverSP_D';
export const SWOT_EXAMPLE=Object.freeze({
  feature:'Reach',featureId:'74267300251',
  start:'2025-03-15T00:00:00Z',end:'2025-05-16T00:00:00Z',
  context:'Ohio River reach near Louisville, Kentucky, USA; SWORD reach identifier from an independent NASA SWOT hydrology training example. Not a flood forecast.'
});
function dateString(value){
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(value)||!Number.isFinite(Date.parse(value)))
    throw new RangeError('SWOT time must be a UTC ISO-8601 timestamp');
  return value;
}
export function swotRequestURL({featureId,start,end,collection=SWOT_RIVER_COLLECTION}){
  const id=String(featureId??'');
  if(!/^\d{11}$/.test(id))throw new RangeError('Expected an 11-digit SWORD river reach ID');
  if(!['SWOT_L2_HR_RiverSP_D','SWOT_L2_HR_RiverSP_2.0'].includes(collection))
    throw new RangeError('Unsupported SWOT RiverSP collection');
  const first=dateString(start),last=dateString(end);
  if(first>=last)throw new RangeError('SWOT start must precede end');
  if(Date.parse(last)-Date.parse(first)>1000*60*60*24*365*4)
    throw new RangeError('Limit a Hydrocron request to four years');
  return HYDROCRON_URL+'?'+new URLSearchParams({
    feature:'Reach',feature_id:id,start_time:first,end_time:last,
    collection_name:collection,output:'csv',
    fields:'reach_id,time_str,wse,wse_u,width,reach_q,crid'
  });
}
function csvRecords(csv){
  if(typeof csv!=='string'||csv.length>3e6)throw new Error('Hydrocron CSV missing or too large');
  const records=[];let row=[],cell='',quoted=false;
  for(let i=0;i<csv.length;i++){
    const c=csv[i];
    if(c==='"'){
      if(quoted&&csv[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
    }else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){
      if(c==='\r'&&csv[i+1]==='\n')i++;
      row.push(cell);cell='';if(row.some(v=>v!==''))records.push(row);
      row=[];
    }else cell+=c;
  }
  if(quoted)throw new Error('Hydrocron CSV has an unclosed quote');
  row.push(cell);if(row.some(v=>v!==''))records.push(row);
  if(!records.length)throw new Error('Hydrocron CSV empty');
  const columns=records.shift();
  if(new Set(columns).size!==columns.length)throw new Error('Duplicate Hydrocron CSV headers');
  const required=['reach_id','time_str','wse','wse_u','width','reach_q','crid'];
  if(required.some(k=>!columns.includes(k)))throw new Error('Hydrocron CSV has missing required fields');
  return records.map(values=>{
    if(values.length!==columns.length)throw new Error('Hydrocron CSV has mismatched columns');
    return Object.fromEntries(columns.map((column,i)=>[column,values[i]]));
  });
}
function numberOrNull(raw){
  if(raw==null||String(raw).trim()==='')return null;
  const n=Number(raw);
  // NASA Hydrocron invalid measurement sentinel is -999999999999.0.
  return Number.isFinite(n)&&n>-1e10?n:null;
}
export function parseSWOTHydrocron(payload,{featureId,maxQuality=2}={}){
  if(!Number.isInteger(maxQuality)||maxQuality<0||maxQuality>2)
    throw new RangeError('Quality threshold must be 0, 1 or 2');
  if(!payload||typeof payload!=='object'||typeof payload.results?.csv!=='string')
    throw new Error('Expected Hydrocron JSON response with results.csv');
  const rows=csvRecords(payload.results.csv),observations=[],excluded=[];
  const seen=new Set();
  for(const row of rows){
    const time=Date.parse(row.time_str);
    const wse=numberOrNull(row.wse),quality=numberOrNull(row.reach_q);
    const id=row.reach_id;
    const observationTime=Number.isFinite(time)?new Date(time).toISOString():null;
    let reason=null;
    if(featureId&&String(featureId)!==String(id))reason='unexpected-reach';
    else if(/^no_data$/i.test(row.time_str.trim()))reason='no-observation';
    else if(!Number.isFinite(time))reason='invalid-time';
    else if(seen.has(observationTime))reason='duplicate-time';
    else if(wse===null)reason='missing-water-height';
    else if(!Number.isInteger(quality)||quality<0||quality>3)reason='invalid-quality';
    else if(quality>maxQuality)reason='quality-filter';
    if(reason){excluded.push({time:row.time_str||null,reason,quality});continue;}
    seen.add(observationTime);
    observations.push({
      time:observationTime,
      year:new Date(time).getUTCFullYear(),month:new Date(time).getUTCMonth()+1,
      value:wse,unit:'m',quality,
      width:numberOrNull(row.width),
      reportedUncertainty:numberOrNull(row.wse_u),
      crid:row.crid||null,
      reachId:String(id)
    });
  }
  observations.sort((a,b)=>a.time.localeCompare(b.time));
  return {
    source:'NASA SWOT via PO.DAAC Hydrocron',collection:SWOT_RIVER_COLLECTION,
    quantity:'water surface elevation above reference geoid (not river depth or flood extent)',
    temporalSupport:'irregular satellite overpass snapshots',
    spatialSupport:'identified SWORD river reach, not a point rain gauge or a whole watershed',
    unit:'m',maxQuality,rawRows:rows.length,observations,excluded,
    qualityCounts:Object.fromEntries([0,1,2,3].map(q=>[q,observations.filter(o=>o.quality===q).length])),
    caveat:'Quality 1=suspect, 2=degraded; 0 may be rare. Reported wse_u is not guaranteed validated uncertainty. Hydrocron observations are not a daily continuous water-level record.'
  };
}
export function swotMonthlySnapshots(parsed){
  const map=new Map();
  for(const o of parsed.observations){
    const key=o.time.slice(0,7);
    if(!map.has(key))map.set(key,[]);
    map.get(key).push(o);
  }
  return [...map].sort(([a],[b])=>a.localeCompare(b)).map(([month,values])=>{
    const heights=values.map(v=>v.value);
    return {month,count:values.length,
      meanObserved:heights.reduce((a,b)=>a+b,0)/values.length,
      minObserved:Math.min(...heights),maxObserved:Math.max(...heights),
      maxQuality:Math.max(...values.map(v=>v.quality)),
      support:'observed satellite passes only; NOT a time-weighted monthly mean'};
  });
}
export async function fetchSWOT(options,{fetcher=fetch,signal}={}){
  const url=swotRequestURL(options),response=await fetcher(url,{signal,headers:{accept:'application/json'}});
  if(!response.ok)throw new Error('NASA Hydrocron HTTP '+response.status);
  const json=await response.json();
  const data=parseSWOTHydrocron(json,{featureId:options.featureId,maxQuality:options.maxQuality??2});
  if(!data.observations.length)throw new Error('NASA Hydrocron returned no usable SWOT overpasses at this quality threshold');
  return {...data,collection:options.collection||SWOT_RIVER_COLLECTION,sourceURL:url,
    retrievedAt:new Date().toISOString(),monthly:swotMonthlySnapshots(data)};
}

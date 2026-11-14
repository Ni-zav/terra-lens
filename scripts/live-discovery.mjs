/**
 * Independent live-network evidence for the branch-only eight-point explorer.
 * This script NEVER generates source observations; it downloads NASA POWER JSON.
 * Unlike deterministic tests, it fails when the source is unavailable.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SENTINEL_POINTS,samplePoints,summarizeDiscovery,discoveryEvidence} from '../src/discovery.js';
import {parseMonthly,requestURL} from '../src/power.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const out=join(root,'artifacts','discovery-nasa-evidence.json');
const variable=process.env.DISCOVERY_VARIABLE||'T2M',start=2001,end=2024;
async function fetchOriginal(options,{signal}={}) {
  const url=requestURL(options);
  const boundedSignal=AbortSignal.any([signal??new AbortController().signal,AbortSignal.timeout(120000)]);
  let response;
  for(let attempt=0;attempt<2;attempt++) {
    response=await fetch(url,{signal:boundedSignal,headers:{accept:'application/json'}});
    if(response.ok)break;
    if(attempt===0&&[429,500,502,503,504].includes(response.status)) {
      await new Promise(resolve=>setTimeout(resolve,2000));
      continue;
    }
    throw Error('NASA HTTP '+response.status+' for '+options.lat+','+options.lon);
  }
  const payload=await response.json();
  const monthly=parseMonthly(payload,options.variable,options);
  if(monthly.length===0)throw Error('NASA POWER response contained no valid monthly data');
  return {monthly,url,fetchedAt:new Date().toISOString(),
    source:'NASA POWER / MERRA-2-derived meteorological reanalysis',
    metadata:payload.header||{},coordinate:payload.geometry?.coordinates};
}
const records=await samplePoints({points:SENTINEL_POINTS,variable,start,end,concurrency:2,
  fetchPoint:fetchOriginal,onProgress:({completed,total,records})=>
    console.log('NASA samples '+completed+'/'+total+'; completed: '+records.map(r=>r.label+':'+r.status).join(', '))});
const summary=summarizeDiscovery(records);
const evidence=discoveryEvidence({records,variable,start,end,
  selected:{A:summary.low?.id||null,B:summary.high?.id||null}});
evidence.selectedPairedContrast=summary.selectedPair;
evidence.validationContext='Real NASA POWER direct API; not a challenge-listed resource membership certificate. Post-selected HAC is exploratory, not confirmatory.';
await mkdir(join(root,'artifacts'),{recursive:true});
await writeFile(out,JSON.stringify(evidence,null,2)+'\n');
console.log('Evidence written to '+out);
console.log(JSON.stringify({source:'NASA POWER (real network)',variable,start,end,
  expected:summary.expectedCount,received:summary.receivedCount,validTrends:summary.ranked.length,
  errors:summary.failures.map(r=>({id:r.id,error:r.error})),
  insufficient:summary.insufficient.map(r=>r.id),
  each:records.map(r=>({name:r.label,status:r.status,months:r.monthly.length,
    annual:r.annual.length,slope:r.trend?.slopePerDecade,sourceURL:r.sourceURL})),
  descriptiveExtremes:summary.low&&summary.high?{lowest:summary.low.label,highest:summary.high.label}:null,
  pairedHAC:summary.selectedPair?.hac,
  caveat:'Selected pair is post hoc; p/CI NOT confirmatory.'},null,2));
if(!summary.completed||summary.failures.length||summary.insufficient.length||summary.ranked.length!==SENTINEL_POINTS.length)
  throw Error('The predeclared eight-point real NASA sample is incomplete; cannot certify full screen.');

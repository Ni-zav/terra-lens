/** Direct NASA SWOT + POWER real-data run, with no mock measurements. */
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {SWOT_EXAMPLE,fetchSWOT} from '../src/science/swot.js';
import {requestURL,parseMonthly} from '../src/power.js';
import {buildWaterCase} from '../src/science/interconnect.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=join(root,'artifacts','swot-nasa-water-case.json');
const options={...SWOT_EXAMPLE};
async function retrieveNASA(url){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),105000);
  try {
    const response=await fetch(url,{signal:controller.signal,headers:{accept:'application/json'}});
    if(!response.ok)throw new Error('NASA source HTTP '+response.status);
    return await response.json();
  }finally{clearTimeout(timeout);}
}
const swot=await fetchSWOT(options,{fetcher:async url=>{
  const payload=await retrieveNASA(url);
  return {ok:true,json:async()=>payload};
}});
const url=requestURL({lat:38.2527,lon:-85.7585,variable:'PRECTOTCORR',start:2025,end:2025});
const payload=await retrieveNASA(url);
const power={source:'NASA POWER / MERRA-2-derived model point',url,
  fetchedAt:new Date().toISOString(),monthly:parseMonthly(payload,'PRECTOTCORR',{start:2025,end:2025}),
  metadata:payload.header||{}};
const caseStudy=buildWaterCase({swot,power,
  contextLocation:'SWOT SWORD reach 74267300251 (Ohio River near Louisville); POWER grid-point sample near Louisville (38.2527,-85.7585). Not necessarily upstream watershed precipitation.'});
const audit={schema:'terra-lens-swot-nasa-water-evidence-v1',createdAt:new Date().toISOString(),
  notes:'Fetched live from NASA Hydrocron and NASA POWER. Quality flags and temporal support are retained. No flood forecast or statistically supported rainfall causality.',
  swot,power,caseStudy};
if(swot.observations.length<5||swot.monthly.length<2)throw Error('Fewer than five usable SWOT overpasses or two observed months');
if(power.monthly.length!==12)throw Error('NASA POWER year is incomplete');
if(caseStudy.advanced.harmonization.pairs.length<2)throw Error('No two matched context months');
await mkdir(join(root,'artifacts'),{recursive:true});
await writeFile(output,JSON.stringify(audit,null,2)+'\n');
console.log('NASA sources verified: SWOT '+swot.observations.length+' overpasses / '+swot.monthly.length+
 ' observed months; POWER '+power.monthly.length+' model months; aligned '+caseStudy.advanced.harmonization.pairs.length+' context months.');
console.log('SWOT source URL: '+swot.sourceURL);
console.log('POWER source URL: '+power.url);
console.log('SWOT heights: '+Math.min(...swot.observations.map(o=>o.value)).toFixed(4)+' to '+
 Math.max(...swot.observations.map(o=>o.value)).toFixed(4)+' meters (pass-only extremes)');
console.log('QA counts '+JSON.stringify(swot.qualityCounts)+'; excluded '+swot.excluded.length);
console.log('Simple case '+JSON.stringify(caseStudy.simple));
console.log('Evidence written: '+output);

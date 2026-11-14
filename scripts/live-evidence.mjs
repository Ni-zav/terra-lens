/**
 * One-shot LIVE NASA verification. Not a synthetic test fixture.
 * Saves an audit artifact; fails rather than inventing substitute observations.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {fetchNASA,VARIABLES} from '../src/power.js';
import {annualMeans,linearTrend} from '../src/stats.js';

const locations=[
  {name:'Yogyakarta',lat:-7.7956,lon:110.3695},
  {name:'Jakarta',lat:-6.2088,lon:106.8456}
];
const variable='T2M',start=2001,end=2024;
const options=locations.map(async location=>{
  const input={lat:location.lat,lon:location.lon,variable,start,end};
  const {monthly,url,fetchedAt,metadata,coordinate}=await fetchNASA(input,{
    signal:AbortSignal.timeout(100000)
  });
  const annual=annualMeans(monthly);
  const trend=linearTrend(annual);
  if(monthly.length<120 || !trend) throw new Error('Incomplete NASA data for '+location.name);
  return {
    ...location,variable,unit:VARIABLES[variable].unit,
    source:'NASA POWER monthly point API; NASA GMAO MERRA-2 model-derived data',
    url,fetchedAt,metadata,apiGeometryCoordinates:coordinate,
    validMonths:monthly.length,completeYears:annual.length,
    firstAnnual:annual[0],lastAnnual:annual.at(-1),
    trendPerDecade:trend.slopePerDecade,CI95:[trend.ciLowPerDecade,trend.ciHighPerDecade],
    pValueClassicalOLS:trend.pValue,significantConditionalOnAssumptions:trend.significant,
    annualSeries:annual,
    interpretationWarning:'Point-level reanalysis; OLS assumes independent residuals; no causal or forecast claim.'
  };
});
const cases=await Promise.all(options);
const evidence={
  title:'Terra-Lens live NASA source audit',kind:'LIVE_NASA_RESPONSE_NOT_MOCK',
  generatedAt:new Date().toISOString(),records:cases
};
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/nasa-evidence.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({
  verified:'LIVE_NASA_RESPONSE_NOT_MOCK',generatedAt:evidence.generatedAt,
  summary:cases.map(({name,validMonths,completeYears,trendPerDecade,CI95,pValueClassicalOLS,url})=>({
    name,validMonths,completeYears,trendPerDecade,CI95,pValueClassicalOLS,url
  }))
},null,2));

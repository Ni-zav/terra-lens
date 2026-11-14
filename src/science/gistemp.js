/**
 * NASA GISS GISTEMP v4 global land+ocean surface temperature anomaly table.
 * https://data.giss.nasa.gov/gistemp/data_v4.html
 * Anomalies are degrees C relative to each calendar month's 1951-1980 mean.
 * The global index is not a gridpoint, and cannot be mapped to a fake city pin.
 */
import {annualMeans,linearTrend} from '../stats.js';
export const GISTEMP_CSV_URL='https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv';
export const GISTEMP_TXT_URL='https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.txt';
/** NASA official text table uses hundredths of °C (NOT raw °C) and repeats the header. */
export function parseGISTEMPtext(contents){
 if(typeof contents!=='string'||contents.length>1e6)throw Error('Missing NASA GISS text table');
 if(!contents.includes('GLOBAL Land-Ocean Temperature Index'))throw Error('Not a NASA GISTEMP global text table');
 const series=[],incomplete=[],seen=new Set();
 for(const line of contents.split(/\r?\n/)){
   const tokens=line.trim().split(/\s+/);
   if(!/^\d{4}$/.test(tokens[0]||''))continue;
   const year=Number(tokens[0]);
   if(year<1880||year>2100||tokens.length<13)continue;
   if(seen.has(year))throw Error('Duplicate NASA GISTEMP calendar year');
   seen.add(year);let valid=0;
   for(let i=0;i<12;i++){
     const raw=tokens[i+1];
     if(!/^[+-]?\d+$/.test(raw||''))continue;
     const value=Number(raw)/100;
     if(!Number.isFinite(value)||Math.abs(value)>20)throw Error('Invalid NASA global anomaly');
     series.push({year,month:i+1,value,date:String(year)+'-'+String(i+1).padStart(2,'0')});
     valid++;
   }
   if(valid<12)incomplete.push({year,validMonths:valid});
 }
 if(series.length<120)throw Error('NASA GISS text has too few monthly records');
 return {series:series.sort((a,b)=>a.year-b.year||a.month-b.month),incomplete,
   source:'NASA GISS GISTEMP v4',product:'Global Land-Ocean Temperature Index',
   originalBaseline:'1951–1980 by calendar month',unit:'°C anomaly',
   spatialSupport:'global land+ocean index, not a map point',
   note:'Converted official text table hundredths of degrees Celsius into degrees Celsius. NASA periodically revises historic values.'};
}
export async function fetchGISTEMPtext({fetcher=fetch,signal}={}){
 const response=await fetcher(GISTEMP_TXT_URL,{signal});
 if(!response.ok)throw Error('NASA GISS text HTTP '+response.status);
 return {...parseGISTEMPtext(await response.text()),sourceURL:GISTEMP_TXT_URL,
   retrievedAt:new Date().toISOString()};
}
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export function parseGISTEMP(csv){
 if(typeof csv!=='string'||csv.length>1e6)throw new Error('GISTEMP CSV missing or unexpectedly large');
 const lines=csv.replace(/^\ufeff/,'').split(/\r?\n/);
 const header=lines.findIndex(line=>/^Year,Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec,/.test(line.trim()));
 if(header<0)throw new Error('GISTEMP global monthly table header was not found');
 const columns=lines[header].trim().split(',');
 const indices=MONTHS.map(m=>columns.indexOf(m));
 if(indices.some(i=>i<0))throw new Error('GISTEMP table missing one or more monthly columns');
 const series=[],seen=new Set(),incomplete=[];
 for(const row of lines.slice(header+1)){
   const cells=row.trim().split(',');
   const year=Number(cells[0]);
   if(!Number.isInteger(year)||year<1880||year>2100)continue;
   if(seen.has(year))throw new Error('Duplicate GISTEMP calendar year '+year);
   seen.add(year);
   let valid=0;
   for(let m=0;m<12;m++){
     const raw=cells[indices[m]]?.trim();
     if(!raw||raw==='***')continue;
     const value=Number(raw);
     if(!Number.isFinite(value)||Math.abs(value)>20)throw new Error('Invalid GISTEMP global anomaly');
     series.push({year,month:m+1,value,date:String(year)+'-'+String(m+1).padStart(2,'0')});
     valid++;
   }
   if(valid!==12)incomplete.push({year,validMonths:valid});
 }
 if(!series.length)throw new Error('No GISTEMP global monthly anomalies');
 series.sort((a,b)=>a.year-b.year||a.month-b.month);
 return {series,incomplete,source:'NASA GISS GISTEMP v4',product:'Global Land-Ocean Temperature Index',
   originalBaseline:'1951–1980 by calendar month',unit:'°C anomaly',
   spatialSupport:'global land+ocean index, NOT a point or locally representative grid cell',
   note:'GISTEMP CSV is periodically revised. Values are temperature anomalies, not absolute temperatures.'};
}
export async function fetchGISTEMP({fetcher=fetch,signal}={}){
 const response=await fetcher(GISTEMP_CSV_URL,{signal});
 if(!response.ok)throw Error('NASA GISS CSV HTTP '+response.status);
 const parsed=parseGISTEMP(await response.text());
 return {...parsed,sourceURL:GISTEMP_CSV_URL,retrievedAt:new Date().toISOString()};
}
export function rebaseMonthlyAnomalies(monthly,{baselineStart=2001,baselineEnd=2020}={}){
 if(!Number.isInteger(baselineStart)||!Number.isInteger(baselineEnd)||baselineStart>=baselineEnd)
  throw new RangeError('Invalid baseline years');
 const monthlyGroups=Array.from({length:12},()=>[]);
 const seen=new Set();
 for(const r of monthly){
   if(!Number.isInteger(r.year)||!Number.isInteger(r.month)||r.month<1||r.month>12||!Number.isFinite(r.value))
     continue;
   const key=r.year+'-'+r.month;
   if(seen.has(key))throw Error('Duplicate monthly record '+key);
   seen.add(key);
   if(r.year>=baselineStart&&r.year<=baselineEnd)monthlyGroups[r.month-1].push(r.value);
 }
 const expected=baselineEnd-baselineStart+1;
 if(monthlyGroups.some(rows=>rows.length!==expected))
  throw new Error('Rebasing requires complete reference monthly years for every calendar month');
 const normals=monthlyGroups.map(rows=>rows.reduce((a,b)=>a+b,0)/rows.length);
 return {baseline:`${baselineStart}–${baselineEnd}`,normals,
   monthly:monthly.filter(r=>Number.isInteger(r.year)&&Number.isInteger(r.month)
       &&r.month>=1&&r.month<=12&&Number.isFinite(r.value))
    .map(r=>({...r,value:r.value-normals[r.month-1]}))};
}
export function compareLocalGlobal({localPowerMonthly,globalGISTEMP,from=2001,to=2024,
  baselineStart=2001,baselineEnd=2020}){
 const local=rebaseMonthlyAnomalies(localPowerMonthly,{baselineStart,baselineEnd});
 const global=rebaseMonthlyAnomalies(globalGISTEMP.series,{baselineStart,baselineEnd});
 const take=rows=>annualMeans(rows.filter(r=>r.year>=from&&r.year<=to));
 const annualLocal=take(local.monthly),annualGlobal=take(global.monthly);
 const trendLocal=linearTrend(annualLocal),trendGlobal=linearTrend(annualGlobal);
 if(!trendLocal||!trendGlobal)throw Error('Insufficient complete annual records for local/global historical context');
 return {
   schema:'terra-lens-local-global-context-v1',
   simple:{
    title:'Put a local temperature change in global context',
    question:'What do a modeled point and the global index each show over the same years?',
    years:`${from}–${to}`,baseline:`${baselineStart}–${baselineEnd}`,
    pointFittedTrendCPerDecade:trendLocal.slopePerDecade,
    globalFittedTrendCPerDecade:trendGlobal.slopePerDecade,
    meaning:'Both slopes describe historical fitted changes at different spatial and observational supports. This is NOT a formal local-vs-global significance test.',
    nextStep:'Check nearby station observations, local land use and the GISTEMP source methodology before drawing adaptation or attribution conclusions.'
   },
   advanced:{
     sources:[
       {source:'NASA POWER / MERRA-2-derived',variable:'T2M',spatialSupport:'model grid point',
        baseline:`${baselineStart}–${baselineEnd}`,monthly:local.monthly,annual:annualLocal,trend:trendLocal},
       {source:'NASA GISS GISTEMP v4',variable:'global land-ocean temperature anomaly',
        spatialSupport:'global area-average index, NOT a point',originalBaseline:'1951–1980',
        transformedBaseline:`${baselineStart}–${baselineEnd}`,
        sourceURL:globalGISTEMP.sourceURL||GISTEMP_CSV_URL,
        retrievedAt:globalGISTEMP.retrievedAt||null,monthly:global.monthly,annual:annualGlobal,trend:trendGlobal}
     ],
     differencesNotTested:true,
     caveat:'Seasonal 2001–2020 rebasing removes separately estimated monthly normal offsets. GISTEMP and POWER have different methodologies, geography and data generation. The derived annual slope comparison is descriptive, not a paired causal or formal statistical difference, and GISTEMP may revise historic records.'
   }
 };
}

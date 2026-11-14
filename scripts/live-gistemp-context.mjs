/** Actual NASA GISS GISTEMP v4 + NASA POWER local sample, not fixtures. */
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {fetchGISTEMP,compareLocalGlobal} from '../src/science/gistemp.js';
import {parseMonthly,requestURL} from '../src/power.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=join(root,'artifacts','gistemp-power-global-local.json');
const giss=await fetchGISTEMP();
const nasaUrl=requestURL({lat:-7.7956,lon:110.3695,variable:'T2M',start:2001,end:2024});
const response=await fetch(nasaUrl);
if(!response.ok)throw Error('NASA POWER HTTP '+response.status);
const body=await response.json();
const power={source:'NASA POWER / MERRA-2-derived model point',url:nasaUrl,
  fetchedAt:new Date().toISOString(),metadata:body.header||{},
  monthly:parseMonthly(body,'T2M',{start:2001,end:2024})};
const comparison=compareLocalGlobal({
 localPowerMonthly:power.monthly,globalGISTEMP:giss,from:2001,to:2024,
 baselineStart:2001,baselineEnd:2020
});
const evidence={schema:'terra-lens-gistemp-power-real-evidence-v1',
 generatedAt:new Date().toISOString(),global:giss,local:power,comparison};
if(comparison.advanced.sources.some(s=>s.annual.length!==24))
 throw Error('NASA data do not have all 24 complete aligned study years');
if(giss.series.length<100*12)throw Error('Expected the NASA GISS long-run monthly record');
await mkdir(join(root,'artifacts'),{recursive:true});
await writeFile(out,JSON.stringify(evidence,null,2)+'\n');
console.log('PASS real NASA GISS GISTEMP months:',giss.series.length,
 'NASA POWER local months:',power.monthly.length);
console.log('GISS source:',giss.sourceURL,'POWER source:',power.url);
console.log('Global rate 2001–2024:',comparison.simple.globalFittedTrendCPerDecade,
 'local Yogyakarta POWER point rate:',comparison.simple.pointFittedTrendCPerDecade,
 'baseline:',comparison.simple.baseline);
console.log('No formal statistical test of global vs local difference is claimed.');
console.log('Evidence saved:',out);

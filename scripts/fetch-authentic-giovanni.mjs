/**
 * Secure, participant-authenticated NASA Giovanni in the Cloud point-series
 * acquisition. Real NASA CSV only: never substitutes a POWER or synthetic row.
 *
 * Requires a real Earthdata bearer token in EARTHDATA_TOKEN, product identity
 * and DOI checked against the official NASA catalog, and a safe output folder
 * OUTSIDE this Git repository. Do not put secrets in command arguments.
 *
 * Output stays local/private. Runs the existing evidence checker but does NOT
 * assert NASA GO Team source eligibility or validate submitted credentials.
 */
import {mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname, relative, sep, join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseGiovanniMonthlyCSV} from '../src/giovanni.js';
import {annualMeans, linearTrend} from '../src/stats.js';

const root = fileURLToPath(new URL('../',import.meta.url));
const required = name => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Missing '+name+'. Never use a placeholder for authentic NASA data.');
  return value;
};
const token=required('EARTHDATA_TOKEN');
const variable=required('GIOVANNI_VARIABLE_ID');
const collection=required('GIOVANNI_PRODUCT_ID');
const doi=required('GIOVANNI_PRODUCT_DOI');
const lat=Number(required('GIOVANNI_LAT'));
const lon=Number(required('GIOVANNI_LON'));
const start=required('GIOVANNI_START');
const end=required('GIOVANNI_END');
if (!/^[A-Za-z0-9_.:-]{5,128}$/.test(variable)) throw new Error('Invalid Giovanni variable ID');
if (!/^[A-Za-z0-9_.:-]{5,128}$/.test(collection)) throw new Error('Invalid NASA collection ID');
if (!/^10\.\d{4,9}\/\S+$/.test(doi)) throw new Error('NASA collection DOI must be verified and supplied');
if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180)
  throw new Error('Invalid point latitude/longitude');
if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
  new Date(start+'T00:00:00Z').toISOString().slice(0,10)!==start ||
  new Date(end+'T00:00:00Z').toISOString().slice(0,10)!==end ||
  end<=start || Number(end.slice(0,4))-Number(start.slice(0,4))<9)
  throw new Error('Use valid start/end YYYY-MM-DD covering at least ten calendar years');

const outputDir=resolve(required('GIOVANNI_DOWNLOAD_DIR'));
const relativeToRoot=relative(resolve(root),outputDir);
if (!relativeToRoot || (relativeToRoot!=='..' && !relativeToRoot.startsWith('..'+sep)))
  throw new Error('GIOVANNI_DOWNLOAD_DIR must be OUTSIDE the Git repository');
const url=new URL('https://api.giovanni.earthdata.nasa.gov/timeseries');
url.searchParams.set('data',variable);
url.searchParams.set('location','['+lat+','+lon+']');
url.searchParams.set('time',start+'T00:00:00/'+end+'T23:59:59');
const version=process.env.GIOVANNI_API_VERSION?.trim();
if(version) {
  if(!/^[0-9.]+$/.test(version))throw new Error('Invalid NASA API version');
  url.searchParams.set('version',version);
}
const controller=new AbortController();
const timeout=setTimeout(()=>controller.abort(),120000);
let response;
try {
  response=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'text/csv'},redirect:'manual',signal:controller.signal,cache:'no-store'});
} finally {clearTimeout(timeout);}
if(!response.ok) throw new Error('NASA Giovanni HTTP '+response.status+
  '. Check Earthdata authorization, selected monthly variable, quota and request dates. Do not substitute mock data.');
const declaredLength=Number(response.headers.get('content-length')||0);
if(declaredLength>12_000_000)throw new Error('NASA response too large for monthly CSV importer.');
const bytes=Buffer.from(await response.arrayBuffer());
if(bytes.byteLength>12_000_000)throw new Error('NASA CSV exceeds 12 MB.');
const decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
if(!decoded.includes('param_name,') || !decoded.includes('unit,'))
  throw new Error('NASA response is not a labeled Giovanni CSV time series.');
const parsed=parseGiovanniMonthlyCSV(decoded);
const annual=annualMeans(parsed.monthly);
if(annual.length<10||!linearTrend(annual))throw new Error('NASA CSV lacks at least 10 complete years of MONTHLY records.');
const timestamp=new Date().toISOString().replace(/[:.]/g,'-');
const file=join(outputDir,'giovanni-original-'+timestamp+'.csv');
const evidence=join(outputDir,'giovanni-evidence-'+timestamp+'.json');
await mkdir(outputDir,{recursive:true,mode:0o700});
await writeFile(file,bytes,{flag:'wx',mode:0o600});
const cleanEnv={...process.env,EARTHDATA_TOKEN:'',GIOVANNI_CSV_FILE:file,
  GIOVANNI_PRODUCT_ID:collection,GIOVANNI_PRODUCT_DOI:doi,
  GIOVANNI_DATA_URL:url.href,GIOVANNI_EVIDENCE_OUTPUT:evidence};
const validator=fileURLToPath(new URL('./verify-giovanni-source.mjs',import.meta.url));
const run=spawnSync(process.execPath,[validator],{env:cleanEnv,encoding:'utf8'});
if(run.status!==0)throw new Error('Original CSV saved to '+file+'; numerical verifier failed. '+(run.stderr||'').slice(0,800));
console.log(JSON.stringify({
 status:'ACTUAL NASA RESPONSE PROCESSED; AUTHENTICITY AND ELIGIBILITY STILL REQUIRE HUMAN SOURCE REVIEW',
 originalFile:file,evidenceFile:evidence,
 requestURL:url.href,sha256:createHash('sha256').update(bytes).digest('hex'),
 monthlyRecords:parsed.monthly.length,completeYears:annual.length,metadata:parsed.metadata,
 next:'Run GIOVANNI_EVIDENCE_FILE='+evidence+' GIOVANNI_CSV_FILE='+file+
 ' python3 scripts/verify-giovanni-source-python.py; verify NASA product DOI and official challenge-list entry.'
},null,2));

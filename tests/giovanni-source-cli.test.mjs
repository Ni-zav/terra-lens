/**
 * Synthetic fixtures exercise the CLI safety gates. They are NOT NASA data and
 * must never be committed as scientific result artifacts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../scripts/verify-giovanni-source.mjs',import.meta.url));
test('authentic-source evidence CLI refuses absent credentials and returns locally flagged provenance',async()=>{
 const empty=spawnSync(process.execPath,[script],{encoding:'utf8',env:{
   ...process.env,GIOVANNI_CSV_FILE:'',GIOVANNI_PRODUCT_ID:'',
   GIOVANNI_PRODUCT_DOI:'',GIOVANNI_DATA_URL:''}});
 assert.notEqual(empty.status,0);
 assert.match(empty.stderr,/Set GIOVANNI_CSV_FILE/);
 const dir=await mkdtemp(join(tmpdir(),'terra-giovanni-cli-fixture-'));
 try{
   const file=join(dir,'TEST-ONLY-SYNTHETIC.csv'),target=join(dir,'evidence.json');
   const records=['param_name,T2M','unit,K'];
   for(let year=2001;year<=2014;year++)for(let m=1;m<=12;m++)
     records.push(String(year)+'-'+String(m).padStart(2,'0')+','+
       (290+(year-2001)*.1).toFixed(6));
   await writeFile(file,records.join('\n')+'\n');
   const run=spawnSync(process.execPath,[script],{encoding:'utf8',env:{
     ...process.env,GIOVANNI_CSV_FILE:file,GIOVANNI_PRODUCT_ID:'TEST_SOURCE_ONLY',
     GIOVANNI_PRODUCT_DOI:'10.0000/TEST-ONLY',
     GIOVANNI_DATA_URL:'https://giovanni.gsfc.nasa.gov/giovanni/TEST-ONLY',
     GIOVANNI_EVIDENCE_OUTPUT:target
   }});
   assert.equal(run.status,0,run.stderr);
   const report=JSON.parse(await readFile(target,'utf8'));
   assert.equal(report.originalMonthlyRecords.length,14*12);
   assert.equal(report.derivedDayWeightedCompleteYears.length,14);
   assert.equal(report.sourceClaimsRequireManualNASAReview,true);
   assert.equal(report.originalCSV.storageLocationNotVerified,true);
   assert.equal(Object.hasOwn(report.originalCSV,'exactFilePreservedOutsideGit'),false);
   assert.ok(report.originalCSV.sha256.length===64);
   assert.ok(Math.abs(report.classicalOLS.slopePerDecade-1)<1e-8);
   assert.match(run.stdout,/NASA-provenance-pending-independent-review/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

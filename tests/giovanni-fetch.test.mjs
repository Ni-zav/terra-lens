/** Synthetic configuration failures only. No Earthdata credentials or network required. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../scripts/fetch-authentic-giovanni.mjs',import.meta.url));
const repo=fileURLToPath(new URL('../',import.meta.url));
const fixtureEnv={
 ...process.env,EARTHDATA_TOKEN:'TEST_TOKEN_NOT_A_REAL_SECRET',
 GIOVANNI_VARIABLE_ID:'M2IMNXASM_T2M',GIOVANNI_PRODUCT_ID:'M2IMNXASM_5.12.4',
 GIOVANNI_PRODUCT_DOI:'10.5067/5ESKGQTZG7FO',GIOVANNI_LAT:'-7.8',
 GIOVANNI_LON:'110.37',GIOVANNI_START:'2001-01-01',
 GIOVANNI_END:'2024-12-31',GIOVANNI_DOWNLOAD_DIR:repo
};
test('authentic NASA downloader refuses absent Earthdata token before networking',()=>{
 const r=spawnSync(process.execPath,[script],{encoding:'utf8',
  env:{...fixtureEnv,EARTHDATA_TOKEN:''}});
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/Missing EARTHDATA_TOKEN/);
});
test('original NASA data must be saved outside repository, never shipped as fixture',()=>{
 const r=spawnSync(process.execPath,[script],{encoding:'utf8',env:fixtureEnv});
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/OUTSIDE the Git repository/);
 assert.doesNotMatch(r.stderr,/TEST_TOKEN_NOT_A_REAL_SECRET/);
});
test('source collection DOI and date range validation occur before remote calls',()=>{
 const r=spawnSync(process.execPath,[script],{encoding:'utf8',
  env:{...fixtureEnv,GIOVANNI_PRODUCT_DOI:'PLACEHOLDER'}});
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/DOI/);
});

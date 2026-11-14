import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGiovanniMonthlyCSV} from '../src/giovanni.js';
import {annualMeans,linearTrend} from '../src/stats.js';
const header='param_name,Tair_f_inst\nunit,K\nlat,45.125\nlon,-98.125\n';
test('monthly Giovanni-style CSV retains metadata, records and trend',()=>{
 const data=Array.from({length:12*11},(_,i)=>String(2000+Math.floor(i/12))+'-'+String(i%12+1).padStart(2,'0')+'-01T00:00:00Z,'+String(280+Math.floor(i/12)*.2)+'\n').join('');
 const r=parseGiovanniMonthlyCSV(header+'Timestamp,Tair_f_inst\n'+data);
 assert.equal(r.monthly.length,132);
 assert.equal(r.metadata.unit,'K');
 assert.equal(annualMeans(r.monthly).length,11);
 assert.ok(Math.abs(linearTrend(annualMeans(r.monthly)).slopePerDecade-2)<1e-9);
});
test('Giovanni parser rejects daily or submonthly data rather than silently losing samples',()=>{
 assert.throws(()=>parseGiovanniMonthlyCSV(header+'2001-01-01,280\n2001-01-02,281'),/Multiple samples/);
});
test('Giovanni parser rejects unlabelled or empty data, excludes fill values',()=>{
 assert.throws(()=>parseGiovanniMonthlyCSV('2001-01-01,23'),/metadata/);
 const r=parseGiovanniMonthlyCSV(header+'2001-01-01,-999\n2001-02-01,281');
 assert.equal(r.monthly.length,1);
});
import {giovanniSeries} from '../src/giovanni.js';
import {SUPPORT} from '../src/series.js';
test('Giovanni adapter yields an unauthenticated area-average series',()=>{
 const data=Array.from({length:24},(_,i)=>String(2000+Math.floor(i/12))+'-'+String(i%12+1).padStart(2,'0')+'-01,'+(280+i)+'\n').join('');
 const s=giovanniSeries(parseGiovanniMonthlyCSV(header+data),{sha256:'abc'});
 assert.equal(s.id,'G');assert.equal(s.support,SUPPORT.AREA_AVERAGE);assert.equal(s.variable.unit,'K');
 assert.equal(s.provenance.authenticated,false);assert.deepEqual(s.geo,{lat:45.125,lon:-98.125});
});

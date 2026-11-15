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
test('Giovanni cloud import excludes declared positive and negative fill values without a blanket threshold',()=>{
 const r=parseGiovanniMonthlyCSV(header+'_FillValue,1e15\nmissing_value,-32768\n2001-01,1e15\n2001-02,-32768\n2001-03,-1000\n2001-04,280\n2001-05,-999');
 assert.deepEqual(r.monthly.map(row=>row.value),[-1000,280,-999]);
 assert.throws(()=>parseGiovanniMonthlyCSV(header+'fill_value,not-a-number\n2001-01,280'),/Invalid fill_value/);
});
import {giovanniSeries} from '../src/giovanni.js';
import {SUPPORT} from '../src/series.js';
test('Giovanni point-service metadata yields an unauthenticated point series',()=>{
 const data=Array.from({length:24},(_,i)=>String(2000+Math.floor(i/12))+'-'+String(i%12+1).padStart(2,'0')+'-01,'+(280+i)+'\n').join('');
 const s=giovanniSeries(parseGiovanniMonthlyCSV(header+data),{sha256:'abc'});
 assert.equal(s.id,'G');assert.equal(s.support,SUPPORT.GRID_POINT);assert.equal(s.variable.unit,'K');
 assert.equal(s.provenance.authenticated,false);assert.match(s.provenance.warning,/not annual totals or annual extremes/);assert.deepEqual(s.geo,{lat:45.125,lon:-98.125});
});

test('NASA Giovanni in the Cloud timestamp with a space is recognized as an actual monthly observation',()=>{
 const data=Array.from({length:12*10},(_,i)=>{
   const y=2001+Math.floor(i/12),m=String(i%12+1).padStart(2,'0');
   return y+'-'+m+'-01 00:30:00,'+(275+i*.01)+'\n';
 }).join('');
 const parsed=parseGiovanniMonthlyCSV(header+'time,Tair_f_inst\n'+data);
 assert.equal(parsed.monthly.length,120);
 assert.equal(annualMeans(parsed.monthly).length,10);
 assert.equal(parsed.monthly[0].date,'200101');
});
test('Giovanni rejects impossible dates rather than silently accepting their year/month',()=>{
 assert.throws(()=>parseGiovanniMonthlyCSV(header+'2001-02-31 00:00:00,280'),/Invalid calendar date/);
});
test('Giovanni does not guess area support where a source has no point coordinates',()=>{
 const parsed=parseGiovanniMonthlyCSV('param_name,T2M\nunit,K\n2001-01-01 00:00:00,290');
 const series=giovanniSeries(parsed);
 assert.equal(series.support,SUPPORT.UNKNOWN);
 assert.equal(series.geo,null);
});

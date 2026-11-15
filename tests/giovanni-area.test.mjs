import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeGiovanniArea,parseGiovanniAreaCSV,giovanniAreaSeries} from '../src/science/giovanni-case.js';
import {giovanniTemperatureQuery} from '../src/science/giovanni-query.js';
import {SUPPORT,compatibility} from '../src/series.js';
const csv=readFileSync('data/source-snapshots/g4.areaAvgTimeSeries.M2TMNXSLV_5_12_4_T2M.20010101-20241231.110E_8S_111E_7S.csv','utf8');
test('original Giovanni case has 24 complete years and stable results',()=>{const a=analyzeGiovanniArea(csv);assert.equal(a.monthly.length,288);assert.equal(a.annual.length,24);assert.ok(Math.abs(a.trend.slopePerDecade-0.1771714116)<1e-9)});
test('declared fill excluded and duplicate month rejected',()=>{const changed=csv.replace('298.295044','1000000000000000');assert.equal(parseGiovanniAreaCSV(changed).length,287);assert.throws(()=>parseGiovanniAreaCSV(csv+'2001-01-01 00:00:00,298\n'),/duplicate/)});
test('classic area CSV is imported with area support and unverified provenance',()=>{
 const s=giovanniAreaSeries(csv,{fileName:'regional.csv',sha256:'test-only'});
 assert.equal(s.support,SUPPORT.AREA_AVERAGE);assert.equal(s.variable.unit,'K');
 assert.deepEqual(s.provenance.requestedBounds,[110,-8,111,-7]);assert.equal(s.provenance.authenticated,false);
 assert.equal(compatibility(s,{...s,support:SUPPORT.GRID_POINT}).paired,false);
 assert.throws(()=>giovanniAreaSeries(csv.replace('User Bounding Box:,"110,-8,111,-7"','User Bounding Box:,"111,-8,110,-7"')),/bounds/);
});
test('regional query encodes arbitrary valid bounds and rejects unsupported requests',()=>{
 const url=new URL(giovanniTemperatureQuery({west:'-123',south:'35',east:'-121',north:'37',start:'2005',end:'2020'}));
 const q=new URLSearchParams(url.hash.slice(1));
 assert.equal(q.get('bbox'),'-123,35,-121,37');assert.equal(q.get('data'),'M2TMNXSLV_5_12_4_T2M');
 assert.equal(q.get('starttime'),'2005-01-01T00:00:00Z');
 assert.throws(()=>giovanniTemperatureQuery({west:'170',south:'0',east:'-170',north:'10',start:'2000',end:'2020'}),/antimeridian/);
 assert.throws(()=>giovanniTemperatureQuery({west:'',south:'0',east:'10',north:'10',start:'2000',end:'2020'}),/bounds/);
});

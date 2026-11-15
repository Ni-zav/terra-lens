import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeGiovanniArea,parseGiovanniAreaCSV} from '../src/science/giovanni-case.js';
const csv=readFileSync('data/source-snapshots/g4.areaAvgTimeSeries.M2TMNXSLV_5_12_4_T2M.20010101-20241231.110E_8S_111E_7S.csv','utf8');
test('original Giovanni case has 24 complete years and stable results',()=>{const a=analyzeGiovanniArea(csv);assert.equal(a.monthly.length,288);assert.equal(a.annual.length,24);assert.ok(Math.abs(a.trend.slopePerDecade-0.1771714116)<1e-9)});
test('declared fill excluded and duplicate month rejected',()=>{const changed=csv.replace('298.295044','1000000000000000');assert.equal(parseGiovanniAreaCSV(changed).length,287);assert.throws(()=>parseGiovanniAreaCSV(csv+'2001-01-01 00:00:00,298\n'),/duplicate/)});

import test from 'node:test';
import assert from 'node:assert/strict';
import {buildChartModel, buildSeasonalModel, axisPlan} from '../src/react/chart-model.js';
import {makeSeries, SUPPORT} from '../src/series.js';
// Synthetic fixtures for tests only — never production data.
const v = {code: 'POWER:T2M', label: 'Air temperature', unit: '°C'};
const fullYears = (from, n, f) => Array.from({length: n * 12}, (_, i) => ({year: from + Math.floor(i / 12), month: i % 12 + 1, value: f(Math.floor(i / 12), i % 12)}));

test('chart calendar retains missing values and valid zero records',()=>{
  const s=makeSeries({id:'A',variable:v,monthly:[{year:2023,month:1,value:0},{year:2023,month:3,value:3}]});
  const model=buildChartModel([s],{mode:'monthly'});
  assert.deepEqual(model.dates.slice(0,3),['2023-01','2023-02','2023-03']);
  assert.deepEqual(model.series[0].values.slice(0,3),[0,null,3]);
});
test('chart window changes displayed years, not the fitted series data',()=>{
  const s=makeSeries({id:'A',variable:v,monthly:fullYears(2001,24,y=>y)});
  const full=buildChartModel([s],{mode:'annual'}), recent=buildChartModel([s],{mode:'annual',range:'10'});
  assert.equal(full.dates.length,24);assert.equal(recent.dates[0],'2015');
  assert.ok(Math.abs(recent.series[0].values[0]-14)<1e-12);assert.ok(Math.abs(recent.series[0].fit[0]-14)<1e-9);
  assert.equal(full.series[0].slopePerDecade,recent.series[0].slopePerDecade);
});
test('anomaly mode removes the seasonal cycle and shares a unit axis',()=>{
  const a=makeSeries({id:'A',variable:v,monthly:fullYears(2001,12,(y,m)=>20+5*Math.sin(m))});
  const model=buildChartModel([a],{mode:'anomaly'});
  assert.equal(model.unit,'°C');assert.equal(model.standardized,false);
  assert.ok(model.series[0].values.every(x=>Math.abs(x)<1e-9));
});
test('mixed units: values hide the odd series, anomaly falls back to σ',()=>{
  const a=makeSeries({id:'A',variable:v,monthly:fullYears(2001,12,(y,m)=>20+m+y*.1)});
  const g=makeSeries({id:'G',variable:{code:'GIOVANNI:T',unit:'K'},support:SUPPORT.AREA_AVERAGE,monthly:fullYears(2001,12,(y,m)=>290+m+y*.1)});
  const values=axisPlan([a,g],'monthly');
  assert.deepEqual(values.drawn.map(s=>s.id),['A']);assert.deepEqual(values.excluded.map(s=>s.id),['G']);
  const anomaly=buildChartModel([a,g],{mode:'anomaly'});
  assert.equal(anomaly.unit,'σ');assert.equal(anomaly.series.length,2);
});
test('seasonal model reports one slope per calendar month',()=>{
  const a=makeSeries({id:'A',variable:v,monthly:fullYears(2001,12,(y,m)=>m===6?y*0.5:10)});
  const model=buildSeasonalModel([a]);
  assert.equal(model.series[0].slopes.length,12);
  assert.ok(Math.abs(model.series[0].slopes[6]-5)<1e-9);
  assert.ok(Math.abs(model.series[0].slopes[0])<1e-12);
});

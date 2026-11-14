import test from 'node:test';
import assert from 'node:assert/strict';
import {buildChartModel} from '../src/react/chart-model.js';

test('chart calendar retains missing values and valid zero records',()=>{
  const result={id:'A',label:'A',monthly:[{year:2023,month:1,value:0},{year:2023,month:3,value:3}],annual:[],trend:null};
  const model=buildChartModel([result],true,'all');
  assert.deepEqual(model.dates.slice(0,3),['2023-01','2023-02','2023-03']);
  assert.deepEqual(model.series[0].values.slice(0,3),[0,null,3]);
});
test('chart window changes displayed years, not the fitted series data',()=>{
  const annual=Array.from({length:24},(_,i)=>({year:2001+i,value:i}));
  const result={id:'A',label:'A',monthly:[],annual,trend:{fitted:annual}};
  const full=buildChartModel([result],false,'all'), recent=buildChartModel([result],false,'10');
  assert.equal(full.dates.length,24);assert.equal(recent.dates[0],'2015');
  assert.equal(recent.series[0].values[0],14);assert.equal(recent.series[0].fit[0],14);
  assert.equal(result.annual.length,24);
});

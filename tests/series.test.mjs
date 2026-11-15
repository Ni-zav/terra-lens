import test from 'node:test';
import assert from 'node:assert/strict';
import {mannKendall, normalTwoSidedP, lag1Autocorrelation, monthlyClimatology, monthlyAnomalies} from '../src/stats.js';
import {makeSeries, analyzeSeries, annualOf, compareSeries, buildFindings, SUPPORT, coverageOf} from '../src/series.js';
import {powerSeries} from '../src/power.js';
// Synthetic fixtures for tests only — never production data.

test('normal two-sided p matches reference quantiles',()=>{
  assert.ok(Math.abs(normalTwoSidedP(1.959963984540054)-0.05)<1e-7);
  assert.ok(Math.abs(normalTwoSidedP(3)-0.0026997960632601866)<1e-8);
  assert.equal(normalTwoSidedP(0),1);
});
test('Mann–Kendall on a strictly increasing series',()=>{
  const r=mannKendall(Array.from({length:10},(_,i)=>({year:2000+i,value:i})));
  assert.equal(r.s,45);assert.equal(r.varS,125);
  assert.ok(Math.abs(r.z-44/Math.sqrt(125))<1e-12);
  assert.ok(Math.abs(r.senSlopePerDecade-10)<1e-12);
  assert.ok(r.pValue<1e-3);assert.equal(r.tau,1);
});
test('Mann–Kendall tie correction and Sen slope over calendar gaps',()=>{
  // values 1,1,2,3,3,3,4,5,6,7 → ties of size 2 and 3
  const vals=[1,1,2,3,3,3,4,5,6,7], years=[2000,2001,2002,2004,2005,2006,2008,2009,2011,2012];
  const r=mannKendall(years.map((year,i)=>({year,value:vals[i]})));
  let s=0;for(let i=0;i<10;i++)for(let j=i+1;j<10;j++)s+=Math.sign(vals[j]-vals[i]);
  assert.equal(r.s,s);
  assert.equal(r.varS,(10*9*25-(2*1*9)-(3*2*11))/18);
  const slopes=[];for(let i=0;i<10;i++)for(let j=i+1;j<10;j++)slopes.push((vals[j]-vals[i])/(years[j]-years[i]));
  slopes.sort((a,b)=>a-b);
  assert.ok(Math.abs(r.senSlopePerYear-(slopes[21]+slopes[22])/2)<1e-12);
  assert.ok(r.senCiLowPerDecade<=r.senSlopePerDecade&&r.senSlopePerDecade<=r.senCiHighPerDecade);
});
test('Mann–Kendall refuses short or duplicate-year series',()=>{
  assert.equal(mannKendall(Array.from({length:9},(_,i)=>({year:i,value:i}))),null);
  assert.equal(mannKendall(Array.from({length:12},()=>({year:2000,value:1}))),null);
});
test('lag-1 autocorrelation of alternating series is strongly negative',()=>{
  assert.ok(lag1Autocorrelation([1,-1,1,-1,1,-1,1,-1])<-0.8);
  assert.equal(lag1Autocorrelation([2,2,2]),null);
});
test('climatology uses complete years only; anomalies keep incomplete-year months',()=>{
  const monthly=[];for(let m=1;m<=12;m++){monthly.push({year:2000,month:m,value:m});monthly.push({year:2001,month:m,value:m+2});}
  monthly.push({year:2002,month:1,value:100});
  const clim=monthlyClimatology(monthly);
  assert.equal(clim[0].mean,2);assert.equal(clim[0].n,2);
  const anomalies=monthlyAnomalies(monthly);
  assert.equal(anomalies.find(p=>p.year===2002).value,98);
  const z=monthlyAnomalies(monthly,{standardized:true});
  assert.ok(Math.abs(z.find(p=>p.year===2001&&p.month===1).value-1/Math.SQRT2)<1e-12);
});

const v={code:'POWER:T2M',label:'Air temperature',unit:'°C'};
const years=(n,f,from=2001)=>Array.from({length:n*12},(_,i)=>({year:from+Math.floor(i/12),month:i%12+1,value:f(Math.floor(i/12),i%12)}));
test('makeSeries sorts, de-duplicates and freezes raw records',()=>{
  const s=makeSeries({id:'A',variable:v,monthly:[{year:2001,month:2,value:2},{year:2001,month:1,value:1},{year:2001,month:1,value:9},{year:2001,month:3,value:NaN}]});
  assert.deepEqual(s.monthly.map(p=>p.value),[1,2]);
  assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.monthly));
  assert.equal(coverageOf(s).missingMonths,10);
});
test('derivations are memoized per series',()=>{
  const s=makeSeries({id:'A',variable:v,monthly:years(12,y=>y)});
  assert.equal(annualOf(s),annualOf(s));assert.equal(analyzeSeries(s),analyzeSeries(s));
});
test('verdict grades agreement of the two tests',()=>{
  const up=analyzeSeries(makeSeries({id:'A',variable:v,monthly:years(20,(y,m)=>y*0.03+Math.sin(y*1.7)*0.05+m)}));
  assert.equal(up.verdict.level,'consistent');assert.equal(up.verdict.direction,1);
  const flat=analyzeSeries(makeSeries({id:'B',variable:v,monthly:years(20,(y,m)=>(y%2?0.1:-0.1)+m)}));
  assert.equal(flat.verdict.level,'not-detected');
  const short=analyzeSeries(makeSeries({id:'C',variable:v,monthly:years(5,y=>y)}));
  assert.equal(short.verdict.level,'insufficient');
});
test('paired contrast only for same variable, unit and support',()=>{
  const a=makeSeries({id:'A',variable:v,support:SUPPORT.GRID_POINT,monthly:years(12,y=>y*.02)});
  const b=makeSeries({id:'B',variable:v,support:SUPPORT.GRID_POINT,monthly:years(12,y=>y*.04+Math.cos(y))});
  const g=makeSeries({id:'G',variable:{code:'GIOVANNI:T2M',unit:'°C'},support:SUPPORT.AREA_AVERAGE,monthly:years(12,y=>y)});
  const ab=compareSeries(a,b);assert.equal(ab.paired,true);assert.equal(ab.contrast.n,12);
  const ag=compareSeries(a,g);assert.equal(ag.paired,false);assert.equal(ag.contrast,null);
  assert.ok(ag.reasons.some(r=>/support/.test(r)));
  const f=buildFindings([a,b,g]);
  assert.equal(f.comparisons.length,2);assert.equal(f.lines.length,5);
  assert.match(f.lines.at(-1),/no paired test/);
});
test('unknown spatial support never establishes paired compatibility',()=>{
  const a=makeSeries({id:'A',variable:v,monthly:years(12,y=>y*.02)});
  const b=makeSeries({id:'B',variable:v,monthly:years(12,y=>y*.04+Math.cos(y))});
  const result=compareSeries(a,b);
  assert.equal(result.paired,false);
  assert.equal(result.contrast,null);
  assert.ok(result.reasons.some(reason=>/spatial support is not established/.test(reason)));
  assert.match(buildFindings([a,b]).lines.at(-1),/no paired test/);
});
test('gaps suppress lag diagnostics and surface the limitation in findings',()=>{
  const all=years(16,(y,m)=>y*.03+Math.sin(y)+m);
  const missing=all.filter(p=>p.year!==2008);
  const a=makeSeries({id:'A',variable:v,support:SUPPORT.GRID_POINT,monthly:all});
  const b=makeSeries({id:'B',variable:v,support:SUPPORT.GRID_POINT,monthly:missing});
  const analysis=analyzeSeries(b);
  assert.equal(analysis.dependence.r1,null);
  assert.match(analysis.dependence.reason,/Missing calendar years/);
  const findings=buildFindings([a,b]);
  assert.equal(findings.comparisons[0].contrast.hac,null);
  assert.match(findings.lines.at(-1),/HAC inference unavailable/);
});
test('POWER adapter produces a grid-point series with provenance',()=>{
  const s=powerSeries({monthly:years(1,()=>1),url:'https://power.larc.nasa.gov/x',fetchedAt:'2026-11-14T00:00:00Z',source:'NASA POWER',metadata:{}},{id:'A',label:'Yogyakarta',color:'#62d6e4',lat:-7.8,lon:110.4,variable:'T2M'});
  assert.equal(s.support,SUPPORT.GRID_POINT);assert.equal(s.variable.unit,'°C');assert.equal(s.provenance.url,'https://power.larc.nasa.gov/x');
});

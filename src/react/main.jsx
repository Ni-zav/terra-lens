import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {VARIABLES, LOCATIONS, fetchNASA, requestURL, resolveLocationName, powerSeries} from '../power.js';
import {analyzeSeries, buildFindings, supportLabel} from '../series.js';
import {axisPlan} from './chart-model.js';
const TimeChart=React.lazy(()=>import('./Chart.jsx').then(module=>({default:module.TimeChart})));
const SeasonalChart=React.lazy(()=>import('./Chart.jsx').then(module=>({default:module.SeasonalChart})));
const GiovanniEvidence=React.lazy(()=>import('./Giovanni.jsx'));
const ContrastFinder=React.lazy(()=>import('./ContrastFinder.jsx'));
import './base.css';
import '../../styles/workspace.css';
import './react.css';
import './quiet.css';

const POINT_IDS=['A','B','C','D'];
const COLORS=['#62d6e4','#f6b975','#a38cf8','#56d39a'];
const COLOR_MAP={A:'#62d6e4',B:'#f6b975',C:'#a38cf8',D:'#56d39a'};
const number=(v,d=2)=>Number.isFinite(v)?new Intl.NumberFormat('en-US',{maximumFractionDigits:d}).format(v):'—';
const signed=(v,d=2)=>(v>0?'+':'')+number(v,d);
const pValue=p=>p<.0001?'< 0.0001':number(p,4);
const defaults={
  variable:'T2M',start:'2001',end:'2024',
  cityA:'Yogyakarta',latA:'-7.7956',lonA:'110.3695',
  compare:true,cityB:'Jakarta',latB:'-6.2088',lonB:'106.8456',
  compareC:false,cityC:'Singapore',latC:'1.3521',lonC:'103.8198',
  compareD:false,cityD:'Tokyo',latD:'35.6762',lonD:'139.6503'
};

function pointEnabled(inputs,id){
  if(id==='A')return true;
  if(id==='B')return Boolean(inputs.compare);
  return Boolean(inputs['compare'+id]);
}
function activePointIds(inputs){
  return POINT_IDS.filter(id=>pointEnabled(inputs,id));
}
function pointName(inputs,id){
  const city=inputs['city'+id];
  if(city&&city!=='custom')return city;
  const lat=Number(inputs['lat'+id]),lon=Number(inputs['lon'+id]);
  return Number.isFinite(lat)&&Number.isFinite(lon)?resolveLocationName(lat,lon):`Point ${id}`;
}
function initialInputs(){
  const q=new URLSearchParams(location.search), next={...defaults};
  for(const k of ['variable','start','end','cityA','latA','lonA','cityB','latB','lonB','cityC','latC','lonC','cityD','latD','lonD']) if(q.has(k))next[k]=q.get(k);
  if(!Object.hasOwn(VARIABLES,next.variable))next.variable=defaults.variable;
  for(const side of POINT_IDS)if(!Object.hasOwn(LOCATIONS,next['city'+side])&&next['city'+side]!=='custom')next['city'+side]='custom';
  if(q.has('compare'))next.compare=q.get('compare')==='1';
  if(q.has('compareC'))next.compareC=q.get('compareC')==='1';
  if(q.has('compareD'))next.compareD=q.get('compareD')==='1';
  return next;
}
function validate(inputs){
  const start=Number(inputs.start),end=Number(inputs.end);
  if(!Number.isInteger(start)||!Number.isInteger(end)||end-start<9)throw Error('Choose at least 10 calendar years.');
  const points=activePointIds(inputs).map(id=>{
    if(!inputs['lat'+id].trim()||!inputs['lon'+id].trim())throw Error('Enter latitude and longitude for each selected point.');
    const lat=Number(inputs['lat'+id]),lon=Number(inputs['lon'+id]);
    requestURL({lat,lon,variable:inputs.variable,start,end});
    return {id,lat,lon,color:COLOR_MAP[id],label:pointName(inputs,id)};
  });
  return {variable:inputs.variable,start,end,points};
}
function makeShare(inputs){
  const url=new URL(location.href); url.search='';
  for(const k of ['variable','start','end','cityA','latA','lonA','cityB','latB','lonB','cityC','latC','lonC','cityD','latD','lonD'])url.searchParams.set(k,inputs[k]);
  url.searchParams.set('compare',inputs.compare?'1':'0');
  if(inputs.compareC)url.searchParams.set('compareC','1');
  if(inputs.compareD)url.searchParams.set('compareD','1');
  url.searchParams.set('auto','1');return url.href;
}
function download(name,type,text){
  const url=URL.createObjectURL(new Blob([text],{type}));
  const link=document.createElement('a');link.href=url;link.download=name;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
/** Raw monthly records of every series, one schema regardless of source. */
function csvDownload(series){
  if(!series.length)return;
  const columns=['series','location','latitude','longitude','spatial_support','variable','year','month','value','unit','source_url','retrieved_at'];
  const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  const rows=[columns.join(',')];
  for(const s of series) for(const p of s.monthly)rows.push([s.id,s.label,s.geo?.lat,s.geo?.lon,s.support,s.variable.code,p.year,p.month,p.value,
    s.variable.unit,s.provenance.url,s.provenance.retrievedAt].map(quote).join(','));
  download(`terra-lens-${series[0].variable.code.replace(':','-')}.csv`,'text/csv;charset=utf-8',rows.join('\n')+'\n');
}
/** Everything shown on screen, from the same derivations, plus provenance. */
function evidenceDownload(series,findings){
  if(!series.length)return;
  const payload={
    schema:'terra-lens-evidence-v2',
    generatedAt:new Date().toISOString(),
    provenanceNote:'Raw monthly values are exactly as retrieved (NASA POWER) or imported (Giovanni). All other numbers are deterministic derivations.',
    method:'Day-weighted complete-year annual means; classical OLS t-test; Mann–Kendall with Theil–Sen slope; residual lag-1 autocorrelation; paired aligned-year contrast with Bartlett Newey–West HAC for compatible series only.',
    limitations:'Grid-point estimates are not whole-city measurements. Tests assume independent annual values (HAC is approximate). No causation, forecast or multiple-testing correction.',
    series:series.map(s=>{const a=analyzeSeries(s);return {id:s.id,label:s.label,variable:s.variable,support:s.support,geo:s.geo,provenance:s.provenance,
      monthly:s.monthly,annual:a.annual,coverage:a.coverage,ols:a.trend,mannKendall:a.robust,dependence:a.dependence,verdict:a.verdict};}),
    comparisons:findings.comparisons,
    findings:findings.lines
  };
  download('terra-lens-auditable-evidence.json','application/json;charset=utf-8',JSON.stringify(payload,null,2)+'\n');
}
function Globe({inputs,onPick}){
  const host=useRef(null),globe=useRef(null),pickRef=useRef(onPick),[target,setTarget]=useState('A'),targetRef=useRef('A');
  const [status,setStatus]=useState(()=>`Target A (${pointName(inputs,'A')}) · Drag to rotate, click to place`);
  pickRef.current=onPick;targetRef.current=target;
  useEffect(()=>{
    let disposed=false;
    const observer=new IntersectionObserver(async entries=>{
      if(!entries.some(e=>e.isIntersecting))return;observer.disconnect();
      try{
        const {createGlobe}=await import('../globe.js');if(disposed)return;
        globe.current=createGlobe(
          host.current,
          point=>{
            const side=targetRef.current;
            const resolved=resolveLocationName(point.lat,point.lon);
            pickRef.current(side,point,resolved);
            setStatus(`Point ${side} · ${resolved} (${point.lat.toFixed(4)}°, ${point.lon.toFixed(4)}°) · Run analysis`);
          },
          hover=>{
            const side=targetRef.current;
            if(hover){
              const resolved=resolveLocationName(hover.lat,hover.lon);
              setStatus(`Pointing ${side} → ${resolved} (${hover.lat.toFixed(2)}°, ${hover.lon.toFixed(2)}°) · Click to set`);
            }
          }
        );
        globe.current.setPoints(pointsRef.current);
      }catch{if(!disposed&&host.current){host.current.dataset.error='true';host.current.textContent='Globe unavailable. Use coordinates.';}}
    },{rootMargin:'200px'});observer.observe(host.current);
    return ()=>{disposed=true;observer.disconnect();globe.current?.dispose?.();};
  },[]);
  const points=useMemo(()=>activePointIds(inputs).map(id=>({id,
    lat:inputs['lat'+id].trim()?Number(inputs['lat'+id]):NaN,
    lon:inputs['lon'+id].trim()?Number(inputs['lon'+id]):NaN})),[inputs]);
  const pointsRef=useRef(points);pointsRef.current=points;
  useEffect(()=>{globe.current?.setPoints(points)},[points]);
  const targetName=pointName(inputs,target), targetLat=Number(inputs['lat'+target]), targetLon=Number(inputs['lon'+target]);
  useEffect(()=>{
    if(Number.isFinite(targetLat)&&Number.isFinite(targetLon)){
      setStatus(`Point ${target} · ${targetName} (${targetLat.toFixed(4)}°, ${targetLon.toFixed(4)}°)`);
    }
  },[target,targetName,targetLat,targetLon]);
  return <section className="globe-panel" aria-labelledby="globe-heading"><div className="globe-copy"><div className="globe-title"><div className="pane-title-group"><span className="section-kicker">Location</span><h2 id="globe-heading">Explore Earth</h2></div><button type="button" id="globe-center" onClick={()=>{const p=points.find(p=>p.id===target)||({lat:Number(inputs['lat'+target]),lon:Number(inputs['lon'+target])});if(p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon))globe.current?.focus(p)}}>Center</button></div>
    <div className="globe-controls" role="group" aria-label="Point to place on the globe">{POINT_IDS.map(id=>{
      const name=pointName(inputs,id);
      const active=pointEnabled(inputs,id);
      return <button type="button" key={id} id={'globe-'+id.toLowerCase()} className={'globe-target-btn pt-'+id.toLowerCase()+(active?' is-enabled':' is-optional')} aria-pressed={target===id} onClick={()=>{setTarget(id);setStatus(`Target ${id} · ${name} (${Number(inputs['lat'+id]).toFixed(2)}°, ${Number(inputs['lon'+id]).toFixed(2)}°) · Click globe to set`)}}><span>Point {id}</span><small>{name}</small></button>;
    })}</div><p id="globe-status" className="globe-status" role="status">{status}</p></div>
    <div ref={host} id="earth-globe" className="earth-globe" aria-label="Interactive Earth globe"/>
    <p className="globe-credit">Historical <a href="https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/" target="_blank" rel="noreferrer">NASA Blue Marble</a> imagery (2001) · Context only, not live data.</p></section>;
}
function Verdict({verdict}){
  return <span className={'verdict verdict-'+verdict.level} title={verdict.detail}>{verdict.headline}</span>;
}
function Comparison({series,findings}){
  const plan=axisPlan(series,'values'), unit=plan.unit;
  const valid=plan.drawn.map(analyzeSeries).filter(a=>a.trend&&a.robust);
  if(!valid.length)return <p className="comparison-empty">At least 10 complete years are needed to estimate a trend.</p>;
  const lows=valid.flatMap(a=>[a.trend.ciLowPerDecade,a.robust.senCiLowPerDecade]),highs=valid.flatMap(a=>[a.trend.ciHighPerDecade,a.robust.senCiHighPerDecade]);
  let min=Math.min(0,...lows),max=Math.max(0,...highs);const padding=(max-min||.5)*.13;min-=padding;max+=padding;
  const x=v=>256+(v-min)/(max-min)*640, rowGap=valid.length===1?0:Math.min(44,120/(valid.length-1)), top=valid.length===1?96:58;
  const height=Math.max(194,top+rowGap*(valid.length-1)+70);
  return <div className="comparison-panel" id="comparison-panel"><div className="comparison-topline"><div className="pane-title-group"><h3>Trend evidence, two independent tests</h3><p>Classical OLS (filled circle, thick bar) and rank-based Theil–Sen / Mann–Kendall (diamond, thin bar) · 95% intervals</p></div></div>
    <div className="confidence-wrap" tabIndex="0" role="region" aria-label="Slope intervals"><svg id="confidence-chart" viewBox={`0 0 960 ${height}`} role="img" aria-label="Classical and Theil–Sen 95 percent slope intervals for each series">
    {[0,1,2,3,4].map(i=>{const value=min+(max-min)*i/4;return <g key={i}><line x1={x(value)} y1="38" x2={x(value)} y2={height-26} stroke="#1e3446"/><text x={x(value)} y={height-9} fill="#95b0be" textAnchor="middle" fontSize="16" fontFamily="ui-monospace, monospace">{number(value,2)}</text></g>})}
    <line x1={x(0)} y1="38" x2={x(0)} y2={height-26} stroke="#8cb4c2" strokeDasharray="4 4"/>
    {valid.map((a,i)=>{const s=a.series,y=top+i*rowGap,t=a.trend,r=a.robust,d=x(r.senSlopePerDecade);return <g key={s.id}>
      <text x="18" y={y+5} fill="#e4f2f5" fontSize={valid.length>2?"16":"18"} fontFamily="ui-monospace, monospace">{s.id} · {s.label.length>20?s.label.slice(0,19)+'…':s.label}</text>
      <line x1={x(t.ciLowPerDecade)} x2={x(t.ciHighPerDecade)} y1={y-4} y2={y-4} stroke={s.color} strokeWidth="6" strokeLinecap="round"/>
      <circle cx={x(t.slopePerDecade)} cy={y-4} r="7" fill={s.color}><title>{`${s.label} OLS: ${signed(t.slopePerDecade,3)} ${unit}/decade; 95% CI ${signed(t.ciLowPerDecade,3)} to ${signed(t.ciHighPerDecade,3)}`}</title></circle>
      <line x1={x(r.senCiLowPerDecade)} x2={x(r.senCiHighPerDecade)} y1={y+9} y2={y+9} stroke={s.color} strokeWidth="2" opacity=".8"/>
      <path d={`M${d} ${y+3} L${d+6} ${y+9} L${d} ${y+15} L${d-6} ${y+9} Z`} fill="#071019" stroke={s.color} strokeWidth="2"><title>{`${s.label} Theil–Sen: ${signed(r.senSlopePerDecade,3)} ${unit}/decade; 95% CI ${signed(r.senCiLowPerDecade,3)} to ${signed(r.senCiHighPerDecade,3)}`}</title></path>
    </g>})}
    <text x="580" y="20" textAnchor="middle" fill="#95b0be" fontSize="15" fontFamily="ui-monospace, monospace">95% slope intervals · {unit}/decade</text></svg></div>
    {plan.excluded.length>0&&<p className="comparison-note">{plan.excluded.map(s=>s.id).join(', ')} not drawn: unit differs from {unit}. See its row below.</p>}
    <div className="comparison-rows" id="comparison-rows">{series.map(s=>{const a=analyzeSeries(s),u=s.variable.unit;return <article className="comparison-point" key={s.id} style={{'--series-color':s.color}}><div className="comparison-location"><span className="comparison-badge">{s.id}</span><strong>{s.label}</strong><small>{s.geo?`${number(s.geo.lat,4)}°, ${number(s.geo.lon,4)}° · `:''}{supportLabel(s.support)}</small><Verdict verdict={a.verdict}/></div><div className="comparison-numbers">
      <div className="comparison-stat"><span>OLS trend</span><strong>{a.trend?`${signed(a.trend.slopePerDecade,3)} ${u}/dec`:'Not estimated'}</strong></div>
      <div className="comparison-stat"><span>OLS 95% CI</span><strong>{a.trend?`${signed(a.trend.ciLowPerDecade,3)} .. ${signed(a.trend.ciHighPerDecade,3)}`:'—'}</strong></div>
      <div className="comparison-stat"><span>OLS t-test p</span><strong>{a.trend?pValue(a.trend.pValue):'—'}</strong></div>
      <div className="comparison-stat"><span>Complete years</span><strong>{a.coverage.completeYears}{a.coverage.missingMonths?` · ${a.coverage.missingMonths} gaps`:''}</strong></div>
      <div className="comparison-stat"><span>Theil–Sen trend</span><strong>{a.robust?`${signed(a.robust.senSlopePerDecade,3)} ${u}/dec`:'—'}</strong></div>
      <div className="comparison-stat"><span>Sen 95% CI</span><strong>{a.robust?`${signed(a.robust.senCiLowPerDecade,3)} .. ${signed(a.robust.senCiHighPerDecade,3)}`:'—'}</strong></div>
      <div className="comparison-stat"><span>Mann–Kendall p</span><strong>{a.robust?pValue(a.robust.pValue):'—'}</strong></div>
      <div className="comparison-stat"><span>Residual lag-1 r</span><strong className={a.dependence?.flagged?'flag':''}>{a.dependence?.r1!=null?number(a.dependence.r1,2)+(a.dependence.flagged?' ⚠':''):'—'}</strong></div>
    </div></article>})}</div><p className="comparison-note">Separate slope tests do not test a difference between series. Paired contrasts below use only shared complete years and compatible series; their HAC interval remains approximate and exploratory. ⚠ marks residual autocorrelation beyond ±1.96/√n, where both p-values may be optimistic.</p>
    {findings.comparisons.map(cmp=>{const paired=cmp.contrast,other=series.find(s=>s.id===cmp.otherId),u=series[0].variable.unit;return <section className="comparison-point paired-contrast" key={'paired-'+cmp.otherId} aria-label="Paired difference in trends">
      <div className="comparison-topline"><div><h3>Paired trend contrast ({cmp.otherId} − {cmp.referenceId})</h3><p>{cmp.paired?'Direct comparison on the same calendar years':'Not computed for incompatible series'}</p></div></div>
      {!cmp.paired?<p className="comparison-note">No paired test: {cmp.reasons.join('; ')}. Use Monthly → Anomaly to compare the shape of {other.label} with {series[0].label}.</p>
      :paired ? <><div className="comparison-numbers">
        <div className="comparison-stat"><span>Paired complete years</span><strong>{paired.n} ({paired.years[0]}–{paired.years.at(-1)})</strong></div>
        <div className="comparison-stat"><span>Difference in fitted slopes</span><strong>{signed(paired.classical.slopePerDecade,3)} {u}/decade</strong></div>
        <div className="comparison-stat"><span>Approximate HAC 95% interval</span><strong>{signed(paired.hac.ciLowPerDecade,3)} to {signed(paired.hac.ciHighPerDecade,3)} {u}/decade</strong></div>
        <div className="comparison-stat"><span>Approximate HAC two-sided p</span><strong>{pValue(paired.hac.pValue)}</strong></div>
      </div><p className="comparison-note">Bartlett Newey–West, lag {paired.hac.lag}; n−2 t reference. Durbin–Watson: {number(paired.hac.durbinWatson)}. Excluded unmatched annual records: {cmp.referenceId} {paired.excludedYearsA.length}, {cmp.otherId} {paired.excludedYearsB.length}. This checks association in two model grid-point series, not causation or a whole-region difference.</p></>
      : <p className="comparison-note">Fewer than ten shared complete calendar years; no paired inference is reported.</p>}
    </section>;})}</div>;
}
function App(){
  const [inputs,setInputs]=useState(initialInputs), [results,setResults]=useState([]), [query,setQuery]=useState(null);
  const [state,setState]=useState('loading'),[status,setStatus]=useState('Retrieving NASA POWER records…'),[dirty,setDirty]=useState(false);
  const [activeTab,setActiveTab]=useState('annual'),[annualRange,setAnnualRange]=useState('all'),[monthlyRange,setMonthlyRange]=useState('all'),[monthlyMode,setMonthlyMode]=useState('monthly');
  const [imported,setImported]=useState(null);
  const request=useRef(null), latestInputs=useRef(inputs), resultsRef=useRef(results);latestInputs.current=inputs;resultsRef.current=results;
  const run=useCallback(async input=>{
    let cfg;try{cfg=validate(input)}catch(error){setStatus(error.message);setState('error');return;}
    request.current?.abort();const controller=new AbortController();request.current=controller;
    let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort()},30000);
    setResults([]);setQuery(null);setDirty(false);setState('loading');setStatus('Retrieving NASA POWER records…');setAnnualRange('all');setMonthlyRange('all');
    try{
      const settled=await Promise.allSettled(cfg.points.map(async(point,index)=>{
        const fetched=await fetchNASA({...point,variable:cfg.variable,start:cfg.start,end:cfg.end},{signal:controller.signal});
        return powerSeries(fetched,{...point,variable:cfg.variable,color:point.color||COLORS[index%COLORS.length]});
      }));
      if(timedOut)throw Error('NASA POWER did not respond within 30 seconds. Please retry.');
      if(controller.signal.aborted)return;
      if(settled[0].status==='rejected')throw settled[0].reason;
      const loaded=settled.filter(s=>s.status==='fulfilled').map(s=>s.value);
      const warnings=settled.flatMap((s,i)=>s.status==='rejected'?[`Point ${cfg.points[i].id} could not load: ${s.reason.message}`]:[]);
      setResults(loaded);setQuery(cfg);setState('success');setStatus(`Loaded ${loaded.length} NASA point${loaded.length===1?'':'s'} · ${loaded.reduce((n,r)=>n+r.monthly.length,0)} valid monthly records.${warnings.length?' '+warnings.join(' '):''}`);
    }catch(error){if(controller.signal.aborted&&!timedOut)return;setState('error');setStatus('Could not retrieve NASA data: '+error.message);}
    finally{clearTimeout(timer);if(request.current===controller)request.current=null;}
  },[]);
  useEffect(()=>{run(latestInputs.current);return ()=>request.current?.abort()},[run]);
  const change=useCallback(patch=>{
    if(request.current){request.current.abort();request.current=null;setState('idle');setStatus('Inputs changed. Run analysis to retrieve data.');}
    else if(resultsRef.current.length){setDirty(true);setStatus('Inputs changed. Run analysis to update the results.');}
    setInputs(current=>({...current,...patch}));
  },[]);
  const selectCity=(id,name)=>{const pair=LOCATIONS[name];change({['city'+id]:name,...(pair?{['lat'+id]:String(pair[0]),['lon'+id]:String(pair[1])}:{})})};
  const pick=(id,p)=>change({['city'+id]:'custom',['lat'+id]:p.lat.toFixed(4),['lon'+id]:p.lon.toFixed(4),...(id==='B'?{compare:true}:id==='C'?{compareC:true}:id==='D'?{compareD:true}:{})});
  // One list of canonical Series feeds every panel; derivations are memoized per Series.
  const series=useMemo(()=>imported?[...results,imported]:results,[results,imported]);
  const findings=useMemo(()=>buildFindings(series),[series]);
  const resultById=useMemo(()=>Object.fromEntries(results.map(s=>[s.id,analyzeSeries(s)])),[results]);
  const active=results[0], primary=active?analyzeSeries(active):null, variable=query?.variable||inputs.variable, info=VARIABLES[variable], trend=primary?.trend, robust=primary?.robust;
  const tabItems=[['annual','Annual trend'],['monthly','Monthly data'],['seasonal','Seasonal'],['comparison','Compare & test'],['finder','Contrast finder'],['giovanni','06 Source']];
  const T=tabItems.length;
  function keyboardTab(e,index){let n;if(e.key==='ArrowRight')n=(index+1)%T;else if(e.key==='ArrowLeft')n=(index+T-1)%T;else if(e.key==='Home')n=0;else if(e.key==='End')n=T-1;if(n!==undefined){e.preventDefault();setActiveTab(tabItems[n][0]);document.getElementById('tab-'+tabItems[n][0])?.focus();}}
  return <><a className="skip" href="#explore">Skip to workspace</a><header className="topbar"><div className="shell nav"><a href="./" className="brand">Terra-Lens</a><span className="nav-subtitle">Earth trend observatory · MERRA-2 / NASA POWER</span><div className="nav-right"><span className="source-indicator"><i className="pulse"/>NASA POWER</span><a href="#contrast-finder" onClick={e=>{e.preventDefault();setActiveTab('finder');}}>Discover contrasts</a><a href="#giovanni" onClick={e=>{e.preventDefault();setActiveTab('giovanni');}}>06 Source</a><a href="./docs/METHODOLOGY.md" target="_blank" rel="noreferrer">Methodology</a><a href="https://github.com/Ni-zav/terra-lens" target="_blank" rel="noreferrer">Source</a></div></div></header>
  <main className="shell explorer" id="explore"><h1 className="sr-only">Earth trend workspace</h1><div className="workspace">
  <aside className="panel controls" aria-label="Analysis settings"><div className="panel-title"><div className="pane-title-group"><span className="section-kicker">Configuration</span><h2>Configure analysis</h2></div><button className="link-button" id="example-button" type="button" onClick={()=>{setInputs({...defaults});run({...defaults})}}>Reset example</button></div>
  <form id="investigation-form" onSubmit={e=>{e.preventDefault();run(inputs)}}>
  <div className="param-block">
    <div className="param-row"><label htmlFor="variable">Variable</label><select id="variable" value={inputs.variable} onChange={e=>change({variable:e.target.value})}>{Object.entries(VARIABLES).map(([key,v])=><option value={key} key={key}>{key} · {v.label} ({v.unit})</option>)}</select></div>
    <p className="hint" id="variable-description">{VARIABLES[inputs.variable].description}</p>
    <div className="year-row"><span className="field-inline-label">Period</span>{[['start','From'],['end','To']].map(([id,label])=><div className="year-cell" key={id}><label className="small-label" htmlFor={id}>{label}</label><input id={id} type="number" min="1981" max="2025" value={inputs[id]} onChange={e=>change({[id]:e.target.value})} required/></div>)}</div>
  </div>
  <div className="locations-matrix">
  {POINT_IDS.map(id=>{
    const isEnabled=pointEnabled(inputs,id);
    const resolvedName=pointName(inputs,id);
    const toggleKey=id==='B'?'compare':'compare'+id;
    const toggleId=id==='B'?'compare':'compare-'+id.toLowerCase();
    return <div className={'loc-slot loc-'+id.toLowerCase()+(isEnabled?' is-active':' is-collapsed')} key={id}>
      {id==='A'
        ? <div className="field-heading"><span><span className="pin a">A</span><strong className="loc-city-badge">{resolvedName}</strong></span><span className="loc-tag">Primary</span></div>
        : <label className="compare-label" htmlFor={toggleId}><span><span className={'pin '+id.toLowerCase()}>{id}</span><strong className="loc-city-badge">{isEnabled?resolvedName:`Compare ${id} (${resolvedName})`}</strong></span><input id={toggleId} type="checkbox" checked={isEnabled} onChange={e=>change({[toggleKey]:e.target.checked})}/></label>}
      {isEnabled&&<div className="loc-body" id={id==='B'?'secondary-location':id!=='A'?'location-'+id.toLowerCase():undefined}>
        <label className="sr-only" htmlFor={'city-'+id.toLowerCase()}>{id==='A'?'Primary':`Point ${id}`} location</label>
        <select id={'city-'+id.toLowerCase()} value={inputs['city'+id]} onChange={e=>selectCity(id,e.target.value)}>
          {Object.keys(LOCATIONS).map(city=><option value={city} key={city}>{city}</option>)}
          <option value="custom">{inputs['city'+id]==='custom'?`${resolvedName} (${Number(inputs['lat'+id]).toFixed(2)}°, ${Number(inputs['lon'+id]).toFixed(2)}°)`:'Custom coordinates'}</option>
        </select>
        <div className="coord-row">{[['lat','Lat',-90,90],['lon','Lon',-180,180]].map(([axis,label,min,max])=><div className="coord-cell" key={axis}><label className="small-label" htmlFor={axis+'-'+id.toLowerCase()}>{label}</label><input id={axis+'-'+id.toLowerCase()} type="number" min={min} max={max} step="any" value={inputs[axis+id]} onChange={e=>change({[axis+id]:e.target.value,['city'+id]:'custom'})} required/></div>)}</div>
      </div>}
    </div>;
  })}
  </div>
  <button id="analyze" className="analyze" type="submit" disabled={state==='loading'}><span>{state==='loading'?'Querying NASA POWER…':'Analyze NASA data'}</span><span className="analyze-kbd">↵</span></button><p className={'status '+(state==='error'?'error':state==='success'?'success':'')} id="status" role="status">{status}</p></form>
  <div className="telemetry-summary" aria-label="Active grid summary">
    <div className="telemetry-head"><span>Pt</span><span>Location</span><span>Coordinates</span><span>Slope/dec</span></div>
    {POINT_IDS.map(id=>{
      const enabled=pointEnabled(inputs,id);
      const res=resultById[id];
      const name=pointName(inputs,id);
      return <div className={'telemetry-row'+(enabled?' is-on':' is-off')} key={id}>
        <span className={'pin '+id.toLowerCase()}>{id}</span>
        <strong className="telemetry-city">{name}</strong>
        <span className="telemetry-coord">{Number(inputs['lat'+id]).toFixed(1)}°, {Number(inputs['lon'+id]).toFixed(1)}°</span>
        <span className="telemetry-val">{enabled?(res?.trend?`${signed(res.trend.slopePerDecade)} ${info.unit}`:res?'n/a':'Pending'):'Off'}</span>
      </div>;
    })}
  </div>
  <p className="aside-note">Locations are NASA model grid-point estimates, not city-wide measurements.</p></aside>
  <section className="results" aria-label="Analysis results"><div className="result-heading"><div className="result-title-bar"><span className="section-kicker">Time series</span><strong>Historical trends</strong><p id="result-context">{query?`${dirty?'Previous result: ':''}${info.label} · ${query.start}–${query.end}`:'Waiting for NASA data'}</p></div><span className={'data-state '+(state==='success'&&!dirty?'live':'')} id="data-label">{dirty?'Inputs changed':state==='success'?'NASA data loaded':state==='loading'?'Loading':state==='error'?'Request failed':'Not loaded'}</span></div>
  <div className="metrics">
    <div className="metric"><div className="metric-label">A · {active?active.label:pointName(inputs,'A')} · OLS trend / dec</div><strong id="metric-slope">{trend?`${signed(trend.slopePerDecade)} ${info.unit}`:'—'}</strong><p id="metric-slope-detail">{trend?`95% CI: ${signed(trend.ciLowPerDecade)} to ${signed(trend.ciHighPerDecade)} · p ${pValue(trend.pValue)}`:'Complete-year OLS fit'}</p></div>
    <div className="metric"><div className="metric-label">Theil–Sen / Mann–Kendall</div><strong id="metric-robust">{robust?`${signed(robust.senSlopePerDecade)} ${info.unit}`:'—'}</strong><p id="metric-robust-detail">{robust?`95% CI: ${signed(robust.senCiLowPerDecade)} to ${signed(robust.senCiHighPerDecade)} · MK p ${pValue(robust.pValue)}`:'Rank-based, outlier resistant'}</p></div>
    <div className="metric"><div className="metric-label">Evidence (Point A)</div><strong id="metric-significance" className={'verdict-text verdict-'+(primary?.verdict.level||'none')}>{primary?primary.verdict.headline:'—'}</strong><p id="metric-significance-detail">{primary?(primary.verdict.level==='insufficient'?primary.verdict.detail:`${primary.verdict.testsAgreeing}/2 tests p < 0.05${primary.verdict.dependenceFlag?' · autocorrelated ⚠':''}`):'OLS t-test + Mann–Kendall'}</p></div>
    <div className="metric"><div className="metric-label">Years analyzed</div><strong id="metric-years">{primary?primary.coverage.completeYears:'—'}</strong><p id="metric-years-detail">{primary?.annual.length?`Full years · ${primary.annual[0].year}–${primary.annual.at(-1).year}${primary.coverage.missingMonths?` · ${primary.coverage.missingMonths} missing months`:''}`:'Complete calendar years'}</p></div>
  </div>
  <div className="chart-shell"><div className="chart-tabs" role="tablist" aria-label="Analysis views">{tabItems.map(([id,label],i)=><button key={id} role="tab" id={'tab-'+id} aria-selected={activeTab===id} aria-controls={'panel-'+id} tabIndex={activeTab===id?0:-1} onClick={()=>setActiveTab(id)} onKeyDown={e=>keyboardTab(e,i)}>{label}</button>)}<span className="chip" id="unit-chip">{results.length?`${info.unit} / ${info.label}`:'NASA POWER'}</span></div><div className="chart-views">
  {activeTab==='comparison'?<section id="panel-comparison" role="tabpanel" aria-labelledby="tab-comparison">{series.length?<Comparison series={series} findings={findings}/>:<p className="comparison-empty">Run an analysis to compare slope estimates.</p>}</section>
  :activeTab==='finder'?<section id="panel-finder" role="tabpanel" aria-labelledby="tab-finder"><React.Suspense fallback={<p className="comparison-empty">Loading regional evidence finder…</p>}><ContrastFinder onInspect={patch=>{const next={...inputs,...patch};setInputs(next);run(next);setActiveTab('annual');}}/></React.Suspense></section>
  :activeTab==='giovanni'?<section id="panel-giovanni" role="tabpanel" aria-labelledby="tab-giovanni"><React.Suspense fallback={<p className="comparison-empty">Loading independent dataset workspace…</p>}><GiovanniEvidence imported={imported} onImport={setImported} onRemove={()=>setImported(null)}/></React.Suspense></section>
  :<article className="chart-panel" id={'panel-'+activeTab} role="tabpanel" aria-labelledby={'tab-'+activeTab}><div className="chart-heading"><div className="pane-title-group"><h3>{{annual:'Annual mean & fitted trend',monthly:monthlyMode==='anomaly'?'Monthly anomalies':'Monthly values',seasonal:'Which months are changing?'}[activeTab]}</h3><p>{{annual:'Complete-year, day-weighted averages',monthly:monthlyMode==='anomaly'?'Seasonal cycle removed, so different places share one baseline':'NASA monthly values, without gap filling',seasonal:'Per-calendar-month trends and the mean seasonal cycle'}[activeTab]}</p></div></div>
  <React.Suspense fallback={<p>Loading chart…</p>}>{activeTab==='seasonal'?<SeasonalChart series={series}/>
    :<TimeChart key={activeTab} series={series} mode={activeTab==='annual'?'annual':monthlyMode} setMode={setMonthlyMode} range={activeTab==='annual'?annualRange:monthlyRange} setRange={activeTab==='annual'?setAnnualRange:setMonthlyRange}/>}</React.Suspense></article>}
  </div></div></section>
  <aside className="location-column" aria-label="Location and data source"><Globe inputs={inputs} onPick={pick}/><section className="insight-card"><div className="pane-title-group"><span className="section-kicker">Inference</span></div><div className="finding"><p id="finding-text">{findings.lines.length?findings.lines.join(' '):'Results will appear after NASA data loads.'}</p>{findings.lines.length>0&&<p className="finding-caveat">Both tests assume independent annual values; serial correlation and repeated searches can overstate confidence. Not causal, not a forecast.</p>}</div><a href="./docs/METHODOLOGY.md" target="_blank" rel="noreferrer">Assumptions and limitations</a></section><section className="sources-card" id="sources"><div><div className="pane-title-group"><span className="section-kicker">Provenance</span></div><p id="provenance-text">{active?`NASA POWER${active.provenance.metadata?.sources?.length?' / '+active.provenance.metadata.sources.join(', '):''} · retrieved ${new Date(active.provenance.retrievedAt).toLocaleString('en-US')} · ${series.map(r=>`${r.id}: ${r.monthly.length} months`).join(' · ')}. Model-derived point estimates${imported?'; G is a user-imported Giovanni file (not authenticated)':''}.`:'Waiting for NASA POWER monthly data.'}</p><p id="source-link">{results.length?results.map((r,i)=><React.Fragment key={r.id}>{i?' · ':''}<a href={r.provenance.url} target="_blank" rel="noreferrer">NASA {r.id} ({r.label})</a></React.Fragment>):<a href="https://power.larc.nasa.gov/docs/services/api/temporal/monthly/" target="_blank" rel="noreferrer">NASA POWER documentation</a>}</p></div><div className="source-actions"><button id="download" disabled={!results.length} onClick={()=>csvDownload(series)}>Download CSV</button><button id="evidence-download" disabled={!results.length} onClick={()=>evidenceDownload(series,findings)}>Evidence JSON</button><button id="share" onClick={async()=>{const url=makeShare(inputs);try{await navigator.clipboard.writeText(url);setStatus('Investigation URL copied.')}catch{window.prompt('Copy this investigation URL:',url)}}}>Copy link</button></div></section></aside>
  </div></main></>;
}

createRoot(document.getElementById('root')).render(<App/>);

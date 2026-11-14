import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {annualMeans, linearTrend} from '../stats.js';
import {pairedContrast} from '../contrast.js';
import {VARIABLES, LOCATIONS, fetchNASA, requestURL} from '../power.js';
const TimeChart=React.lazy(()=>import('./Chart.jsx').then(module=>({default:module.TimeChart})));
import './base.css';
import '../../styles/workspace.css';
import './react.css';
import './quiet.css';

const COLORS=['#62d6e4','#f6b975'];
const number=(v,d=2)=>Number.isFinite(v)?new Intl.NumberFormat('en-US',{maximumFractionDigits:d}).format(v):'—';
const signed=(v,d=2)=>(v>0?'+':'')+number(v,d);
const pValue=p=>p<.0001?'< 0.0001':number(p,4);
const defaults={variable:'T2M',start:'2001',end:'2024',cityA:'Yogyakarta',latA:'-7.7956',lonA:'110.3695',
  compare:true,cityB:'Jakarta',latB:'-6.2088',lonB:'106.8456'};
function initialInputs(){
  const q=new URLSearchParams(location.search), next={...defaults};
  for(const k of ['variable','start','end','cityA','latA','lonA','cityB','latB','lonB']) if(q.has(k))next[k]=q.get(k);
  if(!Object.hasOwn(VARIABLES,next.variable))next.variable=defaults.variable;
  for(const side of ['A','B'])if(!Object.hasOwn(LOCATIONS,next['city'+side])&&next['city'+side]!=='custom')next['city'+side]='custom';
  if(q.has('compare'))next.compare=q.get('compare')==='1';
  return next;
}
function validate(inputs){
  const start=Number(inputs.start),end=Number(inputs.end);
  if(!Number.isInteger(start)||!Number.isInteger(end)||end-start<9)throw Error('Choose at least 10 calendar years.');
  const points=['A',...(inputs.compare?['B']:[])].map(id=>{
    if(!inputs['lat'+id].trim()||!inputs['lon'+id].trim())throw Error('Enter latitude and longitude for each selected point.');
    const lat=Number(inputs['lat'+id]),lon=Number(inputs['lon'+id]);
    requestURL({lat,lon,variable:inputs.variable,start,end});
    return {id,lat,lon,label:inputs['city'+id]==='custom'?'Custom '+id:inputs['city'+id]};
  });
  return {variable:inputs.variable,start,end,points};
}
function makeShare(inputs){
  const url=new URL(location.href); url.search='';
  for(const k of ['variable','start','end','cityA','latA','lonA','cityB','latB','lonB'])url.searchParams.set(k,inputs[k]);
  url.searchParams.set('compare',inputs.compare?'1':'0');url.searchParams.set('auto','1');return url.href;
}
function csvDownload(results){
  if(!results.length)return;
  const columns=['location','latitude','longitude','variable','year','month','value','unit','source_url','retrieved_at'];
  const quote=v=>'"'+String(v).replaceAll('"','""')+'"';
  const rows=[columns.join(',')];
  for(const item of results) for(const p of item.monthly)rows.push([item.label,item.lat,item.lon,item.variable,p.year,p.month,p.value,
    VARIABLES[item.variable].unit,item.url,item.fetchedAt].map(quote).join(','));
  const url=URL.createObjectURL(new Blob([rows.join('\n')+'\n'],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=`terra-lens-nasa-power-${results[0].variable}.csv`;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function evidenceDownload(results) {
  if (!results.length) return;
  const pairing = results.length === 2 ? pairedContrast(results[0].annual, results[1].annual) : null;
  const payload = {
    schema: 'terra-lens-evidence-v1',
    generatedAt: new Date().toISOString(),
    provenanceNote: 'Actual NASA POWER responses retrieved at runtime. Statistical estimates are derived, not raw observations.',
    method: 'Day-weighted full-year monthly means; classical OLS. Paired B-A aligned-year contrast with exploratory Bartlett Newey-West HAC.',
    limitations: 'Point estimates are not whole-city measurements. HAC uncertainty is approximate; no causation, forecast or correction for multiple exploratory searches.',
    sources: results.map(r=>({id:r.id,label:r.label,lat:r.lat,lon:r.lon,variable:r.variable,unit:VARIABLES[r.variable].unit,source:r.source,sourceURL:r.url,retrievedAt:r.fetchedAt,metadata:r.metadata,monthly:r.monthly,annual:r.annual,trend:r.trend})),
    pairedContrast: pairing
  };
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)+'\n'],{type:'application/json;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='terra-lens-auditable-evidence.json';
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function Globe({inputs,onPick}){
  const host=useRef(null),globe=useRef(null),pickRef=useRef(onPick),[target,setTarget]=useState('A'),targetRef=useRef('A');
  const [status,setStatus]=useState('Drag to rotate · Click to place point A');
  pickRef.current=onPick;targetRef.current=target;
  useEffect(()=>{
    let disposed=false;
    const observer=new IntersectionObserver(async entries=>{
      if(!entries.some(e=>e.isIntersecting))return;observer.disconnect();
      try{
        const {createGlobe}=await import('../globe.js');if(disposed)return;
        globe.current=createGlobe(host.current,point=>{
          const side=targetRef.current;pickRef.current(side,point);
          setStatus(`Point ${side}: ${point.lat.toFixed(4)}°, ${point.lon.toFixed(4)}°. Run analysis to update.`);
        });
        globe.current.setPoints(pointsRef.current);
      }catch{if(!disposed&&host.current){host.current.dataset.error='true';host.current.textContent='Globe unavailable. Use coordinates.';}}
    },{rootMargin:'200px'});observer.observe(host.current);
    return ()=>{disposed=true;observer.disconnect();globe.current?.dispose?.();};
  },[]);
  const points=useMemo(()=>['A',...(inputs.compare?['B']:[])].map(id=>({id,
    lat:inputs['lat'+id].trim()?Number(inputs['lat'+id]):NaN,
    lon:inputs['lon'+id].trim()?Number(inputs['lon'+id]):NaN})),[inputs.latA,inputs.lonA,inputs.latB,inputs.lonB,inputs.compare]);
  const pointsRef=useRef(points);pointsRef.current=points;
  useEffect(()=>{globe.current?.setPoints(points)},[points]);
  return <section className="globe-panel" aria-labelledby="globe-heading"><div className="globe-copy"><div className="globe-title"><div><span className="section-kicker">Location</span><h2 id="globe-heading">Explore Earth</h2></div><button type="button" id="globe-center" onClick={()=>{const p=points.find(p=>p.id===target);if(p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon))globe.current?.focus(p)}}>Center</button></div>
    <div className="globe-controls" role="group" aria-label="Point to place on the globe">{['A','B'].map(id=><button type="button" key={id} id={'globe-'+id.toLowerCase()} aria-pressed={target===id} onClick={()=>{setTarget(id);setStatus(`Drag to rotate · Click to place point ${id}`)}}>Point {id}</button>)}</div><p id="globe-status" className="globe-status" role="status">{status}</p></div>
    <div ref={host} id="earth-globe" className="earth-globe" aria-label="Interactive Earth globe"/>
    <p className="globe-credit">Historical <a href="https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/" target="_blank" rel="noreferrer">NASA Blue Marble</a> imagery (2001) · Context only, not live data.</p></section>;
}
function Confidence({results,unit}){
  const paired=results.length===2 ? pairedContrast(results[0].annual,results[1].annual) : null;
  const valid=results.filter(r=>r.trend&&Number.isFinite(r.trend.ciLowPerDecade)&&Number.isFinite(r.trend.ciHighPerDecade));
  if(!valid.length)return <p className="comparison-empty">At least 10 complete years are needed to estimate a trend.</p>;
  let min=Math.min(0,...valid.map(r=>r.trend.ciLowPerDecade)),max=Math.max(0,...valid.map(r=>r.trend.ciHighPerDecade));const padding=(max-min||.5)*.13;min-=padding;max+=padding;
  const x=v=>256+(v-min)/(max-min)*640;
  return <div className="comparison-panel" id="comparison-panel"><div className="comparison-topline"><div><h3>Classical slope intervals</h3><p>95% intervals for each point independently</p></div></div>
    <div className="confidence-wrap" tabIndex="0" role="region" aria-label="Classical slope intervals"><svg id="confidence-chart" viewBox="0 0 960 194" role="img" aria-label="Separate classical 95 percent slope confidence intervals">
    {[0,1,2,3,4].map(i=>{const value=min+(max-min)*i/4;return <g key={i}><line x1={x(value)} y1="43" x2={x(value)} y2="171" stroke="#284252"/><text x={x(value)} y="187" fill="#acbdc8" textAnchor="middle" fontSize="19">{number(value,2)}</text></g>})}
    <line x1={x(0)} y1="43" x2={x(0)} y2="171" stroke="#b4d4dc" strokeDasharray="5 6"/>
    {valid.map((r,i)=>{const y=valid.length===1?98:80+i*63,t=r.trend;return <g key={r.id}><text x="22" y={y+4} fill="#e4f2f5" fontSize="20">{r.id} · {r.label}</text><line x1={x(t.ciLowPerDecade)} x2={x(t.ciHighPerDecade)} y1={y} y2={y} stroke={r.color} strokeWidth="7" strokeLinecap="round"/><circle cx={x(t.slopePerDecade)} cy={y} r="9" fill={r.color}><title>{`${r.label}: ${signed(t.slopePerDecade,3)} ${unit}/decade; 95% CI ${signed(t.ciLowPerDecade,3)} to ${signed(t.ciHighPerDecade,3)}`}</title></circle></g>})}
    <text x="580" y="18" textAnchor="middle" fill="#b7c9d3" fontSize="18">Classical 95% slope intervals · {unit}/decade</text></svg></div>
    <div className="comparison-rows" id="comparison-rows">{results.map(r=><article className="comparison-point" key={r.id} style={{'--series-color':r.color}}><div className="comparison-location"><span className="comparison-badge">{r.id}</span><strong>{r.label}</strong><small>{number(r.lat,4)}°, {number(r.lon,4)}°</small></div><div className="comparison-numbers">
      <div className="comparison-stat"><span>Complete years</span><strong>{r.annual.length}</strong></div><div className="comparison-stat"><span>Linear trend</span><strong>{r.trend?`${signed(r.trend.slopePerDecade,3)} ${unit}/decade`:'Not estimated'}</strong></div><div className="comparison-stat"><span>Classical 95% slope interval</span><strong>{r.trend?`${signed(r.trend.ciLowPerDecade,3)} to ${signed(r.trend.ciHighPerDecade,3)}`:'—'}</strong></div><div className="comparison-stat"><span>Classical two-sided p</span><strong>{r.trend?pValue(r.trend.pValue):'—'}</strong></div>
    </div></article>)}</div><p className="comparison-note">Separate slope tests do not test the contrast. The paired comparison below uses only shared complete years; its HAC interval remains approximate and exploratory.</p>
    {results.length===2 && <section className="comparison-point" aria-label="Paired difference in trends">
      <div className="comparison-topline"><div><h3>Paired trend contrast (B − A)</h3><p>Direct comparison on the same calendar years</p></div></div>
      {paired ? <><div className="comparison-numbers">
        <div className="comparison-stat"><span>Paired complete years</span><strong>{paired.n} ({paired.years[0]}–{paired.years.at(-1)})</strong></div>
        <div className="comparison-stat"><span>Difference in fitted slopes</span><strong>{signed(paired.classical.slopePerDecade,3)} {unit}/decade</strong></div>
        <div className="comparison-stat"><span>Approximate HAC 95% interval</span><strong>{signed(paired.hac.ciLowPerDecade,3)} to {signed(paired.hac.ciHighPerDecade,3)} {unit}/decade</strong></div>
        <div className="comparison-stat"><span>Approximate HAC two-sided p</span><strong>{pValue(paired.hac.pValue)}</strong></div>
      </div><p className="comparison-note">Bartlett Newey–West, lag {paired.hac.lag}; n−2 t reference. Durbin–Watson: {number(paired.hac.durbinWatson)}. Excluded unmatched annual records: A {paired.excludedYearsA.length}, B {paired.excludedYearsB.length}. This checks association in two model grid-point series, not causation or a whole-region difference. Residual dependence, uncertainty in the NASA inputs and exploratory multiple testing remain limitations.</p></>
      : <p className="comparison-note">Fewer than ten shared complete calendar years; no paired inference is reported.</p>}
    </section>}</div>;
}
function App(){
  const [inputs,setInputs]=useState(initialInputs), [results,setResults]=useState([]), [query,setQuery]=useState(null);
  const [state,setState]=useState('loading'),[status,setStatus]=useState('Retrieving NASA POWER records…'),[dirty,setDirty]=useState(false);
  const [activeTab,setActiveTab]=useState('annual'),[annualRange,setAnnualRange]=useState('all'),[monthlyRange,setMonthlyRange]=useState('all');
  const request=useRef(null), latestInputs=useRef(inputs), resultsRef=useRef(results);latestInputs.current=inputs;resultsRef.current=results;
  const run=useCallback(async input=>{
    let cfg;try{cfg=validate(input)}catch(error){setStatus(error.message);setState('error');return;}
    request.current?.abort();const controller=new AbortController();request.current=controller;
    let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort()},30000);
    setResults([]);setQuery(null);setDirty(false);setState('loading');setStatus('Retrieving NASA POWER records…');setAnnualRange('all');setMonthlyRange('all');
    try{
      const settled=await Promise.allSettled(cfg.points.map(async(point,index)=>{
        const fetched=await fetchNASA({...point,variable:cfg.variable,start:cfg.start,end:cfg.end},{signal:controller.signal});
        const annual=annualMeans(fetched.monthly);
        return {...fetched,...point,variable:cfg.variable,color:COLORS[index],annual,trend:linearTrend(annual)};
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
  const pick=(id,p)=>change({['city'+id]:'custom',['lat'+id]:p.lat.toFixed(4),['lon'+id]:p.lon.toFixed(4),...(id==='B'?{compare:true}:{})});
  const active=results[0], variable=query?.variable||inputs.variable, info=VARIABLES[variable], trend=active?.trend;
  const tabItems=[['annual','Annual trend'],['monthly','Monthly data'],['comparison','Compare slopes']];
  const insight=trend?`A: ${signed(trend.slopePerDecade)} ${info.unit}/decade${results[1]?.trend?` · B: ${signed(results[1].trend.slopePerDecade)} ${info.unit}/decade. Difference is descriptive.`:'.'} Classical OLS assumes independent residuals; serial correlation and repeated searches can overstate confidence.`:'Results will appear after NASA data loads.';
  function keyboardTab(e,index){let n;if(e.key==='ArrowRight')n=(index+1)%3;else if(e.key==='ArrowLeft')n=(index+2)%3;else if(e.key==='Home')n=0;else if(e.key==='End')n=2;if(n!==undefined){e.preventDefault();setActiveTab(tabItems[n][0]);document.getElementById('tab-'+tabItems[n][0])?.focus();}}
  return <><a className="skip" href="#explore">Skip to workspace</a><header className="topbar"><div className="shell nav"><a href="./" className="brand">terra-lens</a><span className="nav-subtitle">Earth trend workspace</span><div className="nav-right"><span className="source-indicator">NASA POWER</span><a href="./docs/METHODOLOGY.md" target="_blank" rel="noreferrer">Methodology</a><a href="https://github.com/Ni-zav/terra-lens" target="_blank" rel="noreferrer">Source</a></div></div></header>
  <main className="shell explorer" id="explore"><h1 className="sr-only">Earth trend workspace</h1><div className="workspace">
  <aside className="panel controls" aria-label="Analysis settings"><div className="panel-title"><div><span className="section-kicker">Settings</span><h2>Configure analysis</h2></div><button className="link-button" id="example-button" type="button" onClick={()=>{setInputs({...defaults});run({...defaults})}}>Reset example</button></div>
  <form id="investigation-form" onSubmit={e=>{e.preventDefault();run(inputs)}}><label htmlFor="variable">Variable</label><select id="variable" value={inputs.variable} onChange={e=>change({variable:e.target.value})}>{Object.entries(VARIABLES).map(([key,v])=><option value={key} key={key}>{v.label} · {key}</option>)}</select><p className="hint" id="variable-description">{VARIABLES[inputs.variable].description}</p>
  <div className="field-heading">Period</div><div className="year-row">{[['start','From'],['end','To']].map(([id,label])=><div key={id}><label className="small-label" htmlFor={id}>{label}</label><input id={id} type="number" min="1981" max="2025" value={inputs[id]} onChange={e=>change({[id]:e.target.value})} required/></div>)}</div>
  {['A','B'].map(id=><React.Fragment key={id}>{id==='A'?<div className="field-heading"><span><span className="pin a">A</span> Location</span></div>:<label className="compare-label" htmlFor="compare"><span><span className="pin b">B</span> Compare location</span><input id="compare" type="checkbox" checked={inputs.compare} onChange={e=>change({compare:e.target.checked})}/></label>}
    {(id==='A'||inputs.compare)&&<div id={id==='B'?'secondary-location':undefined}><label className="sr-only" htmlFor={'city-'+id.toLowerCase()}>{id==='A'?'Primary':'Second'} location</label><select id={'city-'+id.toLowerCase()} value={inputs['city'+id]} onChange={e=>selectCity(id,e.target.value)}>{Object.keys(LOCATIONS).map(city=><option value={city} key={city}>{city}</option>)}<option value="custom">Custom coordinates</option></select><div className="coord-row">{[['lat','Latitude',-90,90],['lon','Longitude',-180,180]].map(([axis,label,min,max])=><div key={axis}><label className="small-label" htmlFor={axis+'-'+id.toLowerCase()}>{label}</label><input id={axis+'-'+id.toLowerCase()} type="number" min={min} max={max} step="any" value={inputs[axis+id]} onChange={e=>change({[axis+id]:e.target.value,['city'+id]:'custom'})} required/></div>)}</div></div>}</React.Fragment>)}
  <button id="analyze" className="analyze" type="submit" disabled={state==='loading'}>{state==='loading'?'Querying NASA POWER…':'Analyze NASA data'}</button><p className={'status '+(state==='error'?'error':state==='success'?'success':'')} id="status" role="status">{status}</p></form><p className="aside-note">Locations are NASA model grid-point estimates, not city-wide measurements.</p></aside>
  <section className="results" aria-label="Analysis results"><div className="result-heading"><div><span className="section-kicker">Analysis</span><strong>Historical trends</strong><p id="result-context">{query?`${dirty?'Previous result: ':''}${info.label} · ${query.start}–${query.end}`:'Waiting for NASA data'}</p></div><span className={'data-state '+(state==='success'&&!dirty?'live':'')} id="data-label">{dirty?'Inputs changed':state==='success'?'NASA data loaded':state==='loading'?'Loading':state==='error'?'Request failed':'Not loaded'}</span></div>
  <div className="metrics"><div className="metric"><div className="metric-label">A trend per decade</div><strong id="metric-slope">{trend?`${signed(trend.slopePerDecade)} ${info.unit}`:'—'}</strong><p id="metric-slope-detail">{trend?`95% CI: ${signed(trend.ciLowPerDecade)} to ${signed(trend.ciHighPerDecade)} ${info.unit}/decade`:'Complete-year OLS fit'}</p></div><div className="metric"><div className="metric-label">OLS test</div><strong id="metric-significance" className={trend?(trend.significant?'yes':'no'):''}>{trend?(trend.significant?'Significant*':'Not significant'):'—'}</strong><p id="metric-significance-detail">{trend?`p ${pValue(trend.pValue)} · classical OLS test`:'Two-sided t-test'}</p></div><div className="metric"><div className="metric-label">Years analyzed</div><strong id="metric-years">{active?active.annual.length:'—'}</strong><p id="metric-years-detail">{active?.annual.length?`Full years · ${active.annual[0].year} to ${active.annual.at(-1).year}`:'Complete calendar years'}</p></div></div>
  <div className="chart-shell"><div className="chart-tabs" role="tablist" aria-label="Analysis views">{tabItems.map(([id,label],i)=><button key={id} role="tab" id={'tab-'+id} aria-selected={activeTab===id} aria-controls={'panel-'+id} tabIndex={activeTab===id?0:-1} onClick={()=>setActiveTab(id)} onKeyDown={e=>keyboardTab(e,i)}>{label}</button>)}</div><div className="chart-views">
  {activeTab==='comparison'?<section id="panel-comparison" role="tabpanel" aria-labelledby="tab-comparison">{results.length?<Confidence results={results} unit={info.unit}/>:<p className="comparison-empty">Run an analysis to compare slope estimates.</p>}</section>:<article className="chart-panel" id={'panel-'+activeTab} role="tabpanel" aria-labelledby={'tab-'+activeTab}><div className="chart-heading"><div><h3>{activeTab==='annual'?'Annual mean & fitted trend':'Monthly values'}</h3><p>{activeTab==='annual'?'Complete-year, day-weighted averages':'NASA POWER monthly values, without gap filling'}</p></div><span className="chip" id="unit-chip">{results.length?`${info.unit} / ${info.label}`:'NASA POWER'}</span></div><React.Suspense fallback={<p>Loading chart…</p>}><TimeChart key={activeTab} results={results} monthly={activeTab==='monthly'} unit={info.unit} range={activeTab==='annual'?annualRange:monthlyRange} setRange={activeTab==='annual'?setAnnualRange:setMonthlyRange}/></React.Suspense></article>}
  </div></div></section>
  <aside className="location-column" aria-label="Location and data source"><Globe inputs={inputs} onPick={pick}/><section className="insight-card"><span className="section-kicker">Interpretation</span><div className="finding"><p id="finding-text">{insight}</p></div><a href="./docs/METHODOLOGY.md" target="_blank" rel="noreferrer">Assumptions and limitations</a></section><section className="sources-card" id="sources"><div><span className="section-kicker">Source and provenance</span><p id="provenance-text">{active?`NASA POWER${active.metadata.sources?.length?' / '+active.metadata.sources.join(', '):''} · retrieved ${new Date(active.fetchedAt).toLocaleString('en-US')} · ${results.map(r=>`${r.id}: ${r.monthly.length} months`).join(' · ')}. Model-derived point estimates.`:'Waiting for NASA POWER monthly data.'}</p><p id="source-link">{results.length?results.map((r,i)=><React.Fragment key={r.id}>{i?' · ':''}<a href={r.url} target="_blank" rel="noreferrer">NASA request {r.id}</a></React.Fragment>):<a href="https://power.larc.nasa.gov/docs/services/api/temporal/monthly/" target="_blank" rel="noreferrer">NASA POWER documentation</a>}</p></div><div className="source-actions"><button id="download" disabled={!results.length} onClick={()=>csvDownload(results)}>Download CSV</button><button id="evidence-download" disabled={!results.length} onClick={()=>evidenceDownload(results)}>Evidence JSON</button><button id="share" onClick={async()=>{const url=makeShare(inputs);try{await navigator.clipboard.writeText(url);setStatus('Investigation URL copied.')}catch{window.prompt('Copy this investigation URL:',url)}}}>Copy link</button></div></section></aside>
  </div></main></>;
}

createRoot(document.getElementById('root')).render(<App/>);

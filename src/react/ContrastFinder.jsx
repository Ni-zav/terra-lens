import React, {useEffect,useMemo,useRef,useState} from 'react';
import {VARIABLES,fetchNASA} from '../power.js';
import {SENTINEL_POINTS,investigationFor,samplePoints,summarizeDiscovery,
  makeResearchBrief,discoveryEvidence} from '../discovery.js';
import {pairedContrast} from '../contrast.js';
import './discovery.css';

const OPTIONS=['T2M','T2M_MAX','RH2M','PRECTOTCORR'];
const cache=new Map();
const CACHE_MS=15*60*1000;
const format=(n,d=3)=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{maximumFractionDigits:d}).format(n):'—';
const signed=n=>(n>0?'+':'')+format(n);
function takeFile(name,payload) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)+'\n'],{type:'application/json;charset=utf-8'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=name;
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function cachedNASA(opts,{signal}) {
  const key=[opts.variable,opts.start,opts.end,opts.lat.toFixed(4),opts.lon.toFixed(4)].join(':');
  const saved=cache.get(key);
  if(saved&&Date.now()-saved.time<CACHE_MS)return {...saved.data,cacheHit:true};
  const data=await fetchNASA(opts,{signal});
  cache.set(key,{time:Date.now(),data});
  return {...data,cacheHit:false};
}
function investigateUrl(a,b,variable,start,end) {
  const u=new URL(window.location.href);
  u.search='';
  for(const [key,value] of Object.entries({
    variable,start,end,compare:'1',cityA:'custom',cityB:'custom',
    latA:a.lat,lonA:a.lon,latB:b.lat,lonB:b.lon,auto:'1'
  }))u.searchParams.set(key,String(value));
  u.hash='explore';return u.href;
}
function CoordinatePlot({records}) {
  const byId=new Map(records.map(r=>[r.id,r]));
  const x=lon=>56+(lon-92)/32*690;
  const y=lat=>247-(lat+12)/19*193;
  return <figure className="discovery-figure">
    <svg viewBox="0 0 800 295" role="img" aria-label="Eight predeclared Indonesian coordinate sample points plotted by longitude and latitude. Colors show sampling status, not climate intensity.">
      <rect x="56" y="54" width="690" height="193" rx="9" fill="#0c2331" stroke="#426273" />
      {[95,105,115,125].filter(v=>v<=124).map(v=><g key={v}><line x1={x(v)} x2={x(v)} y1="54" y2="247" stroke="#284552"/><text x={x(v)} y="270" fill="#b6cdd6" textAnchor="middle" fontSize="14">{v}°E</text></g>)}
      {[-10,-5,0,5].map(v=><g key={v}><line y1={y(v)} y2={y(v)} x1="56" x2="746" stroke="#284552"/><text x="45" y={y(v)+4} fill="#b6cdd6" textAnchor="end" fontSize="13">{v}°</text></g>)}
      {SENTINEL_POINTS.map((p,i)=>{
        const r=byId.get(p.id),status=r?.status||'waiting';
        const color=status==='error'?'#e7a29b':status==='insufficient-years'?'#f1cb83':status==='ok'?'#74d5d6':'#8598a8';
        return <g key={p.id}><circle cx={x(p.lon)} cy={y(p.lat)} r="13" fill={color} stroke="#0b202b" strokeWidth="2"/><text x={x(p.lon)} y={y(p.lat)+4.3} textAnchor="middle" fontSize="12" fontWeight="700" fill="#071c29">{i+1}</text><title>{p.label}: {status}</title></g>;
      })}
      <text x="400" y="28" textAnchor="middle" fill="#e6f4f5" fontWeight="700" fontSize="17">Sampling coordinates · not a climate raster</text>
      <text x="400" y="290" textAnchor="middle" fill="#afc5cf" fontSize="12">Schematic lat/lon plot; numbered points match the table</text>
    </svg>
    <figcaption>Numbers indicate fixed sampling coordinates. Colors indicate request status only—never temperature or risk. These points do not cover, interpolate, or represent all of Indonesia.</figcaption>
  </figure>;
}
export default function ContrastFinder() {
  const [variable,setVariable]=useState('T2M');
  const [start,setStart]=useState('2001'),[end,setEnd]=useState('2024');
  const [run,setRun]=useState({phase:'idle',records:[],completed:0,error:''});
  const [pointA,setPointA]=useState(''),[pointB,setPointB]=useState('');
  const controller=useRef(null),generation=useRef(0);
  useEffect(()=>()=>{generation.current++;controller.current?.abort();},[]);
  function reset(next) {
    generation.current++;controller.current?.abort();
    setRun({phase:'idle',records:[],completed:0,error:''});setPointA('');setPointB('');
    next?.();
  }
  async function startScan() {
    generation.current++;controller.current?.abort();
    const current=generation.current,abort=new AbortController();controller.current=abort;
    const first=Number(start),last=Number(end);
    if(!Number.isInteger(first)||!Number.isInteger(last)||first<1981||last>2025||last-first<9) {
      setRun({phase:'error',records:[],completed:0,error:'Choose 10 or more calendar years from 1981 to 2025.'});return;
    }
    setRun({phase:'loading',records:[],completed:0,error:''});setPointA('');setPointB('');
    try {
      const records=await samplePoints({variable,start:first,end:last,signal:abort.signal,
        fetchPoint:cachedNASA,concurrency:3,onProgress:({records,completed})=>{
          if(generation.current===current)setRun({phase:'loading',records,completed,error:''});
        }});
      if(generation.current!==current)return;
      const summary=summarizeDiscovery(records);
      setRun({phase:'complete',records,completed:records.length,error:''});
      if(summary.low&&summary.high&&summary.low.id!==summary.high.id) {
        setPointA(summary.low.id);setPointB(summary.high.id);
      }
    } catch(error) {
      if(generation.current!==current)return;
      setRun({phase:error?.name==='AbortError'?'cancelled':'error',records:[],
        completed:0,error:error?.name==='AbortError'?'Investigation cancelled.':'Investigation failed: '+String(error.message||error)});
    }
  }
  const summary=useMemo(()=>summarizeDiscovery(run.records),[run.records]);
  const brief=useMemo(()=>makeResearchBrief(summary,variable,Number(start),Number(end)),
    [summary,variable,start,end]);
  const index=useMemo(()=>new Map(run.records.map(r=>[r.id,r])),[run.records]);
  const a=index.get(pointA),b=index.get(pointB);
  const aligned=run.phase==='complete'&&a?.status==='ok'&&b?.status==='ok'&&a.id!==b.id
    ?pairedContrast(a.annual,b.annual):null;
  const unit=VARIABLES[variable].unit;
  const canInspect=run.phase==='complete'&&Boolean(a&&b&&a.id!==b.id&&a.status==='ok'&&b.status==='ok');
  const inv=investigationFor(variable);
  return <section className="discovery panel" id="contrast-finder" aria-labelledby="discovery-title">
    <div className="discovery-intro">
      <div><span className="section-kicker">From NASA data to useful questions</span>
        <h2 id="discovery-title">Trend Contrast Finder</h2>
        <p>Where should communities <em>investigate further</em>? Screen eight declared Indonesian NASA model points, then open a defensible paired comparison. No fabricated heatmaps, risk rankings or predictions.</p>
      </div>
      <span className="discovery-experiment">Exploratory research · branch prototype</span>
    </div>
    <div className="discovery-columns">
      <div className="discovery-controls">
        <h3>1. Ask an answerable question</h3>
        <p className="discovery-question">{inv.question}</p>
        <div className="discovery-form">
          <label htmlFor="finder-variable">NASA variable
            <select id="finder-variable" value={variable} onChange={e=>reset(()=>setVariable(e.target.value))}>
              {OPTIONS.map(code=><option key={code} value={code}>{VARIABLES[code].label} · {code}</option>)}
            </select>
          </label>
          <label htmlFor="finder-start">From year
            <input id="finder-start" type="number" min="1981" max="2025" value={start}
              onChange={e=>reset(()=>setStart(e.target.value))}/>
          </label>
          <label htmlFor="finder-end">Through year
            <input id="finder-end" type="number" min="1981" max="2025" value={end}
              onChange={e=>reset(()=>setEnd(e.target.value))}/>
          </label>
        </div>
        <div className="discovery-buttons">
          <button type="button" className="analyze" onClick={startScan} disabled={run.phase==='loading'} id="finder-run">
            {run.phase==='loading'?'Querying NASA…':'Run 8-point NASA screen'}
          </button>
          {run.phase==='loading'&&<button type="button" onClick={()=>{
            generation.current++;controller.current?.abort();
            setRun({phase:'cancelled',records:[],completed:0,error:'Investigation cancelled.'});
          }}>Cancel</button>}
        </div>
        <p className="discovery-status" role="status" id="finder-status">
          {run.phase==='loading'? `NASA requests complete: ${run.completed}/8 (at most 3 concurrent).`
            :run.phase==='complete'?`Finished: ${summary.ranked.length} trends · ${summary.failures.length} request errors · ${summary.insufficient.length} insufficient-year series.`
            :run.error||'No NASA data loaded. Run a screen to populate real observations.'}
        </p>
        <p className="discovery-small">Fixed sample: eight documented coordinates selected in advance, not a full grid or population-weighted study. NASA POWER reanalysis; no special hazard or policy threshold is used. Each run budgets eight point queries; repeat runs may reuse a 15-minute in-memory response cache.</p>
      </div>
      <div className="discovery-plot"><h3>2. Show every requested point</h3><CoordinatePlot records={run.records}/></div>
    </div>
    <div className="discovery-table-wrap" tabIndex="0" role="region" aria-label="NASA sample outcomes">
      <table className="discovery-table">
        <thead><tr><th scope="col">Sample</th><th scope="col">NASA status</th><th scope="col">Full years</th>
          <th scope="col">Fitted change ({unit}/decade)</th><th scope="col">Inspect pair</th></tr></thead>
        <tbody>{SENTINEL_POINTS.map((p,i)=>{
          const r=index.get(p.id),trend=r?.trend;
          return <tr key={p.id}>
            <th scope="row"><span className="discovery-num">{i+1}</span> {p.label}<small>{p.lat.toFixed(3)}°, {p.lon.toFixed(3)}°</small></th>
            <td>{r?.status==='ok'?(r.cacheHit?'NASA data · cached':'NASA data loaded'):
              r?.status==='error'?'Request failed: '+r.error:
              r?.status==='insufficient-years'?'Fewer than 10 complete years':
              'Not yet requested / pending'}</td>
            <td>{r?.annual?.length??'—'}</td>
            <td>{trend?signed(trend.slopePerDecade):'—'}</td>
            <td>{trend?<div className="discovery-select">
              <button type="button" aria-pressed={pointA===p.id} onClick={()=>setPointA(p.id)}>A</button>
              <button type="button" aria-pressed={pointB===p.id} onClick={()=>setPointB(p.id)}>B</button>
            </div>:'—'}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    {run.phase==='complete'&&<div className="discovery-output" aria-live="polite">
      <article className="discovery-findings">
        <h3>3. Inspect the evidence, not just a ranking</h3>
        <p>{brief.finding}</p>
        <p><strong>Screen scope:</strong> {brief.scope}. Possible distinct pair comparisons among valid points: {summary.candidatePairs}. Any pair chosen using these results is post-selected.</p>
        {canInspect&&<div className="discovery-paired">
          <p><strong>Selected test:</strong> B = {b.label} minus A = {a.label} on matched full years.</p>
          {aligned?<p>Fitted difference: <strong>{signed(aligned.classical.slopePerDecade)} {unit}/decade</strong> · approximate HAC 95% interval: {signed(aligned.hac.ciLowPerDecade)} to {signed(aligned.hac.ciHighPerDecade)}. Paired years: {aligned.n}. <strong>Exploratory only</strong>: selecting points after this screen invalidates a confirmatory interpretation of the unadjusted p-value.</p>
            :<p>Insufficient common full years to test a paired slope difference.</p>}
          <a className="discovery-inspect" href={investigateUrl(a,b,variable,Number(start),Number(end))}>Open full A/B monthly and annual evidence</a>
        </div>}
        {summary.failures.length>0&&<p className="discovery-warning">Incomplete NASA coverage: {summary.failures.map(r=>r.label).join(', ')} failed. Never infer a regional maximum from an incomplete sample.</p>}
        <button type="button" id="finder-download" onClick={()=>takeFile('terra-lens-sentinel-evidence.json',
          {...discoveryEvidence({records:run.records,variable,start:Number(start),end:Number(end),selected:{A:pointA,B:pointB}}),
            selectedPairedContrast:aligned})}>Export full evidence JSON</button>
      </article>
      <article className="discovery-impact">
        <h3>4. Turn evidence into a responsible next step</h3>
        <p><strong>Who could use this?</strong> {brief.audience}.</p>
        <p><strong>Action to investigate:</strong> {brief.responsibleAction}</p>
        <p><strong>What this cannot establish:</strong> {brief.doNotConclude}</p>
        <p><strong>How to verify:</strong> {brief.validation}</p>
        <p className="discovery-warning">{brief.uncertainty}</p>
      </article>
    </div>}
    <p className="discovery-citation">Source: <a href="https://power.larc.nasa.gov/docs/services/api/temporal/monthly/" target="_blank" rel="noreferrer">NASA POWER monthly API</a>. This branch prototype has not proven compliance with the 2026 challenge Resources-tab requirement; an actual listed NASA source and independent validation remain separately required.</p>
  </section>;
}

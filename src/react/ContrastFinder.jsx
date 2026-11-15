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
  const x=lon=>52+(lon-92)/32*696;
  const y=lat=>202-(lat+12)/19*156;
  return <figure className="discovery-figure">
    <svg viewBox="0 0 800 236" role="img" aria-label="Eight predeclared Indonesian coordinate sample points plotted by longitude and latitude. Colors show sampling status, not climate intensity.">
      <rect x="52" y="34" width="696" height="168" rx="4" fill="#ffffff" stroke="#dfdeda" />
      {[95,105,115,125].filter(v=>v<=124).map(v=><g key={v}><line x1={x(v)} x2={x(v)} y1="34" y2="202" stroke="#e5e4e0"/><text x={x(v)} y="220" fill="#4a4a48" textAnchor="middle" fontSize="13" fontFamily="DM Mono, ui-monospace, monospace">{v}°E</text></g>)}
      {[-10,-5,0,5].map(v=><g key={v}><line y1={y(v)} y2={y(v)} x1="52" x2="748" stroke="#e5e4e0"/><text x="44" y={y(v)+4} fill="#4a4a48" textAnchor="end" fontSize="12" fontFamily="DM Mono, ui-monospace, monospace">{v}°</text></g>)}
      {SENTINEL_POINTS.map((p,i)=>{
        const r=byId.get(p.id),status=r?.status||'waiting';
        const color=status==='error'?'#b91c1c':status==='insufficient-years'?'#b84314':status==='ok'?'#1a4be0':'#6e6e6a';
        return <g key={p.id}><circle cx={x(p.lon)} cy={y(p.lat)} r="12" fill={color} stroke="#ffffff" strokeWidth="2"/><text x={x(p.lon)} y={y(p.lat)+4} textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="DM Mono, ui-monospace, monospace" fill="#ffffff">{i+1}</text><title>{p.label}: {status}</title></g>;
      })}
      <text x="400" y="21" textAnchor="middle" fill="#4a4a48" fontWeight="600" fontSize="13" fontFamily="DM Mono, ui-monospace, monospace">Sampling coordinates · Not a climate raster</text>
    </svg>
    <figcaption>Fixed sampling coordinates (1–8). Colors show request status only—never temperature or risk.</figcaption>
  </figure>;
}
export default function ContrastFinder({onInspect}) {
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
  return <div className="discovery" id="contrast-finder" aria-labelledby="discovery-title">
    <div className="discovery-intro">
      <div className="pane-title-group">
        <span className="section-kicker">From NASA data to useful questions</span>
        <h2 id="discovery-title">Trend Contrast Finder</h2>
        <p>Screen eight declared Indonesian NASA model points, then open a defensible paired comparison.</p>
      </div>
      <span className="discovery-experiment">Exploratory · 8-point screen</span>
    </div>
    <div className="discovery-columns">
      <div className="discovery-controls">
        <div className="discovery-box">
          <h3>1. Ask an answerable question</h3>
          <p className="discovery-question">{inv.question}</p>
          <div className="discovery-form">
            <label htmlFor="finder-variable">NASA variable
              <select id="finder-variable" value={variable} onChange={e=>reset(()=>setVariable(e.target.value))}>
                {OPTIONS.map(code=><option key={code} value={code}>{VARIABLES[code].label} · {code}</option>)}
              </select>
            </label>
            <label htmlFor="finder-start">From
              <input id="finder-start" type="number" min="1981" max="2025" value={start}
                onChange={e=>reset(()=>setStart(e.target.value))}/>
            </label>
            <label htmlFor="finder-end">Through
              <input id="finder-end" type="number" min="1981" max="2025" value={end}
                onChange={e=>reset(()=>setEnd(e.target.value))}/>
            </label>
          </div>
          <div className="discovery-buttons">
            <button type="button" className="analyze" onClick={startScan} disabled={run.phase==='loading'} id="finder-run">
              <span>{run.phase==='loading'?'Querying NASA…':'Run 8-point NASA screen'}</span>
              <span className="analyze-kbd">SCAN ↵</span>
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
        </div>
        <div className="discovery-plot">
          <h3>2. Show every requested point</h3>
          <CoordinatePlot records={run.records}/>
        </div>
      </div>
      <div className="discovery-right-col">
        <div className="discovery-table-wrap" tabIndex="0" role="region" aria-label="NASA sample outcomes">
          <table className="discovery-table">
            <thead><tr><th scope="col">Sample</th><th scope="col">NASA status</th><th scope="col">Full years</th>
              <th scope="col">Slope ({unit}/dec)</th><th scope="col">Pair</th></tr></thead>
            <tbody>{SENTINEL_POINTS.map((p,i)=>{
              const r=index.get(p.id),trend=r?.trend;
              return <tr key={p.id}>
                <th scope="row"><span className="discovery-num">{i+1}</span> {p.label}<small>{p.lat.toFixed(2)}°, {p.lon.toFixed(2)}°</small></th>
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
        {run.phase==='complete'?<div className="discovery-output" aria-live="polite">
          <article className="discovery-findings">
            <h3>3. Inspect the evidence, not just a ranking</h3>
            <p>{brief.finding}</p>
            <p><strong>Scope:</strong> {brief.scope} ({summary.candidatePairs} candidate pairs; post-selected).</p>
            {canInspect&&<div className="discovery-paired">
              <p><strong>Selected test:</strong> B = {b.label} minus A = {a.label} on matched full years.</p>
              {aligned?<p>Fitted difference: <strong>{signed(aligned.classical.slopePerDecade)} {unit}/dec</strong> · {aligned.hac?`HAC 95% CI: ${signed(aligned.hac.ciLowPerDecade)} to ${signed(aligned.hac.ciHighPerDecade)}`:'HAC unavailable: gaps in shared years'} ({aligned.n}y). <strong>Exploratory only</strong>: post-selection invalidates confirmatory p-values.</p>
                :<p>Insufficient common full years to test a paired slope difference.</p>}
              <a className="discovery-inspect" href={investigateUrl(a,b,variable,Number(start),Number(end))} onClick={e=>{
                if(onInspect&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){
                  e.preventDefault();
                  onInspect({variable,start:String(start),end:String(end),compare:true,cityA:'custom',latA:String(a.lat),lonA:String(a.lon),cityB:'custom',latB:String(b.lat),lonB:String(b.lon)});
                }
              }}>Open full A/B monthly and annual evidence</a>
            </div>}
            {summary.failures.length>0&&<p className="discovery-warning">Incomplete NASA coverage: {summary.failures.map(r=>r.label).join(', ')} failed.</p>}
            <button type="button" id="finder-download" onClick={()=>takeFile('terra-lens-sentinel-evidence.json',
              {...discoveryEvidence({records:run.records,variable,start:Number(start),end:Number(end),selected:{A:pointA,B:pointB}}),
                selectedPairedContrast:aligned})}>Export full evidence JSON</button>
          </article>
          <article className="discovery-impact">
            <h3>4. Turn evidence into a responsible next step</h3>
            <p><strong>Audience:</strong> {brief.audience}.</p>
            <p><strong>Action:</strong> {brief.responsibleAction}</p>
            <p><strong>Limit:</strong> {brief.doNotConclude}</p>
            <p><strong>Verify:</strong> {brief.validation}</p>
            <p className="discovery-warning">{brief.uncertainty}</p>
          </article>
        </div>:<p className="discovery-small">Fixed sample: eight documented coordinates selected in advance, not a full grid or population-weighted study. Source: <a href="https://power.larc.nasa.gov/docs/services/api/temporal/monthly/" target="_blank" rel="noreferrer">NASA POWER monthly API</a>.</p>}
      </div>
    </div>
  </div>;
}

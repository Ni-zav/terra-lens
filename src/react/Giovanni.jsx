import React, {useState} from 'react';
import {parseGiovanniMonthlyCSV} from '../giovanni.js';
import {annualMeans, linearTrend} from '../stats.js';

const fmt = value => Number.isFinite(value) ? Number(value).toFixed(3) : '—';
export default function GiovanniEvidence() {
  const [evidence,setEvidence]=useState(null), [error,setError]=useState('');
  const [product,setProduct]=useState(''), [sourceURL,setSourceURL]=useState(''), [doi,setDoi]=useState('');
  async function importCSV(event) {
    const file=event.target.files?.[0]; if(!file)return;
    setEvidence(null);setError('');
    try {
      if (file.size > 12_000_000) throw new Error('File is too large (12 MB maximum).');
      const data=await file.text();
      const parsed=parseGiovanniMonthlyCSV(data);
      const annual=annualMeans(parsed.monthly);
      const trend=linearTrend(annual);
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data));
      const sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
      setEvidence({...parsed,annual,trend,sha256,fileName:file.name});
    } catch (cause) {setError(cause.message);}
  }
  function exportJSON() {
    if (!evidence) return;
    const output={
      schema:'terra-lens-giovanni-import-v1',
      warning:'Imported local file. Provenance fields are entered by the user and have not been independently authenticated. This output alone is not proof of NASA source eligibility.',
      importedAt:new Date().toISOString(),
      productIdentifier:product.trim()||null,originalNASAURL:sourceURL.trim()||null,doi:doi.trim()||null,
      fileName:evidence.fileName,sha256:evidence.sha256,metadata:evidence.metadata,
      monthly:evidence.monthly,annual:evidence.annual,trend:evidence.trend
    };
    const blob=new Blob([JSON.stringify(output,null,2)+'\n'],{type:'application/json'});
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');
    anchor.href=url;anchor.download='terra-lens-giovanni-import-evidence.json';document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  return <section className="panel" style={{padding:'1.5rem',margin:'1.5rem 0'}} aria-labelledby="giovanni-heading">
    <span className="section-kicker">Independent NASA dataset pathway</span>
    <h2 id="giovanni-heading">Analyze a NASA Giovanni monthly export</h2>
    <p className="aside-note">This is an additional local-file workflow, not a replacement for live NASA POWER. Export a <strong>monthly</strong> NASA Giovanni time series and keep the original NASA product ID, DOI, download link and file. The import runs locally; no Earthdata password or file is uploaded to Terra-Lens. We do not assert the file is genuine merely because the parser accepted it.</p>
    <p><a href="https://giovanni.gsfc.nasa.gov/giovanni/" target="_blank" rel="noreferrer">Open NASA Giovanni</a> · <a href="https://github.com/nasa/gesdisc-tutorials/blob/main/notebooks/How_to_Access_GiC_Time_Series_Service.ipynb" target="_blank" rel="noreferrer">NASA CSV workflow example</a></p>
    <div className="coord-row" style={{maxWidth:'720px'}}>
      <div><label htmlFor="giovanni-product">NASA dataset/product identifier</label><input id="giovanni-product" value={product} onChange={e=>setProduct(e.target.value)} placeholder="e.g. M2TMNXSLV, version" /></div>
      <div><label htmlFor="giovanni-doi">Dataset DOI (if known)</label><input id="giovanni-doi" value={doi} onChange={e=>setDoi(e.target.value)} placeholder="doi:10.5067/..." /></div>
    </div>
    <label htmlFor="giovanni-source">Original NASA result/download URL</label>
    <input id="giovanni-source" type="url" value={sourceURL} onChange={e=>setSourceURL(e.target.value)} placeholder="https://...nasa.gov/..." style={{maxWidth:'720px'}}/>
    <label htmlFor="giovanni-file">Giovanni monthly time-series CSV (max 12 MB)</label>
    <input id="giovanni-file" type="file" accept=".csv,text/csv" onChange={importCSV} />
    {error&&<p role="alert" className="status error">{error}</p>}
    {evidence && <div aria-live="polite">
      <p><strong>Loaded {evidence.monthly.length} monthly records, {evidence.annual.length} complete years.</strong> NASA CSV metadata: {evidence.metadata.param_name} ({evidence.metadata.unit}).</p>
      {evidence.trend?<div className="comparison-numbers">
        <div className="comparison-stat"><span>Classical OLS trend</span><strong>{fmt(evidence.trend.slopePerDecade)} {evidence.metadata.unit}/decade</strong></div>
        <div className="comparison-stat"><span>Classical 95% interval</span><strong>{fmt(evidence.trend.ciLowPerDecade)} to {fmt(evidence.trend.ciHighPerDecade)}</strong></div>
        <div className="comparison-stat"><span>Classical two-sided p</span><strong>{fmt(evidence.trend.pValue)}</strong></div>
        <div className="comparison-stat"><span>Complete years</span><strong>{evidence.annual.length}</strong></div>
      </div>:<p>Fewer than ten full years; no trend claim is made.</p>}
      <p className="aside-note">SHA-256 of original file: <code style={{overflowWrap:'anywhere'}}>{evidence.sha256}</code>. Estimates are exploratory, with independent-residual assumptions. A Giovanni area average cannot be compared as a direct equivalent of a POWER point estimate.</p>
      <button type="button" id="giovanni-export" onClick={exportJSON}>Export imported evidence JSON</button>
    </div>}
  </section>;
}

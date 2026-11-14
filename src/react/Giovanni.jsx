import React, {useState} from 'react';
import {parseGiovanniMonthlyCSV, giovanniSeries} from '../giovanni.js';
import {analyzeSeries} from '../series.js';

const fmt = value => Number.isFinite(value) ? (value > 0 ? '+' : '') + Number(value).toFixed(3) : '—';

/**
 * Importer only: turns a Giovanni CSV into the same canonical Series as live
 * NASA POWER, then hands it to the workspace, where it appears in every chart,
 * the verdicts and the evidence export through the shared derivations.
 */
export default function GiovanniEvidence({imported, onImport, onRemove}) {
  const [error,setError]=useState('');
  const [product,setProduct]=useState(''), [sourceURL,setSourceURL]=useState(''), [doi,setDoi]=useState('');
  async function importCSV(event) {
    const file=event.target.files?.[0]; if(!file)return;
    setError('');
    try {
      if (file.size > 12_000_000) throw new Error('File is too large (12 MB maximum).');
      const data=await file.text();
      const parsed=parseGiovanniMonthlyCSV(data);
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data));
      const sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
      onImport(giovanniSeries(parsed,{fileName:file.name,sha256,product:product.trim(),doi:doi.trim(),sourceURL:sourceURL.trim()}));
    } catch (cause) {setError(cause.message);}
    finally {event.target.value='';}
  }
  const analysis=imported?analyzeSeries(imported):null;
  return <div className="giovanni-workspace" aria-labelledby="giovanni-heading">
    <div className="giovanni-head">
      <div className="pane-title-group">
        <span className="section-kicker">06 // SOURCE</span>
        <h2 id="giovanni-heading">Add a NASA Giovanni monthly series</h2>
      </div>
      <p className="giovanni-links"><a href="https://giovanni.gsfc.nasa.gov/giovanni/" target="_blank" rel="noreferrer">Open NASA Giovanni</a> · <a href="https://github.com/nasa/gesdisc-tutorials/blob/main/notebooks/How_to_Access_GiC_Time_Series_Service.ipynb" target="_blank" rel="noreferrer">NASA CSV workflow example</a></p>
    </div>
    <div className="giovanni-grid">
      <div className="giovanni-copy">
        <div className="giovanni-card">
          <h3>Independent NASA Series Integration (Series G)</h3>
          <p className="giovanni-note">Export a <strong>monthly</strong> time series from NASA Giovanni and import it here. It joins the workspace as series <strong>G</strong> and runs through the same annual-mean, OLS, Mann–Kendall, and anomaly calculations as NASA POWER.</p>
          <p className="giovanni-note">Because Giovanni series are area averages, Terra-Lens never runs a paired difference test against a POWER grid point; compare shapes in <em>Monthly → Anomaly</em>. The file is processed locally and is not authenticated by this app.</p>
        </div>
        {analysis ? <div aria-live="polite" className="giovanni-summary">
          <h3>Active Imported Series (G)</h3>
          <p><strong>{imported.label}</strong> · {imported.monthly.length} monthly records, {analysis.coverage.completeYears} complete years · unit {imported.variable.unit}. <em>{analysis.verdict.headline}.</em></p>
          {analysis.trend && <p className="giovanni-note">OLS {fmt(analysis.trend.slopePerDecade)} {imported.variable.unit}/decade (p {analysis.trend.pValue.toFixed(4)}) · Sen {fmt(analysis.robust.senSlopePerDecade)} (Mann–Kendall p {analysis.robust.pValue.toFixed(4)})</p>}
          <p className="giovanni-note">SHA-256: <code>{imported.provenance.sha256}</code></p>
          <button type="button" id="giovanni-remove" onClick={onRemove}>Remove series G</button>
        </div> : <div className="giovanni-summary is-empty">
          <h3>Series G Status</h3>
          <p className="giovanni-note">No Giovanni CSV currently imported. Upload a NASA Giovanni monthly time-series CSV on the right to overlay Series G across Annual, Monthly, Seasonal, and Compare views.</p>
        </div>}
      </div>
      <div className="giovanni-form">
        <h3>Import Parameters & CSV File</h3>
        <div className="coord-row">
          <div><label htmlFor="giovanni-product">NASA dataset/product identifier</label><input id="giovanni-product" value={product} onChange={e=>setProduct(e.target.value)} placeholder="e.g. M2TMNXSLV, version" /></div>
          <div><label htmlFor="giovanni-doi">Dataset DOI (if known)</label><input id="giovanni-doi" value={doi} onChange={e=>setDoi(e.target.value)} placeholder="doi:10.5067/..." /></div>
        </div>
        <label htmlFor="giovanni-source">Original NASA result/download URL</label>
        <input id="giovanni-source" type="url" value={sourceURL} onChange={e=>setSourceURL(e.target.value)} placeholder="https://...nasa.gov/..."/>
        <label htmlFor="giovanni-file">Giovanni monthly time-series CSV (max 12 MB)</label>
        <input id="giovanni-file" type="file" accept=".csv,text/csv" onChange={importCSV} />
        {error&&<p role="alert" className="status error">{error}</p>}
      </div>
    </div>
  </div>;
}

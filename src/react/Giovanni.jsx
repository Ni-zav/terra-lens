import React, {useState} from 'react';
import {parseGiovanniMonthlyCSV, giovanniSeries} from '../giovanni.js';
import GiovanniCase from './GiovanniCase.jsx';
import {analyzeSeries} from '../series.js';
import GiovanniTutorial from './GiovanniTutorial.jsx';
import {giovanniAreaSeries} from '../science/giovanni-case.js';
import {giovanniTemperatureQuery} from '../science/giovanni-query.js';
import Catalog from './Catalog.jsx';
import {messages} from '../presentation/locale.js';

const fmt = value => Number.isFinite(value) ? (value > 0 ? '+' : '') + Number(value).toFixed(3) : '—';

/**
 * Importer only: turns a Giovanni CSV into the same canonical Series as live
 * NASA POWER, then hands it to the workspace for separate charts and the shared evidence export.
 */
export default function GiovanniEvidence({imported, onImport, onRemove, locale='en'}) {
  const [error,setError]=useState('');
  const [product,setProduct]=useState(''), [sourceURL,setSourceURL]=useState(''), [doi,setDoi]=useState('');
  const [region,setRegion]=useState({west:'110',south:'-8',east:'111',north:'-7',start:'2001',end:'2024'});
  let queryURL='',queryError='';
  try {queryURL=giovanniTemperatureQuery(region);} catch(cause) {queryError=cause.message;}
  async function importCSV(event) {
    const file=event.target.files?.[0]; if(!file)return;
    setError('');
    try {
      if (file.size > 12_000_000) throw new Error('File is too large (12 MB maximum).');
      // Hash the ORIGINAL file bytes. Re-encoding a decoded string can change
      // the checksum (for example a UTF-8 BOM or malformed bytes).
      const originalBytes=await file.arrayBuffer();
      const data=new TextDecoder('utf-8',{fatal:true}).decode(originalBytes);
      const digest=await crypto.subtle.digest('SHA-256',originalBytes);
      const sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
      const metadata={fileName:file.name,sha256,product:product.trim(),doi:doi.trim(),sourceURL:sourceURL.trim()};
      onImport(data.replace(/^\uFEFF/,'').startsWith('Title:,')
        ? giovanniAreaSeries(data,metadata)
        : giovanniSeries(parseGiovanniMonthlyCSV(data),metadata));
    } catch (cause) {setError(cause.message);}
    finally {event.target.value='';}
  }
  const analysis=imported?analyzeSeries(imported):null;
  return <div className="giovanni-workspace" aria-labelledby="giovanni-heading">
    <div className="giovanni-head">
      <div className="pane-title-group">
        <span className="section-kicker">NASA Source Import · Local File</span>
        <h2 id="giovanni-heading">Explore NASA Giovanni cases</h2>
      </div>
      <p className="giovanni-links"><a href="https://giovanni.gsfc.nasa.gov/giovanni/" target="_blank" rel="noreferrer">Open NASA Giovanni</a> · <a href="https://github.com/nasa/gesdisc-tutorials/blob/main/notebooks/How_to_Access_GiC_Time_Series_Service.ipynb" target="_blank" rel="noreferrer">NASA CSV workflow example</a></p>
    </div>
    <p className="giovanni-note">The regional case below is ready to explore—no upload needed. The cards and sidebar outside this panel describe the separate NASA POWER point investigation; they are not the Giovanni area average.</p>
    <GiovanniCase />
    <GiovanniTutorial/>
    <section className="giovanni-card giovanni-tutorial" aria-labelledby="giovanni-query-title">
      <h3 id="giovanni-query-title">Explore another region with Giovanni</h3>
      <p>Choose a bounding box and years for NASA MERRA-2 monthly 2 m temperature. Giovanni runs the area-average request on NASA’s site and may require Earthdata sign-in. Download its CSV and import it below; this app never receives your credentials.</p>
      <div className="giovanni-region-fields">{[['west','West longitude'],['south','South latitude'],['east','East longitude'],['north','North latitude'],['start','First year'],['end','Last year']].map(([key,label])=><div key={key}><label htmlFor={'region-'+key}>{label}</label><input id={'region-'+key} type="number" step={key==='start'||key==='end'?'1':'any'} value={region[key]} onChange={e=>setRegion({...region,[key]:e.target.value})}/></div>)}</div>
      {queryError?<p role="status">{queryError}</p>:<p><a id="giovanni-region-query" href={queryURL} target="_blank" rel="noreferrer">Open this region in NASA Giovanni</a></p>}
      <p className="giovanni-note">Supported here: M2TMNXSLV v5.12.4 monthly mean T2M, non-antimeridian boxes and years 1980–2025. Other products and automated Giovanni acquisition are not implemented. Keep source metadata and check quality before drawing conclusions.</p>
    </section>
    <Catalog region={region}/>
    <div className="giovanni-grid">
      <div className="giovanni-copy">
        <div className="giovanni-card">
          <h3>Independent NASA Series Integration (Series G)</h3>
          <p className="giovanni-note">Import a <strong>monthly</strong> Giovanni Cloud point CSV or classic area-average M2TMNXSLV v5.12.4 T2M CSV. It joins the workspace as series <strong>G</strong> and runs through the same annual-mean, OLS, Mann–Kendall, and anomaly calculations as NASA POWER.</p>
          <p className="giovanni-note">Giovanni point-service CSVs contain a <strong>single grid-point series</strong> when valid latitude and longitude metadata are present; area-averaged exports are different products. Do not infer a direct physical difference between unlike sources. Files are processed locally, and source authenticity is not certified by this browser.</p>
        </div>
        {analysis ? <div aria-live="polite" className="giovanni-summary">
          <h3>Active Imported Series (G)</h3><p lang={locale}>{messages[locale].imported}. {locale==='id'?'SHA-256 hanya mengidentifikasi isi berkas.':'The SHA-256 identifies the file bytes.'}</p>
          <p><strong>{imported.label}</strong> · {imported.monthly.length} monthly records, {analysis.coverage.completeYears} complete years · unit {imported.variable.unit}. <em>{analysis.verdict.headline}.</em></p>
          {analysis.trend && <p className="giovanni-note">OLS {fmt(analysis.trend.slopePerDecade)} {imported.variable.unit}/decade (p {analysis.trend.pValue.toFixed(4)}) · Sen {fmt(analysis.robust.senSlopePerDecade)} (Mann–Kendall p {analysis.robust.pValue.toFixed(4)})</p>}
          {imported.provenance.warning?.includes('temporal aggregation')&&<p className="giovanni-note">Annual values are day-weighted averages of monthly values, not annual totals or annual extremes. Verify that averaging is meaningful for this product.</p>}
          <p className="giovanni-note">SHA-256: <code>{imported.provenance.sha256}</code></p>
          <button type="button" id="giovanni-remove" onClick={onRemove}>Remove series G</button>
        </div> : <div className="giovanni-summary is-empty">
          <h3>Series G Status</h3>
          <p className="giovanni-note">No Giovanni CSV currently imported. Upload a Giovanni monthly CSV to inspect series G in its own Annual, Monthly and Seasonal charts. Compare shows separate fits and why a paired test is unavailable.</p>
        </div>}
      </div>
      <div className="giovanni-form">
        <h3>NASA provenance &amp; original monthly CSV</h3>
        <p className="giovanni-note">For cloud CSVs, verify the product’s missing-value codes: declared numeric fill values are excluded, or −999 if none is declared. Other undocumented codes may remain. The annual calculation is a day-weighted average of monthly values, not an annual total or annual extreme. Check that this calculation is meaningful for your product before interpreting a trend; the app cannot verify its temporal aggregation.</p>
        <div className="coord-row">
          <div><label htmlFor="giovanni-product">NASA dataset/product identifier</label><input id="giovanni-product" value={product} onChange={e=>setProduct(e.target.value)} placeholder="e.g. M2TMNXSLV, version" /></div>
          <div><label htmlFor="giovanni-doi">Dataset DOI (if known)</label><input id="giovanni-doi" value={doi} onChange={e=>setDoi(e.target.value)} placeholder="doi:10.5067/..." /></div>
        </div>
        <label htmlFor="giovanni-source">Original NASA result/download URL</label>
        <input id="giovanni-source" type="url" value={sourceURL} onChange={e=>setSourceURL(e.target.value)} placeholder="https://...nasa.gov/..."/>
        <label htmlFor="giovanni-file">Giovanni monthly time-series CSV (max 12 MB)</label>
        <input id="giovanni-file" type="file" accept=".csv,text/csv" onChange={importCSV} />
        {error&&<div role="alert" className="status error">
          {locale==='id'&&<p lang="id">CSV gagal dimuat. Periksa format bulanan, metadata, ukuran (maksimal 12 MB), tanggal dan bulan ganda.</p>}
          <p>{error}</p>
        </div>}
      </div>
    </div>
  </div>;
}

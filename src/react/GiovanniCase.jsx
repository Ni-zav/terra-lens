import React from 'react';
import raw from '../../data/source-snapshots/g4.areaAvgTimeSeries.M2TMNXSLV_5_12_4_T2M.20010101-20241231.110E_8S_111E_7S.csv?raw';
import {analyzeGiovanniArea} from '../science/index.js';
const data=analyzeGiovanniArea(raw);
function exportCase() {
 const evidence={schema:'terra-lens-giovanni-area-v1',dataset:'M2TMNXSLV 5.12.4',variable:'T2M',unit:'K',
  doi:'10.5067/AP1B0BA5PD2K',requestedBounds:[110,-8,111,-7],dataBounds:[110,-8,110.625,-7],
  temporalSupport:'Monthly means, 2001–2024; annual means weighted by calendar days',
  sourceCSV_SHA256:'ff7cd37fd010ae16015ce22400c2cb583c975c6d9277e0235cbd674d774e54dc',
  sourceNetCDF_SHA256:'d9a320f77ef79b65ec6dba4454e247c700b420cb4966270cf677f88f75f74668',
  preservedCSV:'./data/source-snapshots/g4.areaAvgTimeSeries.M2TMNXSLV_5_12_4_T2M.20010101-20241231.110E_8S_111E_7S.csv',
  preservedNetCDF:'./data/source-snapshots/g4.areaAvgTimeSeries.M2TMNXSLV_5_12_4_T2M.20010101-20241231.110E_8S_111E_7S.nc',
  originalCSV:'https://giovanni.gsfc.nasa.gov/giovanni/daac-bin/serializer.pl?SESSION=343566EA-E094-11F1-A1CF-4CF1FED1C619&RESULTSET=6BED9890-E095-11F1-9112-2588FFD1C619&RESULT=6BEDAC4A-E095-11F1-9112-2588FFD1C619&FILE=g4.areaAvgTimeSeries.M2TMNXSLV_5_12_4_T2M.20010101-20241231.110E_8S_111E_7S.nc',
  originalCSV_serializerNote:'NASA Giovanni serializer.pl takes the internal session .nc filename in FILE= and serves Content-Type: text/csv; charset=ISO-8859-1 with Content-Disposition filename="g4.areaAvgTimeSeries.M2TMNXSLV_5_12_4_T2M.20010101-20241231.110E_8S_111E_7S.csv" (9,434 bytes, SHA-256 ff7cd37fd010ae16015ce22400c2cb583c975c6d9277e0235cbd674d774e54dc). Use preservedCSV for direct unauthenticated access.',
  originalNetCDF:'https://giovanni.gsfc.nasa.gov/session/343566EA-E094-11F1-A1CF-4CF1FED1C619/6BED9890-E095-11F1-9112-2588FFD1C619/6BEDAC4A-E095-11F1-9112-2588FFD1C619/g4.areaAvgTimeSeries.M2TMNXSLV_5_12_4_T2M.20010101-20241231.110E_8S_111E_7S.nc',
  source:'https://giovanni.gsfc.nasa.gov/giovanni/#service=ArAvTs&starttime=2001-01-01T00:00:00Z&endtime=2024-12-31T23:59:59Z&bbox=110,-8,111,-7&data=M2TMNXSLV_5_12_4_T2M',
  limitations:'Model reanalysis; exploratory classical OLS; serial correlation, selection, model and processing uncertainty are not quantified. No quality-flag variable is present in the Giovanni output or native M2TMNXSLV 5.12.4 monthly granules. NASA reprocessed September 2020 and June–September 2021 (MERRA2_401); byte-preserved NASA OPeNDAP .dap.nc4 subsets for all five reprocessed months match the Giovanni 6-cell intermediate bit-for-bit in IEEE 754 float32 (0.0 K difference), though the Giovanni aggregate file itself does not embed native GranuleID strings.',...data};
 const url=URL.createObjectURL(new Blob([JSON.stringify(evidence,null,2)+'\n'],{type:'application/json'}));
 const a=document.createElement('a'); a.href=url; a.download='giovanni-regional-evidence.json'; a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function GiovanniCase() {
 const {annual,trend}=data;
 const x=y=>50+(y-2001)*680/23, y=v=>185-(v-297.8)*120/1.8;
 return <section className="giovanni-card giovanni-tutorial" aria-labelledby="nasa-source-case">
  <h3 id="nasa-source-case">NASA Giovanni · Regional temperature, 2001–2024</h3>
  <p>MERRA-2 monthly 2 m air temperature, averaged over grid cells near Yogyakarta. The fitted annual trend is <strong>+{trend.slopePerDecade.toFixed(3)} K per decade</strong> (classical 95% interval {trend.ciLowPerDecade.toFixed(3)} to {trend.ciHighPerDecade.toFixed(3)}; p = {trend.pValue.toFixed(3)}).</p>
  <figure><svg style={{width:"100%",height:"auto"}} viewBox="0 0 760 220" role="img" aria-label="Annual area-averaged MERRA-2 temperature in kelvin, 2001 to 2024, with linear fit">
   {[298,298.5,299,299.5].map(v=><g key={v}><line x1="50" x2="730" y1={y(v)} y2={y(v)} stroke="#dfdeda"/><text x="44" y={y(v)+4} textAnchor="end" fill="#4a4a48" fontSize="12" fontFamily="DM Mono, ui-monospace, monospace">{v}</text></g>)}
   <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={annual.map(r=>`${x(r.year)},${y(r.value)}`).join(' ')}/>
   <line x1={x(2001)} y1={y(trend.fitted[0].value)} x2={x(2024)} y2={y(trend.fitted.at(-1).value)} stroke="#ea580c" strokeWidth="1.6" strokeDasharray="5 4"/>
   {annual.map(r=><circle key={r.year} cx={x(r.year)} cy={y(r.value)} r="3.2" fill="#2563eb" stroke="#ffffff" strokeWidth="1"><title>{r.year}: {r.value.toFixed(3)} K</title></circle>)}
   <text x="50" y="210" fill="#4a4a48" fontSize="12" fontFamily="DM Mono, ui-monospace, monospace">2001</text><text x="700" y="210" fill="#4a4a48" fontSize="12" fontFamily="DM Mono, ui-monospace, monospace">2024</text><text x="50" y="17" fill="#4a4a48" fontSize="12" fontFamily="DM Mono, ui-monospace, monospace">Annual mean (K) · cobalt: data · dashed terracotta: fit</text>
  </svg><figcaption>Complete years only; monthly means weighted by days. Hover a point for its value.</figcaption></figure>
  <p>Model reanalysis, not a thermometer or city-wide observation. The inference assumes independent, homoscedastic residuals; serial correlation, selection, multiple testing and model uncertainty can make it optimistic. It does not establish cause. The output contains no quality-flag variable; input-granule quality was not independently audited.</p>
  <p className="giovanni-note">NASA reprocessed September 2020 and June–September 2021 (`MERRA2_401`), including a correction for a near-surface warm bias. Byte-preserved NASA OPeNDAP `.dap.nc4` subsets for all five reprocessed months match the Giovanni 6-cell intermediate bit-for-bit in `float32` (`0.0 K` max difference), though the Giovanni aggregate file itself does not embed native `GranuleID` strings. <a href="https://docserver.gesdisc.eosdis.nasa.gov/public/project/MERRA/Records_MERRA-2_Data_Reprocessing_and_Service_Changes.pdf" target="_blank" rel="noreferrer">NASA reprocessing record</a></p>
  <p><a href="https://doi.org/10.5067/AP1B0BA5PD2K">NASA M2TMNXSLV v5.12.4</a> · <a href="https://giovanni.gsfc.nasa.gov/giovanni/#service=ArAvTs&amp;starttime=2001-01-01T00:00:00Z&amp;endtime=2024-12-31T23:59:59Z&amp;bbox=110,-8,111,-7&amp;data=M2TMNXSLV_5_12_4_T2M">Reproduce in Giovanni</a> · <a href="./data/source-snapshots/g4.areaAvgTimeSeries.M2TMNXSLV_5_12_4_T2M.20010101-20241231.110E_8S_111E_7S.csv" download>Preserved original CSV</a> · <a href="./data/source-snapshots/g4.areaAvgTimeSeries.M2TMNXSLV_5_12_4_T2M.20010101-20241231.110E_8S_111E_7S.nc" download>Preserved original NetCDF</a> · <a href="./docs/NASA_QUALIFYING_SOURCE_HANDOFF.md">Original files, methods and limitations</a></p>
  <button type="button" onClick={exportCase}>Download regional evidence JSON</button>
  <details><summary>Inspect all 24 annual values</summary><div className="sc-table-wrap" tabIndex="0"><table className="discovery-table"><thead><tr><th scope="col">Year</th><th scope="col">Annual mean (K)</th></tr></thead><tbody>{annual.map(row=><tr key={row.year}><th scope="row">{row.year}</th><td>{row.value.toFixed(3)}</td></tr>)}</tbody></table></div></details>
 </section>;
}

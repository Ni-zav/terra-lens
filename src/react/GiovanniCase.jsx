import React from 'react';
import raw from '../../data/source-snapshots/g4.areaAvgTimeSeries.M2TMNXSLV_5_12_4_T2M.20010101-20241231.110E_8S_111E_7S.csv?raw';
import {analyzeGiovanniArea} from '../science/index.js';
const data=analyzeGiovanniArea(raw);
export default function GiovanniCase() {
 const {annual,trend}=data;
 const x=y=>50+(y-2001)*680/23, y=v=>185-(v-297.8)*120/1.8;
 return <section className="giovanni-card" aria-labelledby="nasa-source-case">
  <h3 id="nasa-source-case">NASA Giovanni · Regional temperature, 2001–2024</h3>
  <p>MERRA-2 monthly 2 m air temperature, averaged over grid cells near Yogyakarta. The fitted annual trend is <strong>+{trend.slopePerDecade.toFixed(3)} K per decade</strong> (classical 95% interval {trend.ciLowPerDecade.toFixed(3)} to {trend.ciHighPerDecade.toFixed(3)}; p = {trend.pValue.toFixed(3)}).</p>
  <figure><svg style={{width:"100%",height:"auto"}} viewBox="0 0 760 220" role="img" aria-label="Annual area-averaged MERRA-2 temperature in kelvin, 2001 to 2024, with linear fit">
   {[298,298.5,299,299.5].map(v=><g key={v}><line x1="50" x2="730" y1={y(v)} y2={y(v)} stroke="#395064"/><text x="44" y={y(v)+4} textAnchor="end" fill="#b2c8d6" fontSize="12">{v}</text></g>)}
   <polyline fill="none" stroke="#62d6e4" strokeWidth="2" points={annual.map(r=>`${x(r.year)},${y(r.value)}`).join(' ')}/>
   <line x1={x(2001)} y1={y(trend.fitted[0].value)} x2={x(2024)} y2={y(trend.fitted.at(-1).value)} stroke="#f6b975" strokeDasharray="5 4"/>
   {annual.map(r=><circle key={r.year} cx={x(r.year)} cy={y(r.value)} r="3" fill="#62d6e4"><title>{r.year}: {r.value.toFixed(3)} K</title></circle>)}
   <text x="50" y="210" fill="#b2c8d6" fontSize="12">2001</text><text x="700" y="210" fill="#b2c8d6" fontSize="12">2024</text><text x="50" y="17" fill="#b2c8d6" fontSize="12">Annual mean (K) · blue: data · dashed: fit</text>
  </svg><figcaption>Complete years only; monthly means weighted by days. Hover a point for its value.</figcaption></figure>
  <p>Model reanalysis, not a thermometer or city-wide observation. The inference assumes independent residuals; serial correlation and selection may make it optimistic. It does not establish cause.</p>
  <p><a href="https://doi.org/10.5067/AP1B0BA5PD2K">NASA M2TMNXSLV v5.12.4</a> · <a href="https://giovanni.gsfc.nasa.gov/giovanni/#service=ArAvTs&amp;starttime=2001-01-01T00:00:00Z&amp;endtime=2024-12-31T23:59:59Z&amp;bbox=110,-8,111,-7&amp;data=M2TMNXSLV_5_12_4_T2M">Reproduce in Giovanni</a></p>
 </section>;
}

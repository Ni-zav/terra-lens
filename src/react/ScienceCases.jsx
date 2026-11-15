import React, {useState} from 'react';
import {scienceForAudience, analyzeLocalGlobal} from '../science/index.js';
import manifest from '../../data/cases/manifest.json';
import swotSnapshot from '../../data/cases/ohio-river-swot-power.json';
import gistempSnapshot from '../../data/cases/yogyakarta-global-gistemp-power.json';
import gistempRawTxt from '../../data/source-snapshots/nasa-giss-gistemp-global-2001-2024.txt?raw';

const fmt = (n, d = 3) => Number.isFinite(n) ? new Intl.NumberFormat('en-US', {maximumFractionDigits: d, minimumFractionDigits: d}).format(n) : '—';
const signed = (n, d = 3) => Number.isFinite(n) ? (n > 0 ? '+' : '') + fmt(n, d) : '—';

function downloadJSON(name, payload) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2) + '\n'], {type: 'application/json;charset=utf-8'}));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * SVG plot for Case 1: SWOT irregular satellite overpasses (water surface elevation in m, with quality flags)
 * juxtaposed against monthly NASA POWER precipitation rate (mm/day).
 * Intentionally plotted on two vertically separated panels so irregular pass heights (m) are never
 * visually conflated with monthly mean precipitation rates (mm/day).
 */
function SwotWaterFigure({data}) {
  const passes = data.swot.observations;
  const pairs = data.caseStudy.advanced.harmonization.pairs;
  const minWse = 119.5, maxWse = 132.5;
  const firstMs = Date.parse('2025-03-15T00:00:00Z');
  const lastMs = Date.parse('2025-05-20T00:00:00Z');
  const xTime = iso => 68 + ((Date.parse(iso) - firstMs) / (lastMs - firstMs)) * 692;
  const yWse = v => 126 - ((v - minWse) / (maxWse - minWse)) * 96;

  const monthCenters = {
    '2025-03': xTime('2025-03-24T00:00:00Z'),
    '2025-04': xTime('2025-04-15T00:00:00Z'),
    '2025-05': xTime('2025-05-09T00:00:00Z')
  };
  const yRain = v => 214 - (v / 11) * 44;

  return (
    <figure className="sc-figure">
      <svg viewBox="0 0 784 240" role="img" aria-label="Top panel: 12 irregular SWOT satellite pass water surface elevations in meters on Ohio River reach 74267300251, colored by quality flag. Bottom panel: 3 overlapping monthly NASA POWER precipitation rates in millimeters per day.">
        <rect x="68" y="22" width="692" height="110" fill="#ffffff" stroke="#dfdeda" rx="4"/>
        <text x="76" y="36" fill="#2563eb" fontSize="10.5" fontWeight="600" fontFamily="DM Mono, ui-monospace, monospace">
          A · NASA SWOT RiverSP WSE (m above geoid) · Irregular satellite overpasses (NOT a continuous gauge)
        </text>
        {[120, 125, 130].map(v => (
          <g key={v}>
            <line x1="68" x2="760" y1={yWse(v)} y2={yWse(v)} stroke="#e5e4e0" strokeDasharray="3 3"/>
            <text x="62" y={yWse(v) + 4} fill="#4a4a48" fontSize="10.5" textAnchor="end" fontFamily="DM Mono, ui-monospace, monospace">{v}m</text>
          </g>
        ))}
        {passes.map((p, idx) => {
          const cx = xTime(p.time), cy = yWse(p.value);
          const degraded = p.quality >= 2;
          return (
            <g key={p.time}>
              <line x1={cx} x2={cx} y1={cy} y2="132" stroke={degraded ? '#ea580c' : '#2563eb'} strokeWidth="1" strokeDasharray="2 2" opacity="0.55"/>
              {degraded ? (
                <path d={`M${cx} ${cy - 5.5} L${cx + 5.5} ${cy} L${cx} ${cy + 5.5} L${cx - 5.5} ${cy} Z`} fill="#ea580c" stroke="#ffffff" strokeWidth="1.2">
                  <title>{`Pass ${idx + 1}: ${p.time.slice(0, 16)}Z · WSE ${p.value.toFixed(2)} m · Quality ${p.quality} (degraded)`}</title>
                </path>
              ) : (
                <circle cx={cx} cy={cy} r="4.5" fill="#2563eb" stroke="#ffffff" strokeWidth="1.2">
                  <title>{`Pass ${idx + 1}: ${p.time.slice(0, 16)}Z · WSE ${p.value.toFixed(2)} m · Quality ${p.quality} (suspect)`}</title>
                </circle>
              )}
            </g>
          );
        })}

        <rect x="68" y="148" width="692" height="68" fill="#ffffff" stroke="#dfdeda" rx="4"/>
        <text x="76" y="162" fill="#ea580c" fontSize="10.5" fontWeight="600" fontFamily="DM Mono, ui-monospace, monospace">
          B · NASA POWER PRECTOTCORR (mm/day) · Monthly grid-point mean rate at 38.2527°N, 85.7585°W
        </text>
        {[0, 5, 10].map(v => (
          <g key={v}>
            <line x1="68" x2="760" y1={yRain(v)} y2={yRain(v)} stroke="#e5e4e0"/>
            <text x="62" y={yRain(v) + 3} fill="#4a4a48" fontSize="10" textAnchor="end" fontFamily="DM Mono, ui-monospace, monospace">{v}</text>
          </g>
        ))}
        {pairs.map(row => {
          const cx = monthCenters[row.month] || 400;
          const top = yRain(row.powerValue);
          const h = Math.max(2, 214 - top);
          return (
            <g key={row.month}>
              <rect x={cx - 48} y={top} width="96" height={h} fill="rgba(184, 67, 20, 0.16)" stroke="#ea580c" strokeWidth="1.2" rx="2">
                <title>{`${row.month}: POWER ${row.powerValue.toFixed(2)} mm/day · ${row.swotPasses} SWOT passes (${row.swotMinObservedM.toFixed(2)}–${row.swotMaxObservedM.toFixed(2)} m)`}</title>
              </rect>
              <text x={cx} y={top - 4} fill="#111111" fontSize="10" textAnchor="middle" fontFamily="DM Mono, ui-monospace, monospace">
                {row.powerValue.toFixed(2)} mm/d
              </text>
              <text x={cx} y="231" fill="#4a4a48" fontSize="10.5" textAnchor="middle" fontFamily="DM Mono, ui-monospace, monospace">
                {row.month} ({row.swotPasses} passes)
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption>
        Top: 12 SWOT passes on SWORD reach <code>74267300251</code> (● quality 1 suspect: 10 passes; ◆ quality 2 degraded: 2 passes; quality 0: 0 passes). Bottom: Overlapping monthly POWER precipitation rate. Separate vertical axes prevent false visual equivalence.
      </figcaption>
    </figure>
  );
}

/**
 * SVG plot for Case 2: Rebased 2001–2024 annual temperature anomalies (°C relative to 2001–2020)
 * comparing Yogyakarta NASA POWER grid point vs NASA GISS GISTEMP v4 global index.
 */
function LocalGlobalFigure({comparison}) {
  const localSrc = comparison.advanced.sources[0];
  const globalSrc = comparison.advanced.sources[1];
  const localAnn = localSrc.annual;
  const globalAnn = globalSrc.annual;
  const minVal = -0.35, maxVal = 0.65;
  const xYear = y => 64 + ((y - 2001) / 23) * 696;
  const yVal = v => 188 - ((v - minVal) / (maxVal - minVal)) * 150;

  const polyline = rows => rows.map(r => `${xYear(r.year).toFixed(1)},${yVal(r.value).toFixed(1)}`).join(' ');
  const fitLine = trend => {
    const first = trend.fitted[0], last = trend.fitted.at(-1);
    return {x1: xYear(first.year), y1: yVal(first.value), x2: xYear(last.year), y2: yVal(last.value)};
  };
  const localFit = fitLine(localSrc.trend);
  const globalFit = fitLine(globalSrc.trend);

  return (
    <figure className="sc-figure">
      <svg viewBox="0 0 784 222" role="img" aria-label="2001 to 2024 annual temperature anomalies rebased to 2001–2020 for Yogyakarta NASA POWER grid point and NASA GISS GISTEMP v4 global index.">
        <rect x="64" y="24" width="696" height="168" fill="#ffffff" stroke="#dfdeda" rx="4"/>
        {[-0.2, 0, 0.2, 0.4, 0.6].map(v => (
          <g key={v}>
            <line x1="64" x2="760" y1={yVal(v)} y2={yVal(v)} stroke={v === 0 ? '#9e9d97' : '#e5e4e0'} strokeDasharray={v === 0 ? '4 3' : undefined}/>
            <text x="58" y={yVal(v) + 4} fill="#4a4a48" fontSize="10.5" textAnchor="end" fontFamily="DM Mono, ui-monospace, monospace">
              {v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)}°C
            </text>
          </g>
        ))}
        {[2001, 2005, 2010, 2015, 2020, 2024].map(y => (
          <g key={y}>
            <line x1={xYear(y)} x2={xYear(y)} y1="24" y2="192" stroke="#ecebe7"/>
            <text x={xYear(y)} y="208" fill="#4a4a48" fontSize="10.5" textAnchor="middle" fontFamily="DM Mono, ui-monospace, monospace">{y}</text>
          </g>
        ))}
        <line {...localFit} stroke="#2563eb" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.85"/>
        <line {...globalFit} stroke="#ea580c" strokeWidth="1.5" strokeDasharray="2 3" opacity="0.85"/>
        <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={polyline(localAnn)}/>
        <polyline fill="none" stroke="#ea580c" strokeWidth="2" points={polyline(globalAnn)}/>
        {localAnn.map(r => (
          <circle key={'loc-' + r.year} cx={xYear(r.year)} cy={yVal(r.value)} r="3.2" fill="#2563eb" stroke="#ffffff" strokeWidth="1">
            <title>{`${r.year} Yogyakarta POWER point anomaly: ${signed(r.value, 3)} °C`}</title>
          </circle>
        ))}
        {globalAnn.map(r => {
          const cx = xYear(r.year), cy = yVal(r.value);
          return (
            <path key={'glb-' + r.year} d={`M${cx} ${cy - 4} L${cx + 4} ${cy} L${cx} ${cy + 4} L${cx - 4} ${cy} Z`} fill="#ea580c" stroke="#ffffff" strokeWidth="1">
              <title>{`${r.year} NASA GISS Global anomaly: ${signed(r.value, 3)} °C`}</title>
            </path>
          );
        })}
        <text x="74" y="40" fill="#2563eb" fontSize="10.5" fontWeight="600" fontFamily="DM Mono, ui-monospace, monospace">
          ● Local POWER grid point (−7.7956°, 110.3695°): {signed(localSrc.trend.slopePerDecade, 3)} °C/dec
        </text>
        <text x="430" y="40" fill="#ea580c" fontSize="10.5" fontWeight="600" fontFamily="DM Mono, ui-monospace, monospace">
          ◆ Global GISTEMP v4 index: {signed(globalSrc.trend.slopePerDecade, 3)} °C/dec
        </text>
      </svg>
      <figcaption>
        Both series rebased to their own 2001–2020 monthly normals for visual context. Rebased anomalies align reference periods only—never spatial support (1 grid cell vs. global land-ocean index). No formal difference test is performed.
      </figcaption>
    </figure>
  );
}

export default function ScienceCases({onLoadWorkspace}) {
  const [selectedCase, setSelectedCase] = useState('swot-ohio-water-context');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [liveGistempState, setLiveGistempState] = useState({status: 'idle', data: null, error: ''});

  const catalog = scienceForAudience({advanced: true});
  const activeMeta = manifest.cases.find(c => c.id === selectedCase) || manifest.cases[0];
  const isSwot = selectedCase === 'swot-ohio-water-context';

  const gistempComparison = liveGistempState.data || gistempSnapshot.comparison;
  const swotObs = swotSnapshot.swot.observations;
  const swotQual = swotSnapshot.swot.qualityCounts;

  async function runLiveLocalGlobal() {
    setLiveGistempState({status: 'loading', data: null, error: ''});
    try {
      const res = await analyzeLocalGlobal({
        powerPoint: {lat: -7.7956, lon: 110.3695, label: 'Yogyakarta grid point'},
        from: 2001,
        to: 2024,
        baselineStart: 2001,
        baselineEnd: 2020,
        gistempSourceText: gistempRawTxt,
        gistempSourceFormat: 'txt'
      });
      setLiveGistempState({status: 'live', data: res, error: ''});
    } catch (err) {
      setLiveGistempState({status: 'error', data: null, error: String(err.message || err)});
    }
  }

  return (
    <div className="science-cases" id="science-cases" aria-labelledby="science-cases-title">
      <div className="sc-header">
        <div className="pane-title-group">
          <span className="section-kicker">Multi-source snapshots</span>
          <h2 id="science-cases-title">Verified Cross-Source NASA Case Studies</h2>
          <p>Audited static snapshots with explicit spatial/temporal support boundaries and quality flags.</p>
        </div>
        <span className="sc-snapshot-badge" id="sc-snapshot-badge">
          {!isSwot && liveGistempState.status === 'live'
            ? 'Live POWER + Dated GISS Table'
            : `Verified Snapshot · ${activeMeta.generatedAt.slice(0, 10)}`}
        </span>
      </div>

      <div className="sc-switcher" role="group" aria-label="Select multi-source case study">
        <button
          type="button"
          id="case-btn-swot"
          className={'sc-case-btn' + (isSwot ? ' is-selected' : '')}
          aria-pressed={isSwot}
          onClick={() => setSelectedCase('swot-ohio-water-context')}
        >
          <span className="sc-case-kicker">Case A · Hydrology &amp; Meteorology</span>
          <strong>Ohio River SWOT Satellite Passes + POWER Rain Context</strong>
          <small>SWORD Reach 74267300251 (12 passes, Mar–May 2025) + 38.25°N, 85.76°W</small>
        </button>
        <button
          type="button"
          id="case-btn-giss"
          className={'sc-case-btn' + (!isSwot ? ' is-selected' : '')}
          aria-pressed={!isSwot}
          onClick={() => setSelectedCase('giss-yogyakarta-temperature-context')}
        >
          <span className="sc-case-kicker">Case B · Local Grid vs. Global Index</span>
          <strong>Yogyakarta POWER Grid Point + NASA GISS Global Anomaly</strong>
          <small>288 monthly records each (2001–2024), rebased to 2001–2020 normals</small>
        </button>
      </div>

      {isSwot ? (
        <div className="sc-body" id="case-swot-view">
          <div className="sc-summary-grid">
            <article className="sc-card">
              <h3>Question &amp; Plain-Language Finding</h3>
              <p className="sc-lead">{swotSnapshot.caseStudy.simple.whatChanged}</p>
              <div className="sc-kv-row">
                <div><span>Observed WSE range</span><strong>120.68 m to 131.25 m (10.56 m spread)</strong></div>
                <div><span>Retained SWOT passes</span><strong>12 overpasses (2025-03-22 to 2025-05-15)</strong></div>
                <div><span>Quality flag breakdown</span><strong>Q0 (good): {swotQual[0]} · Q1 (suspect): {swotQual[1]} · Q2 (degraded): {swotQual[2]}</strong></div>
                <div><span>Overlapping POWER months</span><strong>3 UTC months (Mar–May 2025) · Association: {swotSnapshot.caseStudy.advanced.association.status} (n=3 &lt; 6 minimum)</strong></div>
              </div>
            </article>
            <article className="sc-card sc-card-warn">
              <h3>Support Boundaries &amp; Honest Limitations</h3>
              <ul className="sc-list">
                <li><strong>Irregular passes ≠ continuous gauge:</strong> SWOT samples reach <code>74267300251</code> intermittently. WSE is meters above a reference geoid, not river depth, discharge, or flood stage.</li>
                <li><strong>Grid cell ≠ watershed:</strong> NASA POWER <code>PRECTOTCORR</code> at <code>38.2527°, −85.7585°</code> is a local model grid-cell daily rate (<code>mm/day</code>), not upstream basin accumulation.</li>
                <li><strong>No causal or statistical claim:</strong> With only 3 overlapping calendar months, Terra-Lens refuses to compute a correlation p-value or flood attribution.</li>
                <li><strong>Next step:</strong> {swotSnapshot.caseStudy.simple.nextStep}</li>
              </ul>
              <div className="sc-actions">
                <button
                  type="button"
                  id="sc-open-louisville"
                  onClick={() => onLoadWorkspace?.({
                    variable: 'PRECTOTCORR', start: '2001', end: '2024',
                    cityA: 'custom', latA: '38.2527', lonA: '-85.7585', compare: false
                  })}
                >
                  Inspect Louisville POWER cell (2001–2024) in main workspace
                </button>
                <button type="button" onClick={() => setShowAdvanced(v => !v)} aria-expanded={showAdvanced}>
                  {showAdvanced ? 'Hide pass table & provenance' : 'Inspect all 12 SWOT passes & QA flags'}
                </button>
                <button type="button" onClick={() => downloadJSON('terra-lens-swot-ohio-case.json', swotSnapshot)}>
                  Export Snapshot JSON
                </button>
              </div>
            </article>
          </div>

          <SwotWaterFigure data={swotSnapshot}/>

          {showAdvanced && (
            <div className="sc-advanced" aria-label="SWOT pass observations and provenance">
              <div className="sc-adv-head">
                <h3>Retained SWOT RiverSP Version D Overpasses (SWORD Reach 74267300251)</h3>
                <span>Snapshot generated: {swotSnapshot.createdAt} · <a href={swotSnapshot.swot.sourceURL} target="_blank" rel="noreferrer">Original Hydrocron API URL</a></span>
              </div>
              <div className="sc-table-wrap" tabIndex="0">
                <table className="discovery-table">
                  <thead>
                    <tr>
                      <th>Pass UTC Time</th>
                      <th>WSE (m)</th>
                      <th>Reported wse_u (m)</th>
                      <th>Width (m)</th>
                      <th>Quality (reach_q)</th>
                      <th>CRID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {swotObs.map(o => (
                      <tr key={o.time}>
                        <td>{o.time.replace('T', ' ').slice(0, 19)}Z</td>
                        <td>{fmt(o.value, 4)}</td>
                        <td>±{fmt(o.reportedUncertainty, 4)}</td>
                        <td>{fmt(o.width, 1)}</td>
                        <td className={o.quality >= 2 ? 'sc-flag-warn' : ''}>
                          {o.quality} ({o.quality === 0 ? 'good' : o.quality === 1 ? 'suspect' : 'degraded'})
                        </td>
                        <td>{o.crid}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="sc-body" id="case-giss-view">
          <div className="sc-summary-grid">
            <article className="sc-card">
              <h3>Question &amp; Rebased Anomaly Comparison (2001–2024)</h3>
              <p className="sc-lead">{gistempComparison.simple.meaning}</p>
              <div className="sc-kv-row">
                <div><span>Yogyakarta POWER Point (−7.7956°, 110.3695°)</span><strong>{signed(gistempComparison.simple.pointFittedTrendCPerDecade, 3)} °C/decade (24 complete years)</strong></div>
                <div><span>NASA GISS GISTEMP v4 Global Index</span><strong>{signed(gistempComparison.simple.globalFittedTrendCPerDecade, 3)} °C/decade (24 complete years)</strong></div>
                <div><span>Common anomaly reference baseline</span><strong>{gistempComparison.simple.baseline} calendar-month normals</strong></div>
                <div><span>Point-vs-Global difference test</span><strong>Not performed (incompatible spatial support)</strong></div>
              </div>
            </article>
            <article className="sc-card sc-card-warn">
              <h3>Methodological &amp; Provenance Distinctions</h3>
              <ul className="sc-list">
                <li><strong>Global index ≠ map pin:</strong> GISTEMP v4 is a global land-ocean area-averaged anomaly index (original baseline 1951–1980), whereas NASA POWER is a single MERRA-2 model grid cell.</li>
                <li><strong>Dated official GISS table excerpt:</strong> Because the NASA GISS server blocks direct unproxied browser CORS/CI connections, the global series uses the checked-in official NASA table excerpt (<code>2001–2024</code>, dated <code>2026-11-14</code>).</li>
                <li><strong>Next step:</strong> {gistempComparison.simple.nextStep}</li>
              </ul>
              <div className="sc-actions">
                <button
                  type="button"
                  id="sc-reverify-giss"
                  disabled={liveGistempState.status === 'loading'}
                  onClick={runLiveLocalGlobal}
                >
                  {liveGistempState.status === 'loading' ? 'Querying live NASA POWER…' : 'Re-verify with live NASA POWER + dated GISS table'}
                </button>
                <button type="button" onClick={() => setShowAdvanced(v => !v)} aria-expanded={showAdvanced}>
                  {showAdvanced ? 'Hide source catalog' : 'View NASA source status & planned connectors'}
                </button>
                <button type="button" onClick={() => downloadJSON('terra-lens-yogyakarta-gistemp-case.json', gistempComparison)}>
                  Export Case JSON
                </button>
              </div>
              {liveGistempState.error && <p className="status error" role="alert">{liveGistempState.error}</p>}
            </article>
          </div>

          <LocalGlobalFigure comparison={gistempComparison}/>

          {showAdvanced && (
            <div className="sc-advanced" aria-label="NASA dataset integration catalog">
              <div className="sc-adv-head">
                <h3>Terra-Lens Dataset Integration Status (Live vs. Snapshot vs. Planned)</h3>
                <span>Never treat planned connectors as user-facing live sources.</span>
              </div>
              <div className="sc-table-wrap" tabIndex="0">
                <table className="discovery-table">
                  <thead>
                    <tr>
                      <th>Dataset / Mission</th>
                      <th>Integration Status</th>
                      <th>Spatial Support</th>
                      <th>Temporal Cadence</th>
                      <th>Challenge Resource Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalog.sources.map(src => (
                      <tr key={src.id}>
                        <th scope="row"><a href={src.url} target="_blank" rel="noreferrer">{src.label}</a></th>
                        <td><span className={'sc-status-pill sc-status-' + src.integration}>{src.integration}</span></td>
                        <td>{src.spatialSupport}</td>
                        <td>{src.cadence}</td>
                        <td>{src.challengeResourceStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <footer className="sc-provenance-bar" aria-label="Snapshot audit metadata">
        <span><strong>Snapshot ID:</strong> <code>{activeMeta.id}</code></span>
        <span><strong>Generated:</strong> {activeMeta.generatedAt}</span>
        <span><strong>Contract:</strong> Explicit spatial/temporal support boundaries · No hidden gap filling or cross-support interpolation</span>
      </footer>
    </div>
  );
}

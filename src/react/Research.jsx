import React, {useRef, useState} from 'react';
import {analyzeSeries, buildFindings} from '../series.js';
import {comparisonFinding, evidenceState, seriesFinding} from '../presentation/findings.js';
import {messages, signedNumber, trendSentence} from '../presentation/locale.js';
import {csvDownload, download, evidenceDownload, evidencePayload} from '../presentation/download.js';
import {BMKG_URL, CASE_RUN, METHODS_URL} from '../presentation/yogyakarta.js';
import printCSS from './brief.css?inline';

const generatedDate = date => date.toLocaleDateString('sv-SE', {timeZone: 'Asia/Jakarta'});
const utcLabel = date => date ? date.replace('T', ' ').replace(/\.\d+Z$/, 'Z') : '—';

function supportLabel(value, t) {
  return {'grid-point': t.grid, 'area-average': t.area}[value] || t.unknown;
}

function LocationLine({finding, t}) {
  return <>{supportLabel(finding.spatialSupport, t)} · {finding.location}
    {finding.coordinates && <> · {finding.coordinates.lat}°, {finding.coordinates.lon}°</>}</>;
}

function Strength({finding, locale}) {
  const t = messages[locale];
  const interval = finding.evidenceStrength.confidenceInterval;
  return <><p>{t.statuses[finding.findingStatus]} {interval && t.variability}</p>
    {interval && <p>{t.classicInterval} <strong>{interval.map(n => signedNumber(n, locale)).join(' … ')} {finding.unit} {t.perDecade}</strong>.</p>}</>;
}

function NextStep({t, detailed}) {
  return <><p>{t.verifyNext} <a href={BMKG_URL}>BMKG D.I. Yogyakarta</a></p>
    {detailed && <p>{t.verifyMore}</p>}</>;
}

function TrendFigure({series, locale}) {
  const t = messages[locale];
  const {annual, trend} = analyzeSeries(series);
  const number = (n, d) => n.toLocaleString(locale, {maximumFractionDigits: d, useGrouping: false});
  const [width, height] = [480, 248];
  const [first, last] = [annual[0].year, annual.at(-1).year];
  const [low, high] = [Math.floor(Math.min(...annual.map(row => row.value)) * 2) / 2,
    Math.ceil(Math.max(...annual.map(row => row.value)) * 2) / 2];
  const x = year => 66 + (year - first) * (width - 95) / (last - first);
  const y = value => 200 - (value - low) * 161 / (high - low || 1);
  const points = rows => rows.map(row => `${x(row.year)},${y(row.value)}`).join(' ');
  return <figure className="research-chart">
    <div className="research-chart-key"><span>{t.annual} · {series.variable.unit}</span><span>{t.fit}</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t.chartSummary}>
      {[low, (low + high) / 2, high].map(value => <g key={value}>
        <line x1="65" x2={width - 22} y1={y(value)} y2={y(value)} stroke="var(--research-border)"/>
        <text x="55" y={y(value) + 4} textAnchor="end">{number(value, 2)}</text>
      </g>)}
      {[first, 2012, last].map(year => <text key={year} textAnchor="middle" x={x(year)} y="227">{year}</text>)}
      <polyline points={points(annual)} fill="none" stroke="var(--research-accent)" strokeWidth="2"/>
      {annual.map(row => <circle key={row.year} cx={x(row.year)} cy={y(row.value)} r="2.4" fill="var(--research-accent)"/>)}
      <polyline points={points(trend.fitted)} fill="none" stroke="var(--research-trend)" strokeDasharray="7 5" strokeWidth="2"/>
    </svg>
  </figure>;
}

function PairFinding({series, locale, postSelected}) {
  const t = messages[locale];
  const comparisons = buildFindings(series).comparisons;
  return comparisons.map((row, index) => {
    const other = series[index + 1];
    const finding = comparisonFinding(row, series[0], other, {postSelected});
    return <div key={row.otherId} className="research-pair">
      <h3>{other.label} − {series[0].label}</h3>
      <p>{t.statuses[finding.findingStatus]} {finding.findingStatus === 'difference-not-established' && t.noPair}</p>
      {finding.value !== null && <p><strong>{signedNumber(finding.value, locale)} {finding.unit} {t.perDecade}</strong>
        {finding.evidenceStrength.confidenceInterval && <> · HAC 95% {finding.evidenceStrength.confidenceInterval.map(n => signedNumber(n, locale)).join(' … ')}</>}</p>}
    </div>;
  });
}

export function Understand({archive, series, current, locale, state, dirty, partial, inputError, postSelected, onRetry}) {
  const t = messages[locale];
  const primary = current ? series.find(s => s.id === 'A') : archive[0];
  const finding = primary ? seriesFinding(primary) : null;
  const status = evidenceState({state: current ? state : 'success', dirty: current && dirty, finding});
  const showFinding = finding && !['request-failed','stale-query','loading'].includes(status);
  return <main id="understand" tabIndex={-1} className="research-page">
    <section className="research-hero" aria-labelledby="research-question">
      <div className="research-answer">
        <p className="research-kicker">{current ? 'NASA POWER' : t.caseLabel}</p>
        <h1 id="research-question">{current ? t.currentQuestion : t.caseQuestion}</h1>
        <div role="status">
          {showFinding ? <>
            <p className="research-meta"><LocationLine finding={finding} t={t}/> · {finding.period.start}–{finding.period.end}</p>
            <p className="research-result">{trendSentence(finding, primary.variable.label, locale)}</p>
            {finding.value !== null && <p>{t.statuses[finding.findingStatus]}</p>}
            <p className="research-limit">{t.caseScope}</p>
            <p className="research-meta">{current ? t.fresh : t.archive} · {utcLabel(finding.retrievedAt ?? finding.capturedAt)}</p>
          </> : <p className="research-result">{t.statuses[status]} {inputError && t.inputError}</p>}
          {current && partial && <p>{t.partial}</p>}
        </div>
        <div className="research-actions">
          {!current && <a className="research-primary" href="#brief">{t.brief}</a>}
          {showFinding && <a href={current ? '#verify-investigation' : '#verify'}>{t.sources}</a>}
          {current && <a href="#explore">{t.goExplore}</a>}
          {current && (state === 'error' || partial) && !inputError && <button onClick={onRetry}>{t.retry}</button>}
          {current && <a href="#understand">{t.archiveView}</a>}
        </div>
      </div>
      {!current && <TrendFigure series={archive[0]} locale={locale}/>}
    </section>
    {showFinding && <div className="research-details">
      <section><h2>{t.strength}</h2><Strength finding={finding} locale={locale}/></section>
      <section><h2>{t.next}</h2>{current
        ? <p>{t.localVerification}</p>
        : <NextStep t={t} detailed/>}</section>
      {(current ? series : archive).length > 1 && <section className="research-wide">
        <h2>{t.compare}</h2><PairFinding series={current ? series : archive} locale={locale} postSelected={current&&postSelected}/>
        <a className="research-inline-action" href="#tab-comparison">{t.exploreChart}</a>
      </section>}
    </div>}
  </main>;
}

function RecordTable({rows, title, unit, monthly, t}) {
  return <details className="research-records"><summary>{title} · {rows.length}</summary>
    <div className="research-table-scroll" tabIndex={0} role="region" aria-label={title}>
      <table><caption>{title} ({unit})</caption><thead><tr><th scope="col">{t.date}</th><th scope="col">{t.value} ({unit})</th></tr></thead>
        <tbody>{rows.map(row => {
          const date = monthly ? `${row.year}-${String(row.month).padStart(2, '0')}` : row.year;
          return <tr key={date}><th scope="row">{date}</th><td>{row.value}</td></tr>;
        })}</tbody></table>
    </div></details>;
}

export function Verify({series, locale, current, state, dirty, onShare, postSelected, partial}) {
  const t = messages[locale];
  const usable = !current || (state === 'success' && !dirty && series.some(s => s.id === 'A'));
  return <main id="verify" tabIndex={-1} className="research-page research-verify">
    <p className="research-kicker">{current ? 'NASA POWER / Giovanni' : t.caseLabel}</p>
    <h1>{t.sources}</h1>
    <p>{t.methodShort} {t.variability}</p>
    {!current && <p>{t.snapshotNote}</p>}
    <div className="research-actions">
      <a href={METHODS_URL}>{t.methods}</a>
      {!current && <a href={CASE_RUN}>{t.reproduction}</a>}
      {usable && <><button onClick={() => evidenceDownload(series, undefined, {postSelected})}>{t.json}</button>
        <button onClick={() => csvDownload(series)}>{t.csv}</button></>}
      {current && <button onClick={onShare}>{t.sharing}</button>}
      {!current && <a href="#brief">{t.brief}</a>}
    </div>
    {current && <p>{t.shareNote}</p>}
    {current && partial && <p role="status">{t.partial}</p>}
    {!usable && <p role="status">{t.statuses[evidenceState({state, dirty})]} {t.noNumbers}</p>}
    {usable && series.map(s => {
      const a = analyzeSeries(s);
      const finding = seriesFinding(s);
      const p = s.provenance;
      const sourceDate = p.retrievedAt ?? p.capturedAt;
      const sourceStatus = p.authenticated === false ? t.imported : p.sourceMode === 'snapshot' ? t.archive : t.fresh;
      const url = /^https:\/\//i.test(p.url ?? '') ? p.url : null;
      return <section key={s.id} className="research-source">
        <h2>{s.id} · {s.label}</h2>
        <p><LocationLine finding={finding} t={t}/> · {s.variable.code} ({s.variable.unit}){p.requestedBounds && <> · [{p.requestedBounds.join(', ')}]</>}</p>
        <p>{sourceStatus}{sourceDate && <> · {utcLabel(sourceDate)}</>} · {p.product || p.metadata?.sources?.join(', ')}
          {p.metadata?.api?.version && <> · API {p.metadata.api.version}</>}{p.doi && <> · DOI {p.doi}</>}</p>
        <p>{t.sampling} · {a.coverage.expectedFirstYear}–{a.coverage.expectedLastYear} · {a.coverage.months} {t.recorded} · {a.coverage.completeYears} {t.complete} · {a.coverage.missingMonths} {t.missing}</p>
        {a.coverage.incompleteYears?.length>0 && <p>{t.missingYears} · {a.coverage.incompleteYears.join(', ')}</p>}
        {url && <p><a href={url}>{p.authenticated === false ? url : t.original}</a></p>}
        <details className="research-records"><summary>{t.moreSourceData}</summary>
          {s.geo && <p>{t.requested} · {s.geo.lat}°, {s.geo.lon}°</p>}
          {p.coordinate && <p>{t.returned} · {p.coordinate[1]}°, {p.coordinate[0]}°</p>}
          {p.fileName && <p>{t.localFile} · {p.fileName}</p>}
          {(p.sha256 || p.archive?.sha256) && <p>SHA-256 · <code>{p.sha256 || p.archive.sha256}</code></p>}
          {p.metadata && <pre>{JSON.stringify({...p.metadata,...(p.parameterMetadata?{parameter:p.parameterMetadata}:{})},null,2)}</pre>}
        </details>
        <Strength finding={finding} locale={locale}/>
        <RecordTable rows={s.monthly} title={t.rawMonths} unit={s.variable.unit} monthly t={t}/>
        <RecordTable rows={a.annual} title={t.annualValues} unit={s.variable.unit} t={t}/>
      </section>;
    })}
    {usable && series.length > 1 && <section className="research-source"><h2>{t.compare}</h2><PairFinding series={series} locale={locale} postSelected={postSelected}/></section>}
  </main>;
}

export function Brief({archive, locale}) {
  const t = messages[locale];
  const ref = useRef(null);
  const [generatedAt] = useState(() => new Date().toISOString());
  const finding = seriesFinding(archive[0]);
  function saveBrief() {
    const payload = {schema:'terra-lens-screening-brief-v1', locale, generatedAt,
      question:t.researchQuestion, statement:trendSentence(finding, archive[0].variable.label, locale),
      scope:[t.caseScope, t.moreLimits], nextVerification:[t.verifyNext, t.verifyMore],
      screening:t.screening, methods:METHODS_URL, evidence:evidencePayload(archive, undefined, generatedAt)};
    const evidenceJSON = JSON.stringify(payload).replaceAll('<', '\\u003c');
    download(`terra-lens-yogyakarta-brief-${locale}.html`, 'text/html;charset=utf-8',
      `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${t.report}</title><style>${printCSS}</style></head><body><main>${ref.current.outerHTML}</main><script type="application/json" id="brief-evidence">${evidenceJSON}</script></body></html>`);
  }
  return <main className="research-page brief-page" id="brief" tabIndex={-1}>
    <style>{printCSS}</style>
    <div className="research-actions brief-tools"><a href="#understand">{t.understand}</a>
      <a href="#verify">{t.verify}</a><button onClick={saveBrief}>{t.html}</button>
      <button onClick={() => window.print()}>{t.print}</button></div>
    <article className="research-brief" ref={ref}>
      <header><p className="brief-label">Terra-Lens 2.0 · {t.caseLabel}</p><h1>{t.report}</h1>
        <p><strong>{t.generated}</strong> {generatedDate(new Date(generatedAt))} (WIB) · <strong>{t.archivedAt}</strong> {utcLabel(finding.capturedAt)}</p></header>
      <section><h2>{t.researchQuestion}</h2>
        <p><LocationLine finding={finding} t={t}/> · T2M · {finding.coverage.months} {t.recorded} · {finding.coverage.completeYears} {t.complete}</p>
        <p><strong>{trendSentence(finding, archive[0].variable.label, locale)}</strong></p>
      </section>
      <section><h2>{t.strength}</h2><Strength finding={finding} locale={locale}/><p>{t.methodShort}</p></section>
      <section><h2>{t.scope}</h2><p>{t.caseScope} {t.moreLimits}</p></section>
      <section><h2>{t.next}</h2><NextStep t={t} detailed/></section>
      <section><h2>{t.sources}</h2><p>NASA POWER · MERRA-2 · API {archive[0].provenance.metadata.api.version} · {t.archive}</p>
        <p className="brief-url"><a href={finding.sourceRefs[0]}>{finding.sourceRefs[0]}</a></p>
        <p><a href={METHODS_URL}>{t.methods}</a> · <a href={CASE_RUN}>{t.reproduction}</a></p></section>
      <footer><strong>{t.screening}</strong></footer>
    </article>
  </main>;
}

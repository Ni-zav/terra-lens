import {analyzeSeries, buildFindings} from '../series.js';
import {csvCell} from '../csv.js';
import {comparisonFinding, seriesFinding} from './findings.js';

export function download(name, type, content) {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadJSON(name, payload) {
  download(name, 'application/json;charset=utf-8', JSON.stringify(payload, null, 2) + '\n');
}

export function csvDownload(series) {
  if (!series.length) return;
  const columns = ['series','location','latitude','longitude','spatial_support','variable','year','month','value','unit','source_url','retrieved_at','source_mode','captured_at'];
  const rows = [columns.join(',')];
  for (const s of series) {
    for (const p of s.monthly) {
      rows.push([s.id, s.label, s.geo?.lat, s.geo?.lon, s.support, s.variable.code, p.year, p.month, p.value,
        s.variable.unit, s.provenance.url, s.provenance.retrievedAt,
        s.provenance.sourceMode ?? (s.provenance.authenticated === false ? 'user-imported' : ''), s.provenance.capturedAt].map(csvCell).join(','));
    }
  }
  download(`terra-lens-${series[0].variable.code.replace(':','-')}.csv`, 'text/csv;charset=utf-8', rows.join('\n') + '\n');
}

export function evidencePayload(series, findings = buildFindings(series), generatedAt = new Date().toISOString(), options) {
  const byId = new Map(series.map(s => [s.id, s]));
  return {
    schema: 'terra-lens-evidence-v2', generatedAt,
    provenanceNote: 'Monthly records are as retrieved from NASA POWER (including dated archives) or locally imported. All derived values are deterministic.',
    method: 'Day-weighted complete-year annual means; classical OLS t-test; Mann–Kendall with Theil–Sen slope; residual lag-1 autocorrelation; paired aligned-year contrast with Bartlett Newey–West HAC for compatible series only.',
    limitations: 'Grid-point estimates are not whole-city measurements. Single-series tests assume independent annual values. HAC is approximate. No causation, forecast or multiple-testing correction.',
    series: series.map(s => {
      const a = analyzeSeries(s);
      return {id:s.id, label:s.label, variable:s.variable, support:s.support, geo:s.geo, provenance:s.provenance,
        monthly:s.monthly, annual:a.annual, coverage:a.coverage, ols:a.trend, mannKendall:a.robust, dependence:a.dependence, verdict:a.verdict};
    }),
    comparisons: findings.comparisons, findings: findings.lines,
    interpretation: {
      series: series.map(seriesFinding),
      comparisons: findings.comparisons.map(c => comparisonFinding(c, byId.get(c.referenceId), byId.get(c.otherId), options))
    }
  };
}

export function evidenceDownload(series, findings, options) {
  if (series.length) downloadJSON('terra-lens-auditable-evidence.json', evidencePayload(series, findings, undefined, options));
}

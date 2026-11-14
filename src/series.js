/**
 * Terra-Lens shared data model.
 *
 * 1. Every source adapter (live NASA POWER, imported NASA Giovanni CSV, …)
 *    produces the same immutable `Series`: raw monthly records + variable,
 *    spatial support and provenance. Nothing downstream knows where it came from.
 * 2. Every number shown on screen or exported is a pure, memoized derivation of
 *    a Series (`derive`). Derivations run the first time a view asks for them
 *    and are cached on the Series object, so switching tabs, ranges or display
 *    modes never refetches data and never changes the statistics.
 * 3. Display options (10-year window, anomaly mode) are view-model concerns
 *    (`src/react/chart-model.js`); they never feed back into inference.
 */
import {
  annualMeans, linearTrend, mannKendall, lag1Autocorrelation,
  monthlyClimatology, monthlyAnomalies, seasonalTrends
} from './stats.js';
import {pairedContrast} from './contrast.js';

export const SUPPORT = Object.freeze({
  GRID_POINT: 'grid-point',
  AREA_AVERAGE: 'area-average',
  UNKNOWN: 'unknown'
});

const SUPPORT_LABEL = {
  'grid-point': 'Model grid-point estimate',
  'area-average': 'Area-averaged product',
  unknown: 'Spatial support not stated'
};
export const supportLabel = support => SUPPORT_LABEL[support] || SUPPORT_LABEL.unknown;

/** Build a frozen canonical Series. Monthly rows are validated, sorted and de-duplicated. */
export function makeSeries({id, label, color, variable, support = SUPPORT.UNKNOWN, geo = null, provenance = {}, monthly}) {
  if (!id || !variable?.unit) throw new Error('Series requires id and variable unit.');
  const seen = new Set();
  const rows = (monthly || [])
    .filter(p => Number.isInteger(p.year) && Number.isInteger(p.month) && p.month >= 1 && p.month <= 12 && Number.isFinite(p.value))
    .map(p => Object.freeze({year: p.year, month: p.month, value: p.value}))
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .filter(p => { const k = p.year * 100 + p.month; if (seen.has(k)) return false; seen.add(k); return true; });
  return Object.freeze({
    id, label: label || id, color: color || '#9fb3bf',
    variable: Object.freeze({code: variable.code || null, label: variable.label || variable.code || 'Variable', unit: variable.unit, description: variable.description || ''}),
    support, geo: geo ? Object.freeze({lat: geo.lat, lon: geo.lon}) : null,
    provenance: Object.freeze({...provenance}),
    monthly: Object.freeze(rows)
  });
}

/* ---------- memoized derivations ---------- */
const cache = new WeakMap();
/** Compute `fn(series)` once per (series, key). */
export function derive(series, key, fn) {
  let slot = cache.get(series);
  if (!slot) cache.set(series, slot = new Map());
  if (!slot.has(key)) slot.set(key, fn(series));
  return slot.get(key);
}

export const annualOf = s => derive(s, 'annual', x => annualMeans(x.monthly));
export const trendOf = s => derive(s, 'ols', x => linearTrend(annualOf(x)));
export const robustOf = s => derive(s, 'mann-kendall', x => mannKendall(annualOf(x)));
export const climatologyOf = s => derive(s, 'climatology', x => monthlyClimatology(x.monthly));
export const anomaliesOf = (s, standardized = false) =>
  derive(s, standardized ? 'anomaly-z' : 'anomaly', x => monthlyAnomalies(x.monthly, {standardized}));
export const seasonalOf = s => derive(s, 'seasonal-trends', x => seasonalTrends(x.monthly));

export function coverageOf(s) {
  return derive(s, 'coverage', x => {
    if (!x.monthly.length) return {firstYear: null, lastYear: null, months: 0, expectedMonths: 0, completeYears: 0, incompleteYears: [], missingMonths: 0};
    const first = x.monthly[0].year, last = x.monthly.at(-1).year;
    const complete = new Set(annualOf(x).map(r => r.year));
    const years = [...new Set(x.monthly.map(r => r.year))];
    const expected = (last - first + 1) * 12;
    return {firstYear: first, lastYear: last, months: x.monthly.length, expectedMonths: expected,
      completeYears: complete.size, incompleteYears: years.filter(y => !complete.has(y)),
      missingMonths: expected - x.monthly.length};
  });
}

/** Lag-1 autocorrelation of OLS residuals vs. the approximate white-noise 95% bound. */
export function dependenceOf(s) {
  return derive(s, 'dependence', x => {
    const trend = trendOf(x);
    if (!trend) return null;
    const annual = annualOf(x);
    const r1 = lag1Autocorrelation(annual.map((row, i) => row.value - trend.fitted[i].value));
    const bound = 1.96 / Math.sqrt(annual.length);
    return {r1, bound, flagged: r1 !== null && Math.abs(r1) > bound};
  });
}

/**
 * Evidence verdict: agreement between a parametric (OLS t) and a rank-based
 * (Mann–Kendall) test. It grades *consistency of evidence*, never proof or cause.
 */
export function verdictOf(s) {
  return derive(s, 'verdict', x => {
    const ols = trendOf(x), mk = robustOf(x), dep = dependenceOf(x);
    if (!ols || !mk) return {level: 'insufficient', direction: 0, testsAgreeing: 0,
      headline: 'Not enough complete years', detail: 'At least 10 complete calendar years are required before any trend is estimated.'};
    const olsSig = ols.pValue < 0.05, mkSig = mk.pValue < 0.05;
    const olsDir = Math.sign(ols.slopePerDecade), mkDir = Math.sign(mk.senSlopePerDecade);
    const word = d => d > 0 ? 'increase' : 'decrease';
    let level, headline, direction = 0;
    if (olsSig && mkSig && olsDir === mkDir && olsDir !== 0) {
      level = 'consistent'; direction = olsDir; headline = `Consistent ${word(olsDir)}`;
    } else if (olsSig || mkSig) {
      level = 'mixed'; direction = olsSig ? olsDir : mkDir; headline = `Mixed evidence of ${word(direction)}`;
    } else {
      level = 'not-detected'; headline = 'No trend detected at p < 0.05';
    }
    const agreeing = (olsSig ? 1 : 0) + (mkSig ? 1 : 0);
    const detail = level === 'not-detected'
      ? 'Neither test reaches p < 0.05. This is not evidence that the series is unchanging.'
      : `${agreeing} of 2 tests reach p < 0.05 (classical OLS t, Mann–Kendall).` +
        (dep?.flagged ? ' Residual lag-1 autocorrelation exceeds the white-noise bound, so both p-values may be optimistic.' : '');
    return {level, direction, testsAgreeing: agreeing, headline, detail, dependenceFlag: Boolean(dep?.flagged)};
  });
}

/** Everything a view needs about one series, assembled lazily from the cache. */
export function analyzeSeries(s) {
  return derive(s, 'analysis', x => ({
    series: x, annual: annualOf(x), trend: trendOf(x), robust: robustOf(x),
    coverage: coverageOf(x), dependence: dependenceOf(x), verdict: verdictOf(x)
  }));
}

/**
 * Are two series directly comparable by paired difference? Same physical
 * variable, unit and spatial support are required; otherwise only
 * standardized-anomaly shape comparison is offered.
 */
export function compatibility(a, b) {
  const reasons = [];
  if (a.variable.unit !== b.variable.unit) reasons.push(`units differ (${a.variable.unit} vs ${b.variable.unit})`);
  if (!a.variable.code || a.variable.code !== b.variable.code) reasons.push('different source variables');
  if (a.support !== b.support) reasons.push(`spatial support differs (${supportLabel(a.support)} vs ${supportLabel(b.support)})`);
  return {paired: reasons.length === 0, reasons};
}

/** Paired B−A contrast when compatible, otherwise an explicit refusal with reasons. */
export function compareSeries(reference, other) {
  const compat = compatibility(reference, other);
  const contrast = compat.paired ? pairedContrast(annualOf(reference), annualOf(other)) : null;
  return {referenceId: reference.id, otherId: other.id, ...compat, contrast};
}

/** Can these series share one value axis? */
export function sharedUnit(seriesList) {
  const units = new Set(seriesList.map(s => s.variable.unit));
  return units.size === 1 ? [...units][0] : null;
}

/* ---------- plain-language findings (single source for UI + exports) ---------- */
const fmt = (v, d = 2) => Number.isFinite(v) ? (v > 0 ? '+' : '') + v.toFixed(d) : '—';

export function describeSeries(s) {
  const a = analyzeSeries(s);
  if (!a.trend) return `${s.id} · ${s.label}: ${a.verdict.headline.toLowerCase()}.`;
  return `${s.id} · ${s.label}: ${a.verdict.headline.toLowerCase()} — OLS ${fmt(a.trend.slopePerDecade)} ${s.variable.unit}/decade, ` +
    `Sen ${fmt(a.robust.senSlopePerDecade)} ${s.variable.unit}/decade over ${a.trend.n} complete years.`;
}

export function describeComparison(cmp, byId) {
  const ref = byId[cmp.referenceId], other = byId[cmp.otherId];
  if (!cmp.paired) return `${other.id} vs ${ref.id}: no paired test — ${cmp.reasons.join('; ')}.`;
  if (!cmp.contrast) return `${other.id} vs ${ref.id}: fewer than 10 shared complete years.`;
  const h = cmp.contrast.hac;
  const excludesZero = h.ciLowPerDecade > 0 || h.ciHighPerDecade < 0;
  return `${other.id} − ${ref.id}: ${fmt(h.slopePerDecade)} ${ref.variable.unit}/decade difference in trend ` +
    (excludesZero ? '(approximate HAC 95% interval excludes zero).' : '(approximate HAC 95% interval includes zero — no evidence of a different trend).');
}

/** Ordered findings for the inference panel and the Evidence JSON. */
export function buildFindings(seriesList) {
  if (!seriesList.length) return {lines: [], comparisons: []};
  const byId = Object.fromEntries(seriesList.map(s => [s.id, s]));
  const [ref, ...others] = seriesList;
  const comparisons = others.map(o => compareSeries(ref, o));
  return {
    lines: [...seriesList.map(describeSeries), ...comparisons.map(c => describeComparison(c, byId))],
    comparisons
  };
}

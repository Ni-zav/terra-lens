/**
 * View-models: turn canonical Series into chart-ready arrays. Pure and cheap;
 * display options (window, mode) only change what is drawn, never the
 * statistics, which always come from the full-period derivations in series.js.
 */
import {annualOf, trendOf, anomaliesOf, climatologyOf, seasonalOf, sharedUnit} from '../series.js';

export const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const pad = m => String(m).padStart(2, '0');

/**
 * Pick which series can share a value axis. Values and annual modes draw only
 * series in the reference (first) series' unit; anomaly mode falls back to
 * standardized anomalies (σ) when units differ so every series stays visible.
 */
export function axisPlan(seriesList, mode) {
  if (!seriesList.length) return {unit: '', standardized: false, drawn: [], excluded: []};
  const unit = seriesList[0].variable.unit;
  if (mode === 'anomaly') {
    const shared = sharedUnit(seriesList);
    return {unit: shared ?? 'σ', standardized: shared === null, drawn: seriesList, excluded: []};
  }
  return {unit, standardized: false,
    drawn: seriesList.filter(s => s.variable.unit === unit),
    excluded: seriesList.filter(s => s.variable.unit !== unit)};
}

/** A continuous calendar domain; missing records are null, never zero-filled. */
export function buildChartModel(seriesList, {mode = 'annual', range = 'all'} = {}) {
  const plan = axisPlan(seriesList, mode);
  const monthly = mode !== 'annual';
  const rowsOf = s => mode === 'annual' ? annualOf(s) : mode === 'anomaly' ? anomaliesOf(s, plan.standardized) : s.monthly;
  const available = plan.drawn.flatMap(rowsOf);
  if (!available.length) return {mode, unit: plan.unit, standardized: plan.standardized, excluded: plan.excluded, dates: [], series: []};
  const end = Math.max(...available.map(p => p.year));
  const first = range === '10' ? end - 9 : Math.min(...available.map(p => p.year));
  const dates = [];
  for (let year = first; year <= end; year++) {
    if (monthly) for (let month = 1; month <= 12; month++) dates.push(`${year}-${pad(month)}`);
    else dates.push(String(year));
  }
  const key = p => monthly ? `${p.year}-${pad(p.month)}` : String(p.year);
  return {mode, unit: plan.unit, standardized: plan.standardized, excluded: plan.excluded, dates,
    series: plan.drawn.map(s => {
      const data = new Map(rowsOf(s).map(p => [key(p), p.value]));
      const trend = mode === 'annual' ? trendOf(s) : null;
      const fit = new Map((trend?.fitted || []).map(p => [String(p.year), p.value]));
      return {id: s.id, label: s.label, color: s.color,
        slopePerDecade: trend?.slopePerDecade ?? null,
        values: dates.map(d => data.get(d) ?? null),
        fit: mode === 'annual' ? dates.map(d => fit.get(d) ?? null) : []};
    })};
}

/** Seasonal cycle and calendar-month trends for series sharing the reference unit. */
export function buildSeasonalModel(seriesList) {
  const plan = axisPlan(seriesList, 'values');
  return {unit: plan.unit, excluded: plan.excluded, months: MONTH_LABELS,
    series: plan.drawn.map(s => ({id: s.id, label: s.label, color: s.color,
      climatology: climatologyOf(s).map(c => c.mean),
      slopes: seasonalOf(s).map(m => m.slopePerDecade),
      detail: seasonalOf(s)}))};
}

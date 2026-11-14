/** Paired annual point contrast. Positive B-A slope means B's fitted trend is steeper. */
import {linearTrend, studentTCritical95, studentTTwoSidedP} from './stats.js';

export function pairedContrast(annualA, annualB, minYears = 10) {
  const byYear = rows => {
    const map = new Map();
    for (const row of rows) {
      if (!Number.isInteger(row.year) || !Number.isFinite(row.value)) continue;
      if (map.has(row.year)) throw new Error('Duplicate annual year in paired comparison');
      map.set(row.year, row.value);
    }
    return map;
  };
  const a = byYear(annualA), b = byYear(annualB);
  const years = [...a.keys()].filter(year => b.has(year)).sort((x, y) => x - y);
  if (years.length < minYears) return null;
  const differences = years.map(year => ({year, value: b.get(year) - a.get(year)}));
  const trend = linearTrend(differences, minYears);
  if (!trend) return null;
  const n = years.length;
  const xMean = years.reduce((sum, year) => sum + year, 0) / n;
  const x = years.map(year => year - xMean);
  const sxx = x.reduce((sum, value) => sum + value * value, 0);
  const errors = differences.map((row, i) => row.value - trend.fitted[i].value);
  const lag = Math.min(n - 2, Math.max(1, Math.floor(4 * (n / 100) ** (2 / 9))));
  const terms = errors.map((err, i) => err * x[i]);
  let varianceSum = terms.reduce((sum, value) => sum + value * value, 0);
  for (let k = 1; k <= lag; k++) {
    let cross = 0;
    for (let i = k; i < n; i++) cross += terms[i] * terms[i - k];
    varianceSum += 2 * (1 - k / (lag + 1)) * cross;
  }
  const variance = Math.max(0, varianceSum * (n / (n - 2)) / (sxx * sxx));
  const standardError = Math.sqrt(variance);
  const t = standardError === 0 ? (Math.abs(trend.slopePerYear) < 1e-12 ? 0 : Infinity)
    : trend.slopePerYear / standardError;
  const critical = studentTCritical95(n - 2);
  const residualSquares = errors.reduce((sum, error) => sum + error * error, 0);
  const durbinWatson = residualSquares < 1e-20 ? null : errors.slice(1)
    .reduce((sum, error, i) => sum + (error - errors[i]) ** 2, 0) / residualSquares;
  return {
    definition: 'B minus A on paired complete calendar years',
    differences,
    n, years, excludedYearsA: [...a.keys()].filter(year => !b.has(year)).sort((x, y) => x - y),
    excludedYearsB: [...b.keys()].filter(year => !a.has(year)).sort((x, y) => x - y),
    classical: trend,
    hac: {
      method: 'Bartlett Newey-West HAC, HC1 scaling; approximate Student t reference',
      lag,
      slopePerDecade: trend.slopePerDecade,
      sePerDecade: standardError * 10,
      ciLowPerDecade: (trend.slopePerYear - critical * standardError) * 10,
      ciHighPerDecade: (trend.slopePerYear + critical * standardError) * 10,
      pValue: studentTTwoSidedP(t, n - 2),
      durbinWatson
    },
    caveat: 'Exploratory paired point comparison, not a causal or spatially representative claim. HAC is approximate and does not capture source uncertainty, all temporal dependence, or search multiplicity.'
  };
}

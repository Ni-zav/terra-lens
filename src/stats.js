/** Pure computations; never identify a p-value as proof of causation. */
export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function annualMeans(monthly) {
  const byYear = new Map();
  for (const item of monthly) {
    if (!Number.isInteger(item.year) || !Number.isInteger(item.month) ||
        item.month < 1 || item.month > 12 || !Number.isFinite(item.value)) continue;
    if (!byYear.has(item.year)) byYear.set(item.year, new Map());
    byYear.get(item.year).set(item.month, item.value);
  }
  const annual = [];
  for (const [year, months] of [...byYear].sort((a, b) => a[0] - b[0])) {
    if (months.size !== 12) continue;
    let numerator = 0, denominator = 0;
    for (let month = 1; month <= 12; month++) {
      const days = daysInMonth(year, month);
      numerator += months.get(month) * days;
      denominator += days;
    }
    annual.push({ year, value: numerator / denominator });
  }
  return annual;
}

function logGamma(z) {
  const p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = p[0];
  for (let i = 1; i < p.length; i++) x += p[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaFraction(a, b, x) {
  const tiny = 1e-300;
  let c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 250; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 3e-14) break;
  }
  return h;
}

export function regularizedBeta(x, a, b) {
  if (!(x >= 0 && x <= 1 && a > 0 && b > 0)) throw new RangeError('Invalid beta parameters');
  if (x === 0) return 0;
  if (x === 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) +
    a * Math.log(x) + b * Math.log1p(-x));
  const value = x < (a + 1) / (a + b + 2)
    ? bt * betaFraction(a, b, x) / a
    : 1 - bt * betaFraction(b, a, 1 - x) / b;
  return Math.min(1, Math.max(0, value));
}

export function studentTTwoSidedP(t, df) {
  if (!(df > 0) || Number.isNaN(t)) throw new RangeError('Invalid t or degrees of freedom');
  if (!Number.isFinite(t)) return 0;
  return regularizedBeta(df / (df + t * t), df / 2, 0.5);
}

export function studentTCritical95(df) {
  if (!(df > 0)) throw new RangeError('Invalid degrees of freedom');
  let lo = 0, hi = 30;
  for (let i = 0; i < 85; i++) {
    const mid = (lo + hi) / 2;
    if (studentTTwoSidedP(mid, df) > 0.05) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function linearTrend(annual, minYears = 10) {
  const points = annual.filter(p => Number.isFinite(p.year) && Number.isFinite(p.value))
    .sort((a, b) => a.year - b.year);
  if (points.length < minYears || points.length < 3 ||
      new Set(points.map(p => p.year)).size !== points.length) return null;
  const n = points.length;
  const xMean = points.reduce((s, p) => s + p.year, 0) / n;
  const yMean = points.reduce((s, p) => s + p.value, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.year - xMean) ** 2, 0);
  if (sxx <= 0) return null;
  const slope = points.reduce((s, p) => s + (p.year - xMean) * (p.value - yMean), 0) / sxx;
  const fit = points.map(p => ({ year: p.year, value: yMean + slope * (p.year - xMean) }));
  const sse = points.reduce((s, p, i) => s + (p.value - fit[i].value) ** 2, 0);
  const sst = points.reduce((s, p) => s + (p.value - yMean) ** 2, 0);
  const df = n - 2;
  const stdErr = Math.sqrt(Math.max(0, sse) / (df * sxx));
  const zero = Math.abs(slope) < 1e-12;
  const t = stdErr === 0 ? (zero ? 0 : Infinity) : slope / stdErr;
  const pValue = studentTTwoSidedP(t, df);
  const margin = studentTCritical95(df) * stdErr;
  return {
    n, start: points[0].year, end: points[n - 1].year,
    slopePerYear: slope, slopePerDecade: slope * 10,
    ciLowPerDecade: (slope - margin) * 10,
    ciHighPerDecade: (slope + margin) * 10,
    pValue, significant: pValue < 0.05,
    totalFittedChange: slope * (points[n - 1].year - points[0].year),
    rSquared: sst < 1e-18 ? 1 : Math.max(0, 1 - sse / sst),
    fitted: fit, degreesOfFreedom: df,
    note: 'Exploratory classical OLS t-inference; serial correlation and multiple testing can invalidate p-values.'
  };
}

/** Complementary error function (Numerical Recipes erfcc, fractional error < 1.2e-7 everywhere). */
export function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
    t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

/** Two-sided standard-normal p-value. */
export function normalTwoSidedP(z) {
  if (Number.isNaN(z)) throw new RangeError('Invalid z');
  return Math.min(1, erfc(Math.abs(z) / Math.SQRT2));
}

const Z_975 = 1.959963984540054;

/**
 * Mann–Kendall monotonic trend test with tie-corrected variance and continuity
 * correction, plus the Theil–Sen slope and its rank-based 95% interval
 * (Sen 1968; Gilbert 1987 — same index convention as scipy.stats.theilslopes).
 * Like the classical OLS test, it assumes serially independent annual values.
 */
export function mannKendall(annual, minYears = 10) {
  const points = annual.filter(p => Number.isFinite(p.year) && Number.isFinite(p.value))
    .sort((a, b) => a.year - b.year);
  if (points.length < minYears || new Set(points.map(p => p.year)).size !== points.length) return null;
  const n = points.length;
  let s = 0;
  const slopes = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = points[j].value - points[i].value;
      s += d > 0 ? 1 : d < 0 ? -1 : 0;
      slopes.push(d / (points[j].year - points[i].year));
    }
  }
  const counts = new Map();
  for (const p of points) counts.set(p.value, (counts.get(p.value) || 0) + 1);
  let tieTerm = 0;
  for (const t of counts.values()) if (t > 1) tieTerm += t * (t - 1) * (2 * t + 5);
  const varS = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;
  const z = varS <= 0 ? 0 : s > 0 ? (s - 1) / Math.sqrt(varS) : s < 0 ? (s + 1) / Math.sqrt(varS) : 0;
  slopes.sort((a, b) => a - b);
  const m = slopes.length;
  const median = m % 2 ? slopes[(m - 1) / 2] : (slopes[m / 2 - 1] + slopes[m / 2]) / 2;
  const c = Z_975 * Math.sqrt(Math.max(0, varS));
  const lower = slopes[Math.max(Math.round((m - c) / 2) - 1, 0)];
  const upper = slopes[Math.min(Math.round((m + c) / 2), m - 1)];
  const pValue = normalTwoSidedP(z);
  return {
    n, s, varS, z, pValue, significant: pValue < 0.05,
    tau: s / (n * (n - 1) / 2),
    senSlopePerYear: median, senSlopePerDecade: median * 10,
    senCiLowPerDecade: lower * 10, senCiHighPerDecade: upper * 10,
    note: 'Mann–Kendall (normal approximation, tie and continuity corrected) and Theil–Sen slope; assumes serially independent values.'
  };
}

/** Lag-1 autocorrelation of a numeric sequence; null when undefined. */
export function lag1Autocorrelation(values) {
  const x = values.filter(Number.isFinite);
  if (x.length < 3) return null;
  const mean = x.reduce((s, v) => s + v, 0) / x.length;
  let num = 0, den = 0;
  for (let i = 0; i < x.length; i++) {
    den += (x[i] - mean) ** 2;
    if (i) num += (x[i] - mean) * (x[i - 1] - mean);
  }
  return den < 1e-20 ? null : num / den;
}

/**
 * Mean seasonal cycle from complete years only, so the baseline matches the
 * annual series. Months without complete-year support are null, not filled.
 */
export function monthlyClimatology(monthly) {
  const complete = new Set(annualMeans(monthly).map(row => row.year));
  const sums = Array.from({length: 12}, () => ({sum: 0, n: 0, values: []}));
  for (const p of monthly) {
    if (!complete.has(p.year) || !Number.isFinite(p.value)) continue;
    const bucket = sums[p.month - 1];
    bucket.sum += p.value; bucket.n += 1; bucket.values.push(p.value);
  }
  return sums.map((b, i) => {
    const mean = b.n ? b.sum / b.n : null;
    const sd = b.n > 1 ? Math.sqrt(b.values.reduce((s, v) => s + (v - mean) ** 2, 0) / (b.n - 1)) : null;
    return {month: i + 1, mean, sd, n: b.n};
  });
}

/**
 * Monthly anomalies relative to the series' own complete-year climatology.
 * `standardized` divides by that month's interannual standard deviation, making
 * series with different units or variability shape-comparable (unitless σ).
 */
export function monthlyAnomalies(monthly, {standardized = false} = {}) {
  const clim = monthlyClimatology(monthly);
  const out = [];
  for (const p of monthly) {
    const c = clim[p.month - 1];
    if (!Number.isFinite(p.value) || c.mean === null) continue;
    if (standardized && !(c.sd > 0)) continue;
    out.push({year: p.year, month: p.month, value: standardized ? (p.value - c.mean) / c.sd : p.value - c.mean});
  }
  return out;
}

/**
 * Calendar-month trends: OLS of each month's value against calendar year.
 * Twelve simultaneous tests — individual p-values are descriptive only.
 */
export function seasonalTrends(monthly, minYears = 10) {
  return Array.from({length: 12}, (_, i) => {
    const series = monthly.filter(p => p.month === i + 1 && Number.isFinite(p.value))
      .map(p => ({year: p.year, value: p.value}));
    const trend = linearTrend(series, minYears);
    return {month: i + 1, n: series.length, slopePerDecade: trend?.slopePerDecade ?? null,
      ciLowPerDecade: trend?.ciLowPerDecade ?? null, ciHighPerDecade: trend?.ciHighPerDecade ?? null,
      pValue: trend?.pValue ?? null};
  });
}

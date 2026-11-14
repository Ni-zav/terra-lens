import test from 'node:test';
import assert from 'node:assert/strict';
import {daysInMonth, annualMeans, linearTrend, regularizedBeta, studentTCritical95, studentTTwoSidedP} from '../src/stats.js';
import {requestURL, parseMonthly, fetchNASA} from '../src/power.js';

test('leap years and day-weighted annual averages', () => {
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2023, 2), 28);
  const monthly = Array.from({length: 12}, (_, index) =>
    ({year: 2024, month: index + 1, value: index === 1 ? 30 : 0}));
  monthly.push({year: 2025, month: 1, value: 100});
  const annual = annualMeans(monthly);
  assert.equal(annual.length, 1);
  assert.ok(Math.abs(annual[0].value - 30 * 29 / 366) < 1e-12);
});
test('OLS slope in elapsed calendar years, even with gaps', () => {
  const years = [2000, 2001, 2003, 2005, 2006, 2007, 2009, 2011, 2013, 2019];
  const trend = linearTrend(years.map(year => ({year, value: 0.3 * (year - 2000) + 5})));
  assert.ok(Math.abs(trend.slopePerDecade - 3) < 1e-10);
  assert.equal(trend.significant, true);
});
test('constant series is not significant', () => {
  const trend = linearTrend(Array.from({length: 20}, (_, index) => ({year: 2000 + index, value: 8})));
  assert.equal(trend.pValue, 1);
  assert.equal(trend.significant, false);
});
test('insufficient data shows no inferred trend', () => {
  assert.equal(linearTrend(Array.from({length: 9}, (_, index) => ({year: index, value: index}))), null);
  assert.equal(linearTrend(Array.from({length: 10}, (_, index) => ({year: 2000, value: index}))), null);
});
test('Student t reference quantile df=10 and beta symmetry', () => {
  assert.ok(Math.abs(studentTCritical95(10) - 2.2281388519649385) < 1e-6);
  assert.ok(Math.abs(studentTTwoSidedP(2.2281388519649385, 10) - 0.05) < 1e-6);
  assert.ok(Math.abs(regularizedBeta(0.5, 1, 1) - 0.5) < 1e-12);
});
test('confidence bounds span noisy slope', () => {
  const vals = [0, 1, -1, 1, 2, 1, 0, 2, 1, 3, 2, 4, 3, 5, 4, 3, 5, 6, 5, 7];
  const t = linearTrend(vals.map((v, i) => ({year: 2000 + i, value: v})));
  assert.ok(t.ciLowPerDecade < t.slopePerDecade && t.ciHighPerDecade > t.slopePerDecade);
  assert.ok(t.pValue >= 0 && t.pValue <= 1);
});
test('NASA monthly shape ignores fill values and synthetic annual month 13', () => {
  const data = {properties: {parameter: {T2M: {'202401': 25, '202402': -999,
    '202403': null, '202404': 27, '202413': 26, 'invalid': 90}}}};
  assert.deepEqual(parseMonthly(data, 'T2M').map(p => p.month), [1, 4]);
});
test('request validation uses allowlisted parameters and years', () => {
  const url = new URL(requestURL({lat: -7.8, lon: 110.37, start: 2001, end: 2024, variable: 'T2M'}));
  assert.equal(url.searchParams.get('parameters'), 'T2M');
  assert.throws(() => requestURL({lat: 91, lon: 0, start: 2001, end: 2024, variable: 'T2M'}), RangeError);
  assert.throws(() => requestURL({lat: 0, lon: 0, start: 2001, end: 2024, variable: 'INVALID'}), RangeError);
});
test('NASA request fails honestly if network fails', async () => {
  await assert.rejects(fetchNASA({lat:0, lon:0, start: 2001, end: 2020, variable:'T2M'}, {
    fetcher: async () => { throw new Error('network offline'); }
  }), /network offline/);
});

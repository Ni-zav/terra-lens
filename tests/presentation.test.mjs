import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeSeries, compareSeries, SUPPORT} from '../src/series.js';
import {archivedPowerSeries, CASE_SHA256} from '../src/presentation/yogyakarta.js';
import {comparisonFinding, evidenceState, seriesFinding} from '../src/presentation/findings.js';
import {axisPlan} from '../src/react/chart-model.js';
import {messages, trendSentence} from '../src/presentation/locale.js';
import {evidencePayload} from '../src/presentation/download.js';

const bytes = name => readFileSync(new URL(`../data/source-snapshots/power-2001-2024/power-${name}.json`, import.meta.url));
const sources = ['yogyakarta', 'jakarta'].map(bytes);
const archive = sources.map((raw, index) => archivedPowerSeries(JSON.parse(raw), index));
const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} vs ${expected}`);
const pairOf = (a, b, options) => comparisonFinding(compareSeries(a, b), a, b, options);

// All generated observations in these helpers are test fixtures only.
function series(values, {id='A', support=SUPPORT.GRID_POINT, code='POWER:T2M', unit='°C', sources=['MERRA2'], kind='nasa-power'} = {}) {
  return makeSeries({id, support, variable:{code, unit}, provenance:{kind, metadata:{sources}},
    monthly:values.flatMap((value, i) => value === null ? [] : Array.from({length:12}, (_, m) => ({year:2001+i, month:m+1, value})))});
}
const years = Array.from({length:24}, (_, i) => i);

test('original SciPy run records, signed slopes, paired inference and deterministic bilingual formatting', () => {
  assert.deepEqual(sources.map(raw => createHash('sha256').update(raw).digest('hex')), CASE_SHA256);
  const [a, b] = archive.map(seriesFinding);
  near(a.value, .17914128107740343);
  near(b.value, .22383488773241814);
  assert.equal(a.retrievedAt, null);
  assert.equal(a.sourceMode, 'snapshot');
  assert.equal(a.coverage.completeYears, 24);
  assert.equal(a.coverage.months, 288);
  assert.equal(a.period.start, 2001);
  assert.equal(a.period.end, 2024);
  assert.equal(a.findingStatus, 'supported-trend');
  const pair = pairOf(...archive);
  assert.equal(pair.findingStatus, 'difference-not-established');
  near(pair.value, .044693606655014706);
  near(pair.evidenceStrength.confidenceInterval[0], -.0574159907661939);
  near(pair.evidenceStrength.confidenceInterval[1], .1468032040762233);
  near(pair.evidenceStrength.p, .3738526026809307);
  const generatedAt = '2026-11-22T00:00:00Z';
  const before = evidencePayload(archive, undefined, generatedAt);
  assert.match(trendSentence(a, 'Air temperature', 'en'), /\+0\.179 °C per decade.*grid point/);
  assert.match(trendSentence(a, 'Air temperature', 'id'), /\+0,179 °C per dekade.*titik grid model/);
  assert.deepEqual(evidencePayload(archive, undefined, generatedAt), before);
  assert.equal(evidenceState({state:'success', finding:a}), 'dated-snapshot');
});

test('weak, mixed, contradictory and insufficient evidence are separate states', () => {
  const flat = series(years.map(i => i % 2));
  assert.equal(seriesFinding(flat).findingStatus, 'not-detected');
  const mixed = series(years.map(i => i === 23 ? 70 : i * .1));
  // An influential last-year value with otherwise flat observations can make tests disagree.
  const last = series(years.map(i => i === 23 ? 70 : i % 3));
  const order = [-1000, ...years.slice(1,23).map(i => 24-i), 1000];
  const contradiction = series(order);
  assert.equal(seriesFinding(mixed).findingStatus, 'mixed-evidence');
  assert.equal(seriesFinding(last).findingStatus, 'not-detected');
  const c = seriesFinding(contradiction);
  assert.equal(c.findingStatus, 'mixed-evidence');
  assert.equal(c.direction, 1);
  assert.equal(c.evidenceStrength.rankDirection, -1);
  const small = seriesFinding(series(years.slice(0,9)));
  assert.equal(small.findingStatus, 'insufficient');
  assert.equal(small.value, null);
  const negative = seriesFinding(series(years.map(i => 8-i*.08), {code:'POWER:PRECTOTCORR',unit:'mm/day'}));
  assert.match(trendSentence(negative, 'Precipitation rate', 'id'), /-0,8 mm\/day/);
});

test('paired matching gates on physical support, NASA product and complete shared years', () => {
  const a = series(years);
  const b = series(years.map(i => 2*i), {id:'B'});
  assert.equal(pairOf(a, b).findingStatus, 'difference-supported');
  assert.equal(pairOf(a, b, {postSelected:true}).findingStatus, 'exploratory-selected');
  assert.equal(pairOf(a, series(years.map(i => i === 9 ? null : i))).findingStatus, 'unavailable-inference');
  assert.equal(pairOf(a, series(years.slice(0,9))).findingStatus, 'insufficient');
  for (const options of [{support:SUPPORT.UNKNOWN}, {support:SUPPORT.AREA_AVERAGE}, {unit:'K'},
    {code:'POWER:RH2M'}, {kind:'giovanni-import'}, {sources:['GEOS-IT']}]) {
    const incompatible = series(years, {id:'G', ...options});
    assert.equal(pairOf(a, incompatible).findingStatus, 'incompatible');
    assert.deepEqual(axisPlan([a,incompatible], 'anomaly').drawn.map(s => s.id), ['A']);
  }
});

test('status announcements in both languages distinguish stale, missing, loading and source failure', () => {
  const a = seriesFinding(archive[0]);
  assert.equal(evidenceState({state:'success',finding:a,dirty:true}), 'stale-query');
  assert.equal(evidenceState({state:'loading'}), 'loading');
  assert.equal(evidenceState({state:'error',finding:a}), 'request-failed');
  assert.equal(evidenceState({state:'success'}), 'unavailable-inference');
  assert.deepEqual(Object.keys(messages.id.statuses), Object.keys(messages.en.statuses));
});

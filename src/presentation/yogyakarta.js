import {parseMonthly, powerSeries, requestURL} from '../power.js';

export const CASE_PERIOD = Object.freeze({start: 2001, end: 2024});
export const CASE_POINTS = Object.freeze([
  {id: 'A', label: 'Yogyakarta', lat: -7.7956, lon: 110.3695, color: '#2563eb'},
  {id: 'B', label: 'Jakarta', lat: -6.2088, lon: 106.8456, color: '#ea580c'}
].map(Object.freeze));
export const CASE_RUN = 'https://github.com/Ni-zav/terra-lens/actions/runs/43579062738';
export const CASE_CAPTURE = '2026-11-14T09:08:01.710049Z';
export const CASE_SHA256 = Object.freeze([
  'f41ca1614cf6d7906fe75ef0dd3dc60df0d48da091d404a8a73e7e7b16f2eadc',
  '59ab1b420c356eab89340deb7d6398e72afcac054c05715b7dccce480e710865'
]);
export const METHODS_URL = 'https://github.com/Ni-zav/terra-lens/blob/662a33a8d9b34cd691e43c80572f73dbea004784/docs/METHODOLOGY.md';
export const BMKG_URL = 'https://staklim-yogya.bmkg.go.id/portal-pelayanan-data/';

export function archivedPowerSeries(payload, index) {
  const point = CASE_POINTS[index];
  const request = {...CASE_PERIOD, ...point, variable: 'T2M'};
  return powerSeries({
    monthly: parseMonthly(payload, 'T2M', CASE_PERIOD),
    url: requestURL(request), fetchedAt: null, capturedAt: CASE_CAPTURE,
    source: 'NASA POWER / MERRA-2', sourceMode: 'snapshot',
    metadata: payload.header, parameterMetadata: payload.parameters?.T2M, coordinate: payload.geometry?.coordinates, requestedPeriod: CASE_PERIOD,
    archive: {run: CASE_RUN, sha256: CASE_SHA256[index]}
  }, request);
}

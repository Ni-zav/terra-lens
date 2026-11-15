import {linearTrend} from '../stats.js';

// This parser is only for NASA's published, already seasonal tutorial table.
// It must not be passed through the monthly-series importer or day-weighted.
export function analyzeGiovanniTutorial(text) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  if (lines.shift() !== 'Year,Canada,United_States') throw new Error('Unexpected NASA tutorial CSV header');
  const seen = new Set();
  const rows = lines.map(line => {
    const fields = line.split(',');
    if (fields.length !== 3 || !/^\d{4}$/.test(fields[0]) ||
        !/^\d+$/.test(fields[1]) || !/^\d+$/.test(fields[2])) throw new Error('Invalid tutorial data row');
    const year = Number(fields[0]);
    if (seen.has(year)) throw new Error('Duplicate tutorial year');
    seen.add(year);
    return {year, canada: Number(fields[1]), unitedStates: Number(fields[2])};
  }).sort((a,b) => a.year-b.year);
  if (rows.length !== 44 || rows.some((r,i) => r.year !== 1980+i)) throw new Error('Unexpected tutorial coverage');
  const canada = linearTrend(rows.map(r => ({year:r.year,value:r.canada})));
  const unitedStates = linearTrend(rows.map(r => ({year:r.year,value:r.unitedStates})));
  return {rows, canada, unitedStates};
}

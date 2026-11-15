import {annualMeans, linearTrend} from '../stats.js';

// Giovanni classic area-averaged CSV (not the separate Giovanni Cloud format).
export function parseGiovanniAreaCSV(text) {
  if (typeof text !== 'string' || text.length > 12000000) throw Error('Invalid Giovanni CSV');
  const lines = text.split(/\r?\n/);
  const fillLine = lines.find(x => x.startsWith('Fill Value (mean_M2TMNXSLV_5_12_4_T2M):,'));
  const header = lines.findIndex(x => /^time,\s*mean_M2TMNXSLV_5_12_4_T2M\s*$/.test(x));
  if (!fillLine || header < 0 || !text.includes('Time Series, Area-Averaged of 2-meter air temperature')) throw Error('Unexpected Giovanni area-average format');
  const fill = Number(fillLine.split(',')[1]);
  if (!Number.isFinite(fill)) throw Error('Invalid fill value');
  const seen = new Set(), monthly = [];
  for (const line of lines.slice(header + 1)) {
    if (!line.trim()) continue;
    const m = /^(\d{4})-(\d{2})-01 00:00:00,\s*([^,]+)\s*$/.exec(line);
    if (!m) throw Error('Invalid monthly row');
    const year=+m[1], month=+m[2], value=Number(m[3]), key=m[1]+m[2];
    if (month<1 || month>12 || seen.has(key) || !Number.isFinite(value)) throw Error('Invalid or duplicate observation');
    seen.add(key);
    if (value===fill) continue;
    if (value<150 || value>350) throw Error('Unexpected 2 m temperature');
    monthly.push({year,month,value,date:key});
  }
  return monthly.sort((a,b)=>a.year-b.year || a.month-b.month);
}
export function analyzeGiovanniArea(text) {
  const monthly=parseGiovanniAreaCSV(text), annual=annualMeans(monthly), trend=linearTrend(annual);
  if (!trend) throw Error('At least ten complete years are required');
  return {monthly,annual,trend};
}

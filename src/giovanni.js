/**
 * Import monthly CSV downloaded from NASA Giovanni / Giovanni in the Cloud.
 * Rejects multiple observations per month: hourly/daily aggregation requires
 * a separate, source-specific scientific method.
 * This cannot authenticate a local file: keep NASA URL and original checksum.
 */
export function parseGiovanniMonthlyCSV(text) {
  if (typeof text !== 'string' || text.length > 12_000_000) throw new Error('Invalid CSV or file exceeds 12 MB.');
  const metadata = {};
  const rows = [];
  const seen = new Set();
  for (const original of text.replace(/^\uFEFF/,'').split(/\r?\n/)) {
    const line = original.trim();
    if (!line || line.startsWith('#')) continue;
    const comma = line.indexOf(',');
    if (comma < 1) continue;
    const key = line.slice(0,comma).trim().replace(/^"|"$/g,'');
    const raw = line.slice(comma+1).trim().replace(/^"|"$/g,'');
    if (/^[A-Za-z][\w-]*$/.test(key) && !['time','timestamp','date'].includes(key.toLowerCase())) {
      if (!rows.length) metadata[key.toLowerCase()] = raw;
      continue;
    }
    if (!/^\d{4}-\d{2}(?:-\d{2})?(?:T.*)?$/.test(key)) continue;
    const year=Number(key.slice(0,4)), month=Number(key.slice(5,7));
    if (month<1 || month>12 || year<1850 || year>2100) throw new Error('Invalid monthly timestamp.');
    const date=key.slice(0,4)+key.slice(5,7);
    if (seen.has(date)) throw new Error('Multiple samples per month: use a monthly Giovanni time series, not daily or 3-hourly data.');
    seen.add(date);
    const value=raw===''?NaN:Number(raw);
    if (!Number.isFinite(value)||value<=-990) continue;
    rows.push({year,month,value,date});
  }
  if (!metadata.param_name || !metadata.unit) throw new Error('Giovanni CSV metadata must include param_name and unit. This importer does not accept unlabeled CSV.');
  rows.sort((a,b)=>a.year-b.year||a.month-b.month);
  if (!rows.length) throw new Error('No valid monthly measurements found in source CSV.');
  return {metadata,monthly:rows};
}

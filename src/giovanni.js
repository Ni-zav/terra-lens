import {makeSeries, SUPPORT} from './series.js';
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
    if (/^[A-Za-z_][\w-]*$/.test(key) && !['time','timestamp','date'].includes(key.toLowerCase())) {
      if (!rows.length) metadata[key.toLowerCase()] = raw;
      continue;
    }
    // NASA's Giovanni in the Cloud CSV examples use "YYYY-MM-DD HH:mm:ss"
    // timestamps (a space, not a T). Do not silently discard every data row.
    if (!/^\d{4}-\d{2}(?:-\d{2})?(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z)?)?$/.test(key)) continue;
    const year=Number(key.slice(0,4)), month=Number(key.slice(5,7));
    if (month<1 || month>12 || year<1850 || year>2100) throw new Error('Invalid monthly timestamp.');
    if (key.length>=10) {
      const day=Number(key.slice(8,10));
      const daysInMonth=new Date(Date.UTC(year,month,0)).getUTCDate();
      if(day<1 || day>daysInMonth) throw new Error('Invalid calendar date in monthly CSV.');
    }
    const date=key.slice(0,4)+key.slice(5,7);
    if (seen.has(date)) throw new Error('Multiple samples per month: use a monthly Giovanni time series, not daily or 3-hourly data.');
    seen.add(date);
    const value=raw===''?NaN:Number(raw);
    // Declared source sentinels are product-specific: a large positive fill
    // is possible, and a blanket threshold can discard valid negative data.
    const declared = ['_fillvalue', 'fillvalue', 'fill_value', 'missing_value']
      .filter(name => Object.hasOwn(metadata, name))
      .map(name => {
        const value = Number(metadata[name]);
        if (metadata[name].trim() === '' || !Number.isFinite(value)) throw new Error(`Invalid ${name} metadata.`);
        return value;
      });
    if (!Number.isFinite(value) || declared.includes(value) || (!declared.length && value === -999)) continue;
    rows.push({year,month,value,date});
  }
  if (!metadata.param_name || !metadata.unit) throw new Error('Giovanni CSV metadata must include param_name and unit. This importer does not accept unlabeled CSV.');
  rows.sort((a,b)=>a.year-b.year||a.month-b.month);
  if (!rows.length) throw new Error('No valid monthly measurements found in source CSV.');
  return {metadata,monthly:rows};
}

/**
 * Adapter: an imported Giovanni CSV becomes a canonical Series. NASA Giovanni
 * supports distinct spatial products: point-service output with lat/lon is a
 * grid-point sample, while area-average exports must explicitly say so.
 * Absent sufficient metadata, do not guess the spatial support.
 */
export function giovanniSeries(parsed, {id = 'G', color = '#e79bc0', fileName, sha256, product, doi, sourceURL} = {}) {
  const md = parsed.metadata;
  const hasCoordinates = md.lat !== undefined && md.lon !== undefined &&
    md.lat !== '' && md.lon !== '';
  const lat = Number(md.lat), lon = Number(md.lon);
  const isPoint = hasCoordinates && Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  // Labels describe the spatial support, not whether the imported source
  // resembles an unrelated POWER model grid cell.
  const support = isPoint ? SUPPORT.GRID_POINT : SUPPORT.UNKNOWN;
  return makeSeries({
    id, color, monthly: parsed.monthly, support,
    label: product ? `${product} (Giovanni)` : `${md.param_name} (Giovanni)`,
    geo: isPoint ? {lat, lon} : null,
    variable: {code: 'GIOVANNI:' + md.param_name, label: md.param_name, unit: md.unit},
    provenance: {kind: 'giovanni-import', fileName, sha256, product: product || null, doi: doi || null,
      url: sourceURL || null, metadata: md, authenticated: false,
      warning: 'User-supplied file; provenance and source quality are not independently authenticated. Check product-specific missing-value markers; declared numeric fill/missing values are excluded, or -999 when none is declared.'}
  });
}

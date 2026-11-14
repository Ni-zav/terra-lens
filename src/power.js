/** NASA POWER monthly point adapter. Missing values are excluded, never substituted. */
export const VARIABLES = Object.freeze({
  T2M: { label: 'Air temperature', description: 'Near-surface mean air temperature at 2 meters (monthly mean).', unit: '°C' },
  T2M_MAX: { label: 'Daily maximum temperature', description: 'Monthly average of the daily maximum 2 m temperature; not the single highest day.', unit: '°C' },
  T2M_MIN: { label: 'Daily minimum temperature', description: 'Monthly average of the daily minimum 2 m temperature; not the single lowest day.', unit: '°C' },
  T2MDEW: { label: 'Dew point temperature', description: 'Monthly mean near-surface dew/frost point at 2 meters.', unit: '°C' },
  RH2M: { label: 'Relative humidity', description: 'Near-surface relative humidity at 2 meters.', unit: '%' },
  QV2M: { label: 'Specific humidity', description: 'Near-surface specific humidity at 2 meters.', unit: 'g/kg' },
  WS2M: { label: 'Wind speed', description: 'Monthly mean wind speed at 2 meters.', unit: 'm/s' },
  PS: { label: 'Surface pressure', description: 'Monthly mean surface atmospheric pressure.', unit: 'kPa' },
  PRECTOTCORR: { label: 'Precipitation rate', description: 'Mean daily precipitation rate, not monthly rainfall total.', unit: 'mm/day' }
});
export const LOCATIONS = Object.freeze({
  Yogyakarta: [-7.7956, 110.3695],
  Jakarta: [-6.2088, 106.8456],
  Singapore: [1.3521, 103.8198],
  Tokyo: [35.6762, 139.6503],
  Nairobi: [-1.2921, 36.8219],
  London: [51.5072, -0.1276],
  Reykjavik: [64.1466, -21.9426],
  'New Delhi': [28.6139, 77.209],
  Sydney: [-33.8688, 151.2093],
  Manaus: [-3.119, -60.0217]
});
export const NASA_ENDPOINT = 'https://power.larc.nasa.gov/api/temporal/monthly/point';

export function requestURL({lat, lon, variable, start, end}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
      lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new RangeError('Invalid coordinates');
  if (!Object.hasOwn(VARIABLES, variable)) throw new RangeError('Unknown variable');
  if (!Number.isInteger(start) || !Number.isInteger(end) ||
      start < 1981 || end > 2025 || start > end) throw new RangeError('Select valid calendar years from 1981 to 2025');
  const params = new URLSearchParams({
    parameters: variable, community: 'AG', longitude: String(lon), latitude: String(lat),
    start: String(start), end: String(end), format: 'JSON'
  });
  return NASA_ENDPOINT + '?' + params.toString();
}

export function parseMonthly(json, variable, {start = 1981, end = 2025} = {}) {
  const dictionary = json?.properties?.parameter?.[variable];
  if (!dictionary || typeof dictionary !== 'object' || Array.isArray(dictionary)) throw new Error('NASA response does not contain the requested variable.');
  const rows = [];
  for (const [key, raw] of Object.entries(dictionary)) {
    if (!/^\d{6}$/.test(key)) continue;
    const year = Number(key.slice(0, 4)), month = Number(key.slice(4, 6));
    const value = (typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '')) ? Number(raw) : NaN;
    if (year < start || year > end || month < 1 || month > 12 || !Number.isFinite(value) || value <= -990) continue;
    rows.push({ year, month, value, date: key });
  }
  rows.sort((a, b) => a.year - b.year || a.month - b.month);
  return rows.filter((row, index) => index === 0 || row.date !== rows[index - 1].date);
}

export async function fetchNASA(options, {fetcher = fetch, signal} = {}) {
  const nasaUrl = requestURL(options);
  const proxyUrl = '/api/power?' + nasaUrl.split('?')[1];
  let response;
  try {
    response = await fetcher(proxyUrl, {signal});
    if (!response.ok || !response.headers.get('content-type')?.includes('json')) {
      response = await fetcher(nasaUrl, {signal});
    }
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    response = await fetcher(nasaUrl, {signal});
  }
  if (!response.ok) throw new Error('NASA POWER request failed (HTTP ' + response.status + '). Please try again.');
  const payload = await response.json();
  const monthly = parseMonthly(payload, options.variable, options);
  if (!monthly.length) throw new Error('NASA returned no valid observations for this location and range.');
  return {
    monthly, url: nasaUrl, fetchedAt: new Date().toISOString(),
    source: 'NASA POWER / MERRA-2-derived meteorological reanalysis',
    metadata: payload.header || {}, coordinate: payload.geometry?.coordinates
  };
}

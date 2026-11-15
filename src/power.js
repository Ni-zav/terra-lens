/** NASA POWER monthly point adapter. Missing values are excluded, never substituted. */
import {makeSeries, SUPPORT} from './series.js';
export const VARIABLES = Object.freeze({
  T2M: { label: 'Air temperature', description: 'Near-surface mean air temperature at 2 meters (monthly mean).', unit: '°C' },
  T2M_MAX: { label: 'Monthly maximum temperature', description: 'Highest modeled hourly 2 m temperature in each month. Annual values are day-weighted averages of monthly maxima, not annual maxima.', unit: '°C' },
  T2M_MIN: { label: 'Monthly minimum temperature', description: 'Lowest modeled hourly 2 m temperature in each month. Annual values are day-weighted averages of monthly minima, not annual minima.', unit: '°C' },
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
  Manaus: [-3.119, -60.0217],
  Cairo: [30.0444, 31.2357],
  'New York': [40.7128, -74.006],
  'Sao Paulo': [-23.5505, -46.6333],
  Zurich: [47.3769, 8.5417]
});

const WORLD_CITIES = [
  ...Object.entries(LOCATIONS).map(([name, [lat, lon]]) => [name, lat, lon]),
  // Indonesia & Maritime SE Asia
  ['Bandung', -6.9175, 107.6191], ['Semarang', -6.9667, 110.4167], ['Surabaya', -7.2575, 112.7521],
  ['Denpasar', -8.6705, 115.2126], ['Mataram', -8.5833, 116.1167], ['Kupang', -10.1772, 123.607],
  ['Medan', 3.5952, 98.6722], ['Padang', -0.9471, 100.4172], ['Palembang', -2.9761, 104.7754],
  ['Pontianak', -0.0263, 109.3425], ['Balikpapan', -1.2379, 116.8529], ['Banjarmasin', -3.3194, 114.5908],
  ['Makassar', -5.1477, 119.4327], ['Manado', 1.4748, 124.8421], ['Ambon', -3.6954, 128.1814],
  ['Jayapura', -2.5337, 140.7181], ['Merauke', -8.4932, 140.4018], ['Banda Aceh', 5.5483, 95.3238],
  ['Kuala Lumpur', 3.139, 101.6869], ['George Town', 5.4141, 100.3288], ['Kuching', 1.5533, 110.3592],
  ['Kota Kinabalu', 5.9804, 116.0735], ['Brunei', 4.9031, 114.9398], ['Manila', 14.5995, 120.9842],
  ['Cebu', 10.3157, 123.8854], ['Davao', 7.1907, 125.4553], ['Dili', -8.5569, 125.5603],
  ['Port Moresby', -9.4438, 147.1803],
  // Mainland SE Asia & East Asia
  ['Bangkok', 13.7563, 100.5018], ['Chiang Mai', 18.7883, 98.9853], ['Phuket', 7.8804, 98.3923],
  ['Ho Chi Minh City', 10.8231, 106.6297], ['Hanoi', 21.0285, 105.8542], ['Da Nang', 16.0544, 108.2022],
  ['Phnom Penh', 11.5564, 104.9282], ['Vientiane', 17.9757, 102.6331], ['Yangon', 16.8409, 96.1735],
  ['Mandalay', 21.9588, 96.0891], ['Taipei', 25.033, 121.5654], ['Kaohsiung', 22.6273, 120.3014],
  ['Hong Kong', 22.3193, 114.1694], ['Guangzhou', 23.1291, 113.2644], ['Shenzhen', 22.5431, 114.0579],
  ['Shanghai', 31.2304, 121.4737], ['Beijing', 39.9042, 116.4074], ['Tianjin', 39.3434, 117.3616],
  ['Chongqing', 29.4316, 106.9123], ['Chengdu', 30.5728, 104.0668], ['Wuhan', 30.5928, 114.3055],
  ['Xian', 34.3416, 108.9398], ['Kunming', 25.0389, 102.7183], ['Lhasa', 29.65, 91.1],
  ['Urumqi', 43.8256, 87.6168], ['Harbin', 45.8038, 126.5349], ['Shenyang', 41.8057, 123.4315],
  ['Seoul', 37.5665, 126.978], ['Busan', 35.1796, 129.0756], ['Pyongyang', 39.0392, 125.7625],
  ['Osaka', 34.6937, 135.5023], ['Fukuoka', 33.5902, 130.4017], ['Sapporo', 43.0618, 141.3545],
  ['Naha', 26.2124, 127.6809], ['Ulaanbaatar', 47.8864, 106.9057],
  // South, Central & West Asia
  ['Mumbai', 19.076, 72.8777], ['Bengaluru', 12.9716, 77.5946], ['Chennai', 13.0827, 80.2707],
  ['Hyderabad', 17.385, 78.4867], ['Kolkata', 22.5726, 88.3639], ['Ahmedabad', 23.0225, 72.5714],
  ['Jaipur', 26.9124, 75.7873], ['Lucknow', 26.8467, 80.9462], ['Srinagar', 34.0837, 74.7973],
  ['Colombo', 6.9271, 79.8612], ['Dhaka', 23.8103, 90.4125], ['Chittagong', 22.3569, 91.7832],
  ['Kathmandu', 27.7172, 85.324], ['Thimphu', 27.4728, 89.639], ['Karachi', 24.8607, 67.0011],
  ['Lahore', 31.5204, 74.3587], ['Islamabad', 33.6844, 73.0479], ['Kabul', 34.5553, 69.2075],
  ['Tashkent', 41.2995, 69.2401], ['Almaty', 43.222, 76.8512], ['Astana', 51.1694, 71.4491],
  ['Bishkek', 42.8746, 74.5698], ['Dushanbe', 38.5598, 68.787], ['Ashgabat', 37.9601, 58.3261],
  ['Tehran', 35.6892, 51.389], ['Isfahan', 32.6546, 51.668], ['Shiraz', 29.5918, 52.5837],
  ['Baghdad', 33.3152, 44.3661], ['Kuwait City', 29.3759, 47.9774], ['Riyadh', 24.7136, 46.6753],
  ['Jeddah', 21.4858, 39.1925], ['Dubai', 25.2048, 55.2708], ['Abu Dhabi', 24.4539, 54.3773],
  ['Muscat', 23.588, 58.3829], ['Doha', 25.2854, 51.531], ['Sanaa', 15.3694, 44.191],
  ['Amman', 31.9454, 35.9284], ['Beirut', 33.8938, 35.5018], ['Damascus', 33.5138, 36.2765],
  ['Jerusalem', 31.7683, 35.2137], ['Ankara', 39.9334, 32.8597], ['Istanbul', 41.0082, 28.9784],
  ['Izmir', 38.4237, 27.1428], ['Tbilisi', 41.7151, 44.8271], ['Baku', 40.4093, 49.8671],
  ['Yerevan', 40.1792, 44.4991],
  // Russia & Northern Eurasia
  ['Moscow', 55.7558, 37.6173], ['Saint Petersburg', 59.9343, 30.3351], ['Murmansk', 68.9585, 33.0827],
  ['Kazan', 55.7961, 49.1064], ['Yekaterinburg', 56.8389, 60.6057], ['Novosibirsk', 55.0084, 82.9357],
  ['Krasnoyarsk', 56.0153, 92.8932], ['Irkutsk', 52.287, 104.305], ['Yakutsk', 62.0355, 129.6755],
  ['Vladivostok', 43.1155, 131.8855], ['Petropavlovsk', 53.0245, 158.6436], ['Norilsk', 69.3558, 88.1893],
  // Europe
  ['Dublin', 53.3498, -6.2603], ['Edinburgh', 55.9533, -3.1883], ['Paris', 48.8566, 2.3522],
  ['Marseille', 43.2965, 5.3698], ['Lyon', 45.764, 4.8357], ['Madrid', 40.4168, -3.7038],
  ['Barcelona', 41.3874, 2.1686], ['Lisbon', 38.7223, -9.1393], ['Brussels', 50.8503, 4.3517],
  ['Amsterdam', 52.3676, 4.9041], ['Berlin', 52.52, 13.405], ['Munich', 48.1351, 11.582],
  ['Frankfurt', 50.1109, 8.6821], ['Hamburg', 53.5511, 9.9937], ['Vienna', 48.2082, 16.3738],
  ['Prague', 50.0755, 14.4378], ['Warsaw', 52.2297, 21.0122], ['Budapest', 47.4979, 19.0402],
  ['Rome', 41.9028, 12.4964], ['Milan', 45.4642, 9.19], ['Naples', 40.8518, 14.2681],
  ['Athens', 37.9838, 23.7275], ['Sofia', 42.6977, 23.3219], ['Bucharest', 44.4268, 26.1025],
  ['Belgrade', 44.7866, 20.4489], ['Zagreb', 45.815, 15.9819], ['Kyiv', 50.4501, 30.5234],
  ['Odesa', 46.4825, 30.7233], ['Minsk', 53.9006, 27.559], ['Vilnius', 54.6872, 25.2797],
  ['Riga', 56.9496, 24.1052], ['Tallinn', 59.437, 24.7536], ['Helsinki', 60.1699, 24.9384],
  ['Stockholm', 59.3293, 18.0686], ['Oslo', 59.9139, 10.7522], ['Copenhagen', 55.6761, 12.5683],
  ['Tromso', 69.6492, 18.9553], ['Longyearbyen', 78.2232, 15.6267],
  // Africa
  ['Alexandria', 31.2001, 29.9187], ['Aswan', 24.0889, 32.8998], ['Tripoli', 32.8872, 13.1913],
  ['Tunis', 36.8065, 10.1815], ['Algiers', 36.7538, 3.0588], ['Casablanca', 33.5731, -7.5898],
  ['Marrakesh', 31.6295, -7.9811], ['Dakar', 14.7167, -17.4677], ['Bamako', 12.6392, -8.0029],
  ['Niamey', 13.5116, 2.1254], ['Ndjamena', 12.1348, 15.0557], ['Khartoum', 15.5007, 32.5599],
  ['Addis Ababa', 9.032, 38.7469], ['Mogadishu', 2.0469, 45.3182], ['Accra', 5.6037, -0.187],
  ['Abidjan', 5.36, -4.0083], ['Lagos', 6.5244, 3.3792], ['Abuja', 9.0765, 7.3986],
  ['Douala', 4.0511, 9.7679], ['Kinshasa', -4.4419, 15.2663], ['Luanda', -8.839, 13.2894],
  ['Kampala', 0.3476, 32.5825], ['Kigali', -1.9441, 30.0619], ['Dar es Salaam', -6.7924, 39.2083],
  ['Lusaka', -15.3875, 28.3228], ['Harare', -17.8252, 31.0335], ['Maputo', -25.9692, 32.5732],
  ['Antananarivo', -18.8792, 47.5079], ['Windhoek', -22.5609, 17.0658], ['Gaborone', -24.6282, 25.9231],
  ['Johannesburg', -26.2041, 28.0473], ['Cape Town', -33.9249, 18.4241], ['Durban', -29.8587, 31.0218],
  // Oceania & Pacific
  ['Perth', -31.9505, 115.8605], ['Darwin', -12.4634, 130.8456], ['Alice Springs', -23.698, 133.8807],
  ['Adelaide', -34.9285, 138.6007], ['Melbourne', -37.8136, 144.9631], ['Hobart', -42.8821, 147.3272],
  ['Brisbane', -27.4705, 153.026], ['Cairns', -16.9186, 145.7781], ['Auckland', -36.8485, 174.7633],
  ['Wellington', -41.2865, 174.7762], ['Christchurch', -43.5321, 172.6362], ['Suva', -18.1416, 178.4419],
  ['Noumea', -22.2758, 166.458], ['Port Vila', -17.7333, 168.3273], ['Apia', -13.8333, -171.75],
  ['Papeete', -17.5516, -149.5585], ['Honolulu', 21.3069, -157.8583], ['Guam', 13.4443, 144.7937],
  // North & Central America
  ['Anchorage', 61.2181, -149.9003], ['Fairbanks', 64.8378, -147.7164], ['Utqiagvik', 71.2906, -156.7886],
  ['Vancouver', 49.2827, -123.1207], ['Calgary', 51.0447, -114.0719], ['Edmonton', 53.5461, -113.4938],
  ['Winnipeg', 49.8951, -97.1384], ['Toronto', 43.6532, -79.3832], ['Montreal', 45.5017, -73.5673],
  ['Halifax', 44.6488, -63.5752], ['Yellowknife', 62.454, -114.3718], ['Iqaluit', 63.7467, -68.517],
  ['Nuuk', 64.1814, -51.6941], ['Seattle', 47.6062, -122.3321], ['Portland', 45.5152, -122.6784],
  ['San Francisco', 37.7749, -122.4194], ['Los Angeles', 34.0522, -118.2437], ['Phoenix', 33.4484, -112.074],
  ['Salt Lake City', 40.7608, -111.891], ['Denver', 39.7392, -104.9903], ['Dallas', 32.7767, -96.797],
  ['Houston', 29.7604, -95.3698], ['Minneapolis', 44.9778, -93.265], ['Chicago', 41.8781, -87.6298],
  ['Detroit', 42.3314, -83.0458], ['St. Louis', 38.627, -90.1994], ['Atlanta', 33.749, -84.388],
  ['Miami', 25.7617, -80.1918], ['Washington', 38.9072, -77.0369], ['Boston', 42.3601, -71.0589],
  ['Monterrey', 25.6866, -100.3161], ['Guadalajara', 20.6597, -103.3496], ['Mexico City', 19.4326, -99.1332],
  ['Merida', 20.9674, -89.5926], ['Havana', 23.1136, -82.3666], ['Kingston', 17.9714, -76.7936],
  ['San Juan', 18.4655, -66.1057], ['Guatemala City', 14.6349, -90.5069], ['San Jose', 9.9281, -84.0907],
  ['Panama City', 8.9824, -79.5199],
  // South America & Antarctica
  ['Bogota', 4.711, -74.0721], ['Medellin', 6.2442, -75.5812], ['Caracas', 10.4806, -66.9036],
  ['Georgetown', 6.8013, -58.1551], ['Quito', -0.1807, -78.4678], ['Guayaquil', -2.1894, -79.8891],
  ['Lima', -12.0464, -77.0428], ['Cusco', -13.532, -71.9675], ['La Paz', -16.4897, -68.1193],
  ['Santa Cruz', -17.7833, -63.1821], ['Belem', -1.4558, -48.4902], ['Fortaleza', -3.7319, -38.5267],
  ['Recife', -8.0476, -34.877], ['Salvador', -12.9714, -38.5014], ['Brasilia', -15.7975, -47.8919],
  ['Rio de Janeiro', -22.9068, -43.1729], ['Porto Alegre', -30.0346, -51.2177], ['Cuiaba', -15.6014, -56.0979],
  ['Asuncion', -25.2637, -57.5759], ['Montevideo', -34.9011, -56.1645], ['Buenos Aires', -34.6037, -58.3816],
  ['Cordoba', -31.4201, -64.1888], ['Mendoza', -32.8895, -68.8458], ['Santiago', -33.4489, -70.6693],
  ['Antofagasta', -23.6509, -70.3975], ['Puerto Montt', -41.4689, -72.9411], ['Punta Arenas', -53.1638, -70.9171],
  ['Ushuaia', -54.8019, -68.303], ['McMurdo Station', -77.8419, 166.6863], ['Amundsen-Scott', -90, 0]
];

const BROAD_REGIONS = [
  ['Java Sea', -5.5, 112], ['South China Sea', 12, 114], ['Bay of Bengal', 14, 88],
  ['Arabian Sea', 15, 65], ['Mediterranean Sea', 35, 18], ['Caribbean Sea', 15, -75],
  ['Coral Sea', -18, 155], ['Tasman Sea', -38, 160], ['Bering Sea', 58, -175],
  ['Central Sahara', 23, 13], ['Western Sahara', 24, -13], ['Congo Basin', -1, 21],
  ['Kalahari', -23, 21], ['Amazon Basin', -5, -65], ['Patagonia', -46, -69],
  ['Great Plains', 42, -101], ['Canadian Shield', 56, -96], ['Greenland Interior', 72, -40],
  ['Central Siberia', 64, 102], ['Eastern Siberia', 66, 150], ['Tibetan Plateau', 33, 86],
  ['Gobi Desert', 43, 104], ['Taklamakan', 39, 83], ['Arabian Interior', 22, 48],
  ['Australian Outback', -25, 128], ['East Antarctica', -75, 95], ['West Antarctica', -78, -110],
  ['North Pacific', 32, -160], ['North Pacific', 35, 165], ['Equatorial Pacific', 0, -140],
  ['Equatorial Pacific', 0, 175], ['South Pacific', -28, -135], ['South Pacific', -35, -170],
  ['North Atlantic', 36, -42], ['Equatorial Atlantic', 2, -25], ['South Atlantic', -28, -18],
  ['Indian Ocean', -20, 78], ['Southern Ocean', -58, 40], ['Southern Ocean', -58, -120],
  ['Southern Ocean', -58, 140], ['Arctic Ocean', 82, 0]
];

function haversineKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

/**
 * Resolves any (lat, lon) coordinate on Earth to a simple city or region name.
 */
export function resolveLocationName(lat, lon) {
  const phi = Number(lat), lambda = Number(lon);
  if (!Number.isFinite(phi) || !Number.isFinite(lambda)) return 'Location';
  let bestCity = 'Location', bestDist = Infinity;
  for (const [name, cLat, cLon] of WORLD_CITIES) {
    const d = haversineKm(phi, lambda, cLat, cLon);
    if (d < bestDist) {
      bestDist = d;
      bestCity = name;
    }
  }
  if (bestDist <= 650) return bestCity;
  let bestRegion = bestCity, regionDist = Infinity;
  for (const [name, rLat, rLon] of BROAD_REGIONS) {
    const d = haversineKm(phi, lambda, rLat, rLon);
    if (d < regionDist) {
      regionDist = d;
      bestRegion = name;
    }
  }
  return bestRegion;
}

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
  const isStaticGithubPages = typeof location !== 'undefined' &&
    typeof location.hostname === 'string' &&
    location.hostname.endsWith('.github.io');
  let response;
  if (isStaticGithubPages) {
    response = await fetcher(nasaUrl, {signal});
  } else {
    try {
      response = await fetcher(proxyUrl, {signal});
      if (!response.ok || !response.headers.get('content-type')?.includes('json')) {
        response = await fetcher(nasaUrl, {signal});
      }
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      response = await fetcher(nasaUrl, {signal});
    }
  }
  if (!response.ok) throw new Error('NASA POWER request failed (HTTP ' + response.status + '). Please try again.');
  const payload = await response.json();
  const monthly = parseMonthly(payload, options.variable, options);
  if (!monthly.length) throw new Error('NASA returned no valid observations for this location and range.');
  return {
    monthly, url: nasaUrl, fetchedAt: new Date().toISOString(),
    source: 'NASA POWER / MERRA-2-derived meteorological reanalysis',
    metadata: payload.header || {}, coordinate: payload.geometry?.coordinates,
    requestedPeriod: {start: options.start, end: options.end}
  };
}

/** Adapter: a fetched NASA POWER response becomes a canonical Series. */
export function powerSeries(fetched, {id, label, color, lat, lon, variable}) {
  const info = VARIABLES[variable];
  return makeSeries({
    id, label, color, monthly: fetched.monthly, support: SUPPORT.GRID_POINT, geo: {lat, lon},
    variable: {code: 'POWER:' + variable, label: info.label, unit: info.unit, description: info.description},
    provenance: {kind: 'nasa-power', source: fetched.source, url: fetched.url, retrievedAt: fetched.fetchedAt,
      metadata: fetched.metadata, coordinate: fetched.coordinate, requestedPeriod: fetched.requestedPeriod || null, authenticated: true}
  });
}

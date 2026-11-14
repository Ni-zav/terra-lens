// Cloudflare Pages Function: strictly-allowlisted, read-only proxy to NASA POWER.
// Enables browser use where NASA's upstream CORS policy blocks direct requests.
const ENDPOINT = 'https://power.larc.nasa.gov/api/temporal/monthly/point';
const allowed = new Set(['T2M', 'RH2M', 'PRECTOTCORR']);
export async function onRequestGet({request}) {
  const input = new URL(request.url).searchParams;
  const lat = Number(input.get('latitude')), lon = Number(input.get('longitude'));
  const start = Number(input.get('start')), end = Number(input.get('end'));
  const variable = input.get('parameters');
  if (!allowed.has(variable) || !Number.isFinite(lat) || lat < -90 || lat > 90 ||
      !Number.isFinite(lon) || lon < -180 || lon > 180 ||
      !Number.isInteger(start) || !Number.isInteger(end) ||
      start < 1981 || end > 2025 || start > end) {
    return Response.json({ error: 'Invalid NASA POWER query' }, { status: 400 });
  }
  const query = new URLSearchParams({
    parameters: variable, community: 'AG', latitude: String(lat), longitude: String(lon),
    start: String(start), end: String(end), format: 'JSON'
  });
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    let result;
    try { result = await fetch(ENDPOINT + '?' + query.toString(), {signal: controller.signal}); }
    finally { clearTimeout(timer); }
    if (!result.ok) {
      return Response.json({error: 'NASA POWER upstream error', status: result.status}, {status: 502});
    }
    const body = await result.text();
    if (body.length > 2500000) return Response.json({error: 'NASA POWER response too large'}, {status: 502});
    return new Response(body, {
      headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600'}
    });
  } catch {
    return Response.json({error: 'NASA POWER temporarily unavailable'}, {status: 504});
  }
}

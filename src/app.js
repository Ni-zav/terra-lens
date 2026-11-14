import {annualMeans, linearTrend} from './stats.js';
import {VARIABLES, LOCATIONS, fetchNASA, requestURL} from './power.js';

const $ = id => document.getElementById(id);
const COLORS = ['#62d6e4', '#f6b975'];
let results = [];
let activeRequest = null;

const format = (value, digits = 2) => Number.isFinite(value)
  ? new Intl.NumberFormat('en-US', {maximumFractionDigits: digits}).format(value) : '—';
const signed = (value, digits = 2) => (value > 0 ? '+' : '') + format(value, digits);
const pLabel = p => p < 0.0001 ? '< 0.0001' : format(p, 4);

function fillLocationOptions(side, selected) {
  const select = $('city-' + side);
  for (const name of Object.keys(LOCATIONS)) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.append(option);
  }
  const custom = document.createElement('option');
  custom.value = 'custom';
  custom.textContent = 'Custom coordinates';
  select.append(custom);
  select.value = selected;
}

function selectLocation(side) {
  const name = $('city-' + side).value;
  if (!Object.hasOwn(LOCATIONS, name)) return;
  const [lat, lon] = LOCATIONS[name];
  $('lat-' + side).value = String(lat);
  $('lon-' + side).value = String(lon);
  renderCoordinates(readLocationPreview());
}

function setCompareEnabled() {
  const enabled = $('compare').checked;
  $('secondary-location').hidden = !enabled;
  for (const input of $('secondary-location').querySelectorAll('input,select')) input.disabled = !enabled;
  renderCoordinates(readLocationPreview());
}

function readLocationPreview() {
  const point = side => ({
    label: $('city-' + side).value === 'custom' ? 'Custom ' + side.toUpperCase() : $('city-' + side).value,
    lat: Number($('lat-' + side).value),
    lon: Number($('lon-' + side).value),
    id: side.toUpperCase()
  });
  return [point('a'), ...($('compare').checked ? [point('b')] : [])];
}

function getOptions() {
  const variable = $('variable').value;
  const start = Number($('start').value), end = Number($('end').value);
  if (!Number.isInteger(start) || !Number.isInteger(end) || end - start < 9) {
    throw new Error('Choose at least 10 calendar years, with an end year after the start.');
  }
  const points = readLocationPreview();
  for (const point of points) {
    if ($('lat-' + point.id.toLowerCase()).value.trim() === '' ||
        $('lon-' + point.id.toLowerCase()).value.trim() === '') {
      throw new Error('Enter both latitude and longitude for each selected point.');
    }
    requestURL({lat: point.lat, lon: point.lon, variable, start, end});
  }
  return {variable, start, end, points};
}

function setStatus(message, kind = '') {
  const node = $('status');
  node.textContent = message;
  node.className = 'status' + (kind ? ' ' + kind : '');
}

function svgNode(tag, attributes = {}, text) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}

function clearSvg(svg, description) {
  svg.replaceChildren();
  svg.append(svgNode('title', {}, description));
}

function drawCoordinates(points) {
  const svg = $('coordinate-chart');
  clearSvg(svg, 'Latitude and longitude coordinates of selected NASA model points.');
  const left = 32, right = 589, top = 25, bottom = 235;
  const x = lon => left + ((lon + 180) / 360) * (right - left);
  const y = lat => bottom - ((lat + 90) / 180) * (bottom - top);
  svg.append(svgNode('rect', {x:left, y:top, width:right-left, height:bottom-top, rx:4, fill:'#0a2437',stroke:'#254558'}));
  for (let lon = -180; lon <= 180; lon += 60) {
    const px = x(lon);
    svg.append(svgNode('line', {x1:px,y1:top,x2:px,y2:bottom,stroke:'#315166','stroke-width':1}));
    svg.append(svgNode('text', {x:px,y:255,'text-anchor':'middle',fill:'#819daa','font-size':11}, String(lon) + '°'));
  }
  for (let lat = -90; lat <= 90; lat += 30) {
    const py = y(lat);
    svg.append(svgNode('line',{x1:left,y1:py,x2:right,y2:py,stroke:'#315166','stroke-width':1}));
    if (lat > -90 && lat < 90) svg.append(svgNode('text',{x:27,y:py+4,'text-anchor':'end',fill:'#819daa','font-size':10},String(lat) + '°'));
  }
  const badges = $('coordinate-list');
  badges.replaceChildren();
  for (const [index, point] of points.entries()) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon) ||
        Math.abs(point.lat) > 90 || Math.abs(point.lon) > 180) continue;
    const px = x(point.lon), py = y(point.lat), color = COLORS[index];
    svg.append(svgNode('circle',{cx:px,cy:py,r:12,fill:color,'fill-opacity':.16}));
    svg.append(svgNode('circle',{cx:px,cy:py,r:5,fill:color,stroke:'#041420','stroke-width':2}));
    const offset = index === 1 ? -16 : -15;
    svg.append(svgNode('text',{x:px+11,y:py+offset,fill:color,'font-size':14,'font-weight':700},point.id));
    const chip = document.createElement('span');
    chip.className = 'coord-chip';
    chip.textContent = point.id + ' · ' + format(point.lat, 3) + '°, ' + format(point.lon, 3) + '°';
    badges.append(chip);
  }
}

let contextMap = null;
let contextMarkers = null;
function updateContextMap(points) {
  // Optional geographic context only; NASA measurements remain point samples.
  // If the remote tile service fails, the genuine coordinate graticule stays visible.
  if (!window.L) return;
  const valid = points.filter(point => Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180);
  if (!valid.length) return;
  const L = window.L;
  if (!contextMap) {
    contextMap = L.map('geo-map', {
      scrollWheelZoom: false, zoomControl: true, attributionControl: true,
      doubleClickZoom: true, maxZoom: 10
    });
    contextMarkers = L.layerGroup().addTo(contextMap);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      minZoom: 1, maxZoom: 10
    }).addTo(contextMap);
    tiles.on('load', () => $('map-stack').classList.add('map-ready'));
    tiles.on('tileerror', () => $('map-stack').classList.remove('map-ready'));
  }
  contextMarkers.clearLayers();
  valid.forEach((point, index) => {
    const color = COLORS[index] || COLORS[0];
    const icon = L.divIcon({
      className: 'terra-map-pin',
      html: '<span style="--pin-color:' + color + '">' + (point.id === 'B' ? 'B' : 'A') + '</span>',
      iconSize: [34, 34], iconAnchor: [17, 17]
    });
    const marker = L.marker([point.lat, point.lon], {icon}).addTo(contextMarkers);
    const label = document.createElement('span');
    label.textContent = point.id + ' · ' + point.label + ' (' +
      format(point.lat, 4) + '°, ' + format(point.lon, 4) + '°)';
    marker.bindTooltip(label);
  });
  // This map is a geographic locator; no NASA raster or interpolated trend is shown.
  if (valid.length === 1) contextMap.setView([valid[0].lat, valid[0].lon], 6);
  else contextMap.fitBounds(L.latLngBounds(valid.map(p => [p.lat, p.lon])),
    {padding: [35, 35], maxZoom: 7});
  contextMap.invalidateSize(false);
}
function renderCoordinates(points) {
  drawCoordinates(points);
  updateContextMap(points);
}

function renderLegend(container, series) {
  const parent = $(container);
  parent.replaceChildren();
  for (const [index, item] of series.entries()) {
    const label = document.createElement('span'); label.className = 'legend-item';
    const dot = document.createElement('span'); dot.className = 'legend-dot';
    dot.style.background = COLORS[index];
    const caption = document.createElement('span'); caption.textContent = item.label;
    label.append(dot, caption); parent.append(label);
  }
}

function renderPlot(id, series, monthly, unit) {
  const svg = $(id);
  const height = monthly ? 270 : 320;
  const top = 18, bottom = height - 43, left = 64, right = 935;
  const pointX = point => monthly ? point.year + (point.month - .5) / 12 : point.year;
  const groups = series.map(item => ({
    label: item.label, color: item.color,
    points: monthly ? item.monthly : item.annual,
    fit: monthly ? [] : item.trend?.fitted || []
  }));
  const all = groups.flatMap(group => group.points.map(p => ({x:pointX(p),y:p.value})));
  clearSvg(svg, (monthly ? 'Monthly observations' : 'Annual means and trends') + ' from NASA POWER, ' + unit);
  if (!all.length) {
    svg.append(svgNode('text',{x:480,y:140,'text-anchor':'middle',fill:'#92acb8'},'No valid observations to display.'));
    return;
  }
  let minX = Math.min(...all.map(p=>p.x)), maxX = Math.max(...all.map(p=>p.x));
  let minY = Math.min(...all.map(p=>p.y)), maxY = Math.max(...all.map(p=>p.y));
  if (maxX <= minX) maxX = minX + 1;
  const range = maxY - minY || Math.max(1, Math.abs(maxY) * .05);
  minY -= range * .16; maxY += range * .16;
  const sx = value => left + (value-minX)/(maxX-minX)*(right-left);
  const sy = value => bottom - (value-minY)/(maxY-minY)*(bottom-top);
  for (let i=0;i<=4;i++) {
    const v = minY + (maxY-minY)*i/4, py=sy(v);
    svg.append(svgNode('line',{x1:left,y1:py,x2:right,y2:py,stroke:'#244357','stroke-width':1}));
    svg.append(svgNode('text',{x:left-10,y:py+4,'text-anchor':'end',fill:'#799aac','font-size':12},format(v,range<3?2:1)));
  }
  const yearTicks = new Set();
  for (let i=0;i<=4;i++) {
    const year = Math.round(minX+(maxX-minX)*i/4);
    yearTicks.add(year);
  }
  for (const year of [...yearTicks].sort((a,b)=>a-b)) {
    const px = sx(year);
    svg.append(svgNode('line', {x1:px,y1:bottom,x2:px,y2:bottom+5,stroke:'#526a7b'}));
    svg.append(svgNode('text',{x:px,y:height-14,'text-anchor':'middle',fill:'#9db4c3','font-size':12},String(year)));
  }
  svg.append(svgNode('text',{x:left,y:12,fill:'#819cab','font-size':11},unit));
  for (const group of groups) {
    if (!group.points.length) continue;
    const points = group.points.map(p=>({x:pointX(p),y:p.value,...p}));
    const d = points.map((p,i) => {
      const previous = points[i-1];
      // Never draw a continuous line across an unobserved month or year.
      const currentIndex = monthly ? p.year * 12 + p.month : p.year;
      const previousIndex = previous && (monthly ? previous.year * 12 + previous.month : previous.year);
      const command = !previous || currentIndex - previousIndex !== 1 ? 'M' : 'L';
      return command + sx(p.x).toFixed(2) + ',' + sy(p.y).toFixed(2);
    }).join(' ');
    svg.append(svgNode('path',{d,fill:'none',stroke:group.color,'stroke-width':monthly?1.7:2.8,'stroke-linecap':'round','stroke-linejoin':'round'}));
    for (const point of points) {
      const circle = svgNode('circle',{
        cx:sx(point.x),cy:sy(point.y),r:monthly?5:4.1,
        fill:monthly?'transparent':group.color,
        stroke:monthly?'transparent':'#071521','stroke-width':1.2,
        tabindex:monthly?'-1':'0'
      });
      const date = monthly
        ? point.year + '-' + String(point.month).padStart(2, '0') : String(point.year);
      circle.append(svgNode('title',{},group.label+' · '+date+': '+format(point.y,3)+' '+unit));
      svg.append(circle);
    }
    if (group.fit.length) {
      const first = group.fit[0], last = group.fit.at(-1);
      svg.append(svgNode('line',{x1:sx(first.year),y1:sy(first.value),
        x2:sx(last.year),y2:sy(last.value),stroke:group.color,
        'stroke-width':2,'stroke-dasharray':'8 6',opacity:.8}));
    }
  }
}

function renderComparison(series, variable) {
  const container = $('comparison-panel');
  const rows = $('comparison-rows');
  rows.replaceChildren();
  container.hidden = false;
  const unit = VARIABLES[variable].unit;
  for (const item of series) {
    const card = document.createElement('article');
    card.className = 'comparison-point';
    card.style.setProperty('--series-color', item.color);
    const label = document.createElement('div');
    label.className = 'comparison-location';
    const badge = document.createElement('span');
    badge.className = 'comparison-badge';
    badge.textContent = item.id;
    const title = document.createElement('strong');
    title.textContent = item.label;
    const coords = document.createElement('small');
    coords.textContent = format(item.lat, 4) + '°, ' + format(item.lon, 4) + '°';
    label.append(badge, title, coords);
    const cells = document.createElement('div');
    cells.className = 'comparison-numbers';
    const add = (title, value, detail) => {
      const part = document.createElement('div');
      part.className = 'comparison-stat';
      const caption = document.createElement('span');
      caption.textContent = title;
      const prominent = document.createElement('strong');
      prominent.textContent = value;
      part.append(caption, prominent);
      if (detail) {
        const small = document.createElement('small');
        small.textContent = detail;
        part.append(small);
      }
      cells.append(part);
    };
    add('Complete years', String(item.annual.length), item.monthly.length + ' valid months');
    if (item.trend) {
      add('Linear trend', signed(item.trend.slopePerDecade, 3) + ' ' + unit + '/decade',
        '2001 is not assumed; actual years ' + item.trend.start + '–' + item.trend.end);
      add('Classical 95% slope interval',
        signed(item.trend.ciLowPerDecade, 3) + ' to ' + signed(item.trend.ciHighPerDecade, 3), unit + '/decade');
      add('Classical two-sided p', pLabel(item.trend.pValue),
        item.trend.significant ? 'Below 0.05 if assumptions hold' : 'Not below 0.05');
    } else {
      add('Linear trend', 'Not estimated', 'At least 10 complete years required');
    }
    card.append(label, cells);
    rows.append(card);
  }
}

function updateResults(config, series, warnings) {
  results = series;
  const main = series[0], varInfo = VARIABLES[config.variable], trend = main.trend;
  $('data-label').textContent = 'NASA DATA LOADED';
  $('data-label').classList.add('live');
  $('result-context').textContent = varInfo.label + ' · ' + config.start + '–' + config.end;
  $('unit-chip').textContent = varInfo.unit + ' / ' + varInfo.label;
  $('metric-years').textContent = main.annual.length ? String(main.annual.length) : '0';
  $('metric-years-detail').textContent = 'Full years · ' + (main.annual[0]?.year ?? '—') + ' to ' + (main.annual.at(-1)?.year ?? '—');
  if (trend) {
    $('metric-slope').textContent = signed(trend.slopePerDecade) + ' ' + varInfo.unit;
    $('metric-slope-detail').textContent = '95% CI: ' + signed(trend.ciLowPerDecade) + ' to ' +
      signed(trend.ciHighPerDecade) + ' ' + varInfo.unit + '/decade';
    $('metric-significance').textContent = trend.significant ? 'Significant*' : 'Not significant';
    $('metric-significance').className = trend.significant ? 'yes' : 'no';
    $('metric-significance-detail').textContent = 'p ' + pLabel(trend.pValue) + ' · classical OLS test';
  } else {
    $('metric-slope').textContent = 'Insufficient data';
    $('metric-slope-detail').textContent = 'At least 10 complete years required.';
    $('metric-significance').textContent = 'Not tested';
    $('metric-significance').className = '';
    $('metric-significance-detail').textContent = 'Incomplete time-series coverage';
  }
  let finding = trend
    ? 'At ' + main.label + ', the fitted ' + varInfo.label.toLowerCase() + ' slope is ' +
      signed(trend.slopePerDecade) + ' ' + varInfo.unit + ' per decade (' +
      trend.start + '–' + trend.end + '). ' +
      (trend.significant ? 'The classical OLS test crosses the 5% significance threshold.' :
        'It does not cross the 5% significance threshold.')
    : 'The selected location has too few complete calendar years for our minimum 10-year analysis.';
  if (series.length > 1 && series[1].trend) {
    finding += ' ' + series[1].label + ' has a fitted slope of ' +
      signed(series[1].trend.slopePerDecade) + ' ' + varInfo.unit + ' per decade.';
    finding += ' Differences between point slopes are descriptive, not a formal test of their difference.';
  }
  finding += ' *The t-test assumes independent residuals; serial correlation and repeated searches can overstate confidence.';
  $('finding-text').textContent = finding;
  $('provenance-text').textContent = 'Live NASA POWER monthly point API (meteorological reanalysis), retrieved ' +
    new Date(main.fetchedAt).toLocaleString('en-US') + '. ' + main.monthly.length +
    ' valid monthly observations at point A. Inference is exploratory and does not establish causation.';
  const link = document.createElement('a');
  link.href = main.url; link.target = '_blank'; link.rel='noopener noreferrer';
  link.textContent = 'Inspect original NASA API request ↗';
  $('source-link').replaceChildren(link);
  $('download').disabled = false;
  renderComparison(series, config.variable);
  renderLegend('annual-legend', series);
  renderLegend('monthly-legend', series);
  renderPlot('annual-chart', series, false, varInfo.unit);
  renderPlot('monthly-chart', series, true, varInfo.unit);
  renderCoordinates(series);
  setStatus('Loaded ' + series.length + ' NASA point' + (series.length>1?'s':'') + '. ' +
    series.reduce((sum,item)=>sum+item.monthly.length,0) + ' valid monthly records. ' +
    (warnings.length ? warnings.join(' ') : ''),warnings.length ? 'error' : 'success');
}

function resetResultsUI() {
  results = [];
  $('metric-slope').textContent = '—';
  $('metric-slope-detail').textContent = 'Awaiting verified NASA observations';
  $('metric-significance').textContent = '—';
  $('metric-significance').className = '';
  $('metric-significance-detail').textContent = 'No inference until a request succeeds';
  $('metric-years').textContent = '—';
  $('metric-years-detail').textContent = 'Complete years only';
  $('result-context').textContent = 'Waiting for new observations';
  $('finding-text').textContent = 'Retrieving real NASA data. Previous findings are cleared to avoid stale evidence.';
  $('provenance-text').textContent = 'Data provenance will appear after successful NASA retrieval.';
  $('source-link').replaceChildren();
  for (const id of ['annual-chart','monthly-chart']) {
    const svg = $(id);
    clearSvg(svg, 'Awaiting new NASA observations');
    svg.append(svgNode('text', {x:480,y:140,'text-anchor':'middle',fill:'#8299aa'}, 'Waiting for observations…'));
  }
  $('annual-legend').replaceChildren();
  $('monthly-legend').replaceChildren();
  $('comparison-panel').hidden = true;
  $('comparison-rows').replaceChildren();
}

async function runAnalysis() {
  let config;
  try { config = getOptions(); }
  catch (error) { setStatus(error.message,'error'); return; }
  if (activeRequest) activeRequest.abort();
  activeRequest = new AbortController();
  const controller = activeRequest;
  const button = $('analyze');
  button.disabled = true; button.firstChild.textContent = 'Querying NASA POWER… ';
  setStatus('Retrieving real monthly records. NASA may take a few moments.');
  $('data-label').textContent='LOADING'; $('data-label').classList.remove('live');
  $('download').disabled = true;
  resetResultsUI();
  try {
    const tasks = config.points.map(async (point,index) => {
      const input = {lat:point.lat,lon:point.lon,variable:config.variable,start:config.start,end:config.end};
      const fetched = await fetchNASA(input,{signal:controller.signal});
      const annual = annualMeans(fetched.monthly);
      return {...fetched,...point,variable:config.variable,color:COLORS[index],annual,
        trend:linearTrend(annual)};
    });
    const settled = await Promise.allSettled(tasks);
    if (controller.signal.aborted) return;
    if (settled[0].status === 'rejected') throw settled[0].reason;
    const series = settled.filter(s=>s.status==='fulfilled').map(s=>s.value);
    const warnings = settled.flatMap((s,index)=>s.status==='rejected'?
      ['Point '+config.points[index].id+' could not load: '+s.reason.message]:[]);
    updateResults(config,series,warnings);
  } catch (error) {
    if (controller.signal.aborted) return;
    $('data-label').textContent='REQUEST FAILED';
    setStatus('Could not retrieve verified NASA observations: '+error.message,'error');
    $('finding-text').textContent='No NASA observations loaded. The app will not substitute fabricated or estimated records.';
  } finally {
    if (activeRequest===controller) {
      button.disabled=false;
      button.firstChild.textContent='Analyze NASA data ';
      activeRequest=null;
    }
  }
}

function getShareURL() {
  const url = new URL(location.href);
  const keys = ['variable','start','end','cityA','cityB','latA','lonA','latB','lonB','compare','auto'];
  for (const key of keys) url.searchParams.delete(key);
  const val = id => $(id).value;
  url.searchParams.set('variable',val('variable'));
  url.searchParams.set('start',val('start'));
  url.searchParams.set('end',val('end'));
  for (const side of ['a','b']) {
    url.searchParams.set('city'+side.toUpperCase(),val('city-'+side));
    url.searchParams.set('lat'+side.toUpperCase(),val('lat-'+side));
    url.searchParams.set('lon'+side.toUpperCase(),val('lon-'+side));
  }
  url.searchParams.set('compare',$('compare').checked ? '1':'0');
  url.searchParams.set('auto','1');
  return url.toString();
}

function restoreURL() {
  const params = new URLSearchParams(location.search);
  if (Object.hasOwn(VARIABLES,params.get('variable'))) $('variable').value=params.get('variable');
  for (const id of ['start','end']) if (params.has(id)) $(id).value=params.get(id);
  for (const side of ['a','b']) {
    const suffix=side.toUpperCase();
    const name=params.get('city'+suffix);
    if (name && (Object.hasOwn(LOCATIONS,name) || name==='custom')) {
      $('city-'+side).value=name;
      selectLocation(side);
    }
    for (const field of ['lat','lon']) {
      if (params.has(field+suffix)) $(field+'-'+side).value=params.get(field+suffix);
    }
  }
  if (params.has('compare')) $('compare').checked=params.get('compare')==='1';
  setCompareEnabled();
  $('variable-description').textContent = VARIABLES[$('variable').value].description;
  if (params.get('auto')==='1') runAnalysis();
}

function exportCSV() {
  if (!results.length) return;
  const variable=results[0].variable;
  const columns=['location','latitude','longitude','variable','year','month','value','unit','source_url','retrieved_at'];
  const escape = value => '"' + String(value).replaceAll('"','""') + '"';
  const rows=[columns.join(',')];
  for (const item of results) for (const data of item.monthly) {
    rows.push([item.label,item.lat,item.lon,item.variable,data.year,data.month,data.value,
      VARIABLES[item.variable].unit,item.url,item.fetchedAt].map(escape).join(','));
  }
  const href=URL.createObjectURL(new Blob([rows.join('\n')+'\n'],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a'); link.href=href; link.download='terra-lens-nasa-power-'+variable+'.csv';
  document.body.append(link); link.click(); link.remove();
  setTimeout(()=>URL.revokeObjectURL(href),1500);
}

$('example-button').addEventListener('click', event => {
  event.preventDefault();
  $('variable').value = 'T2M';
  $('variable-description').textContent = VARIABLES.T2M.description;
  $('start').value = '2001'; $('end').value = '2024';
  $('city-a').value = 'Yogyakarta'; selectLocation('a');
  $('city-b').value = 'Jakarta'; selectLocation('b');
  $('compare').checked = true; setCompareEnabled();
  $('explore').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  runAnalysis();
});

fillLocationOptions('a','Yogyakarta');
fillLocationOptions('b','Jakarta');
for (const side of ['a','b']) {
  $('city-'+side).addEventListener('change',()=>selectLocation(side));
  for (const axis of ['lat','lon']) {
    $(axis+'-'+side).addEventListener('input',()=>{
      $('city-'+side).value='custom';
      renderCoordinates(readLocationPreview());
    });
  }
}
$('compare').addEventListener('change',setCompareEnabled);
$('variable').addEventListener('change',()=>{
  $('variable-description').textContent=VARIABLES[$('variable').value].description;
});
$('investigation-form').addEventListener('submit',event=>{event.preventDefault();runAnalysis();});
$('download').addEventListener('click',exportCSV);
$('share').addEventListener('click',async()=>{
  const url=getShareURL();
  try {
    await navigator.clipboard.writeText(url);
    setStatus('Investigation URL copied. Opening the link will run live NASA analysis.','success');
  } catch {
    window.prompt('Copy this investigation URL:',url);
  }
});
renderCoordinates(readLocationPreview());
restoreURL();
window.addEventListener('load', () => renderCoordinates(readLocationPreview()));
window.addEventListener('resize', () => contextMap?.invalidateSize(false), {passive: true});

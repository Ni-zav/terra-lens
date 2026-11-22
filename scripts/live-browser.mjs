// End-to-end browser evidence from REAL NASA POWER responses.
// This is intentionally distinct from tests/browser.smoke.mjs, which uses synthetic fixture data.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {join, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {onRequestGet} from '../functions/api/power.js';

const ROOT=fileURLToPath(new URL('../', import.meta.url));
const DIST=join(ROOT,'dist');
const SCREENSHOTS=resolve(process.env.TERRA_LIVE_SCREENSHOT_DIR||join(ROOT,'artifacts','live-browser'));
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.md':'text/plain'};
const calls=[];
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/api/power'){
    try{
      const response=await onRequestGet({request:new Request(url)});
      const body=Buffer.from(await response.arrayBuffer());
      res.writeHead(response.status,Object.fromEntries(response.headers.entries()));
      res.end(body);
      if(response.ok){
        const json=JSON.parse(body.toString('utf8'));
        assert.ok(json.properties?.parameter?.[url.searchParams.get('parameters')],
          'Live response missing requested NASA parameter');
        calls.push({parameters:url.searchParams.get('parameters'),
          latitude:url.searchParams.get('latitude'), longitude:url.searchParams.get('longitude'),
          months:Object.keys(json.properties.parameter[url.searchParams.get('parameters')]).length,
          source:'NASA POWER via real Cloudflare Pages Function'});
      }
    }catch(e){res.writeHead(502,{'content-type':'application/json'}).end(JSON.stringify({error:'live NASA request failed'}));console.error(e)}
    return;
  }
  const path=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if(path.includes('..')){res.writeHead(403).end();return}
  try{const body=await readFile(join(DIST,path));res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}).end(body)}
  catch{res.writeHead(404).end('Not found')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
let browser;
try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
  const page=await context.newPage();
  const errors=[];
  const nasaResponses=[],rawCase=new Map();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',res=>{
    if(res.ok()&&(res.url().includes('/api/power?')||res.url().includes('power.larc.nasa.gov/api/temporal/monthly/point'))){
      const u=new URL(res.url());
      const latitude=u.searchParams.get('latitude');
      if(u.searchParams.get('parameters')==='T2M'&&['-7.7956','-6.2088'].includes(latitude)&&!rawCase.has(latitude))
        rawCase.set(latitude,res.body());
      nasaResponses.push({parameters:u.searchParams.get('parameters'),latitude:u.searchParams.get('latitude'),longitude:u.searchParams.get('longitude'),url:res.url()});
    }
  });
  await page.goto('http://127.0.0.1:'+port+'/#explore',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('data-label').textContent==='NASA data loaded',
    null,{timeout:125000});
  assert.match(await page.locator('#metric-slope').textContent(),/\+0\.18 °C/);
  assert.equal((await page.locator('#metric-years').textContent()).trim(),'24');
  assert.match(await page.locator('#finding-text').textContent(),/B · Jakarta:/);
  assert.equal(nasaResponses.filter(c=>c.parameters==='T2M').length>=2,true,'Both points must fetch real NASA T2M');
  assert.equal(errors.length,0,errors.join('; '));
  await mkdir(SCREENSHOTS,{recursive:true});
  await Promise.all([['-7.7956','yogyakarta'],['-6.2088','jakarta']].map(async ([lat,name])=>{
    const source=await rawCase.get(lat);
    assert.ok(source?.length,`Missing NASA response body for ${name}`);
    await writeFile(join(SCREENSHOTS,`power-${name}.json`),source);
  }));
  // Frame the controls and results for the presentation; the full explorer is
  // substantially taller now that the geographic picker precedes it.
  await page.locator('.topbar').evaluate(el => { el.style.visibility='hidden'; });
  await page.locator('.workspace').screenshot({path:join(SCREENSHOTS,'nasa-real-desktop.png'),animations:'disabled'});
  await page.locator('.topbar').evaluate(el => { el.style.visibility=''; });
  // Export the completed investigation before changing its controls.
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#download').click();
  const download=await downloadPromise;
  assert.match(download.suggestedFilename(),/T2M/);
  const csv=await readFile(await download.path(),'utf8');
  assert.match(csv,/"POWER:T2M"/);
  assert.match(csv,/power\.larc\.nasa\.gov/);
  assert.equal(csv.trimEnd().split('\n').length,577,'Both points, each with 288 monthly rows');
  await download.saveAs(join(SCREENSHOTS,'live-power-t2m.csv'));
  const evidenceEvent=page.waitForEvent('download');
  await page.locator('#evidence-download').click();
  const evidenceDownload=await evidenceEvent;
  await evidenceDownload.saveAs(join(SCREENSHOTS,'live-power-evidence.json'));
  const liveEvidence=JSON.parse(await readFile(join(SCREENSHOTS,'live-power-evidence.json'),'utf8'));
  assert.equal(liveEvidence.schema,'terra-lens-evidence-v2');
  assert.equal(liveEvidence.interpretation.comparisons[0].findingStatus,'difference-not-established');
  assert.deepEqual(liveEvidence.series.map(s=>[s.monthly.length,s.annual.length]),[[288,24],[288,24]]);
  assert.ok(liveEvidence.series.every(s=>s.provenance.sourceMode==='freshly-fetched'&&Date.parse(s.provenance.retrievedAt)));
  console.log('Live POWER T2M pair: 576 CSV data rows, Evidence JSON, paired inference',liveEvidence.comparisons[0].contrast.hac);
  // Edited controls must never relabel an older file. Then request a distinct variable.
  await page.locator('#variable').selectOption('RH2M');
  assert.ok(await page.locator('#download').isDisabled());
  await page.locator('#compare').uncheck();
  await page.locator('#analyze').click();
  await page.waitForFunction(()=>document.getElementById('data-label').textContent==='NASA data loaded'
    && document.getElementById('unit-chip')?.textContent.includes('%'),null,{timeout:125000});
  assert.ok(nasaResponses.some(c=>c.parameters==='RH2M'));
  await page.locator('#variable').selectOption('T2M');
  await page.locator('#compare').check();
  await page.locator('#analyze').click();
  await page.waitForFunction(()=>document.getElementById('data-label').textContent==='NASA data loaded'
    && document.getElementById('unit-chip')?.textContent.includes('°C'),null,{timeout:125000});
  await page.setViewportSize({width:390,height:844});
  const overflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
  assert.ok(overflow.scroll<=overflow.width+2,'Mobile overflow: '+JSON.stringify(overflow));
  await page.locator('#explore').screenshot({path:join(SCREENSHOTS,'nasa-real-mobile.png'),animations:'disabled'});

  // The new discovery flow is tested AGAINST REAL NASA, not the separate fixture server.
  await page.locator('#tab-finder').click();
  await page.locator('#finder-run').waitFor({timeout:25000});
  assert.equal(await page.locator('.discovery-table tbody tr').count(),8);
  const callsBeforeFinder=calls.filter(c=>c.parameters==='T2M').length;
  await page.locator('#finder-run').click();
  await page.waitForFunction(()=>document.getElementById('finder-status')?.textContent.includes('Finished:'),
    null,{timeout:125000});
  assert.match(await page.locator('#finder-status').textContent(),/8 trends/);
  assert.equal(await page.locator('.discovery-table tbody tr').count(),8);
  assert.equal(await page.locator('.discovery-table tbody tr').filter({hasText:'Request failed'}).count(),0);
  const finderLink=await page.locator('.discovery-inspect').getAttribute('href');
  assert.match(finderLink,/auto=1/);
  assert.match(finderLink,/compare=1/);
  const downloadEvidence=page.waitForEvent('download');
  await page.locator('#finder-download').click();
  const jsonFile=await downloadEvidence;
  await jsonFile.saveAs(join(SCREENSHOTS,'live-finder-evidence.json'));
  const evidence=JSON.parse(await readFile(await jsonFile.path(),'utf8'));
  assert.equal(evidence.schema,'terra-lens-sentinel-screen-v1');
  assert.equal(evidence.records.length,8);
  assert.equal(evidence.count.successes,8);
  assert.ok(evidence.records.every(r=>r.monthly.length===288&&r.annual.length===24));
  assert.ok(evidence.records.every(r=>r.sourceURL.startsWith('https://power.larc.nasa.gov/')));
  assert.match(evidence.brief.uncertainty,/post-selection/);
  assert.equal(nasaResponses.filter(c=>c.parameters==='T2M').length>=8,true,'Every sentinel point needs real NASA response');
  const finderOverflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
  assert.ok(finderOverflow.scroll<=finderOverflow.width+2,'Mobile discovery overflow: '+JSON.stringify(finderOverflow));
  await page.locator('#contrast-finder').screenshot({
    path:join(SCREENSHOTS,'nasa-real-finder-mobile.png'),animations:'disabled'});
  await page.setViewportSize({width:1280,height:900});
  await page.locator('#contrast-finder').screenshot({
    path:join(SCREENSHOTS,'nasa-real-finder-desktop.png'),animations:'disabled'});
  console.log('LIVE eight-point NASA discovery passed in Chromium: 8/8 point requests, 24 complete years each, export, A/B link, mobile layout, real screenshots.');
  await writeFile(join(SCREENSHOTS,'README.md'),[
    '# Verified LIVE NASA browser screenshots',
    '',
    'Captured: '+new Date().toISOString()+' (UTC).',
    '',
    'These images were produced by a real Chromium browser running the application against actual NASA POWER API responses via the project Cloudflare Pages Function code served locally. The desktop image frames the workspace with the sticky navigation hidden to avoid covering data. They are NOT generated from test fixtures, AI image generation, or a deployed Cloudflare site.',
    '',
    'Initial investigation: T2M, 2001–2024, Yogyakarta (-7.7956, 110.3695) and Jakarta (-6.2088, 106.8456).',
    'Secondary integration check: RH2M at Yogyakarta.',
    '',
    'The result describes model-derived grid-point estimates. Classical OLS intervals may be optimistic under serial correlation. Run this script again if the source changes.',
    'Branch-only experimental Finder verification: additional eight Indonesian sentinel points, all based on REAL NASA POWER monthly T2M responses; see nasa-real-finder-desktop.png and nasa-real-finder-mobile.png. This is not spatially representative and the selected extreme-pair HAC inference is post-selected and non-confirmatory.',
    '',
    'Workflow: https://github.com/Ni-zav/terra-lens/actions/workflows/live-browser.yml',
    '',
  ].join('\n'));
  console.log('LIVE NASA browser passed: actual NASA API, both points, second variable, CSV, real screenshots, mobile and source URL.');
  console.log(JSON.stringify({calls,overflow}));
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}

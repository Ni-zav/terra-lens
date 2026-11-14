// End-to-end browser evidence from REAL NASA POWER responses.
// This is intentionally distinct from tests/browser.smoke.mjs, which uses synthetic fixture data.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {join, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {onRequestGet} from '../functions/api/power.js';

const ROOT=fileURLToPath(new URL('../', import.meta.url));
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.md':'text/plain'};
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
  try{const body=await readFile(join(ROOT,path));res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}).end(body)}
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
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+port,{waitUntil:'domcontentloaded'});
  await page.locator('#analyze').click();
  await page.waitForFunction(()=>document.getElementById('data-label').textContent==='NASA DATA LOADED',
    null,{timeout:125000});
  assert.match(await page.locator('#metric-slope').textContent(),/\+0\.18 °C/);
  assert.equal((await page.locator('#metric-years').textContent()).trim(),'24');
  assert.match(await page.locator('#finding-text').textContent(),/Jakarta has a fitted slope/);
  assert.equal(calls.filter(c=>c.parameters==='T2M').length,2,'Both points must fetch real NASA T2M');
  assert.equal(errors.length,0,errors.join('; '));
  await mkdir(join(ROOT,'docs','screenshots'),{recursive:true});
  await page.locator('#explore').screenshot({path:join(ROOT,'docs','screenshots','nasa-real-desktop.png'),animations:'disabled'});
  // Changing the SELECT control must not relabel CSV that still represents the old analysis.
  await page.locator('#variable').selectOption('RH2M');
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#download').click();
  const download=await downloadPromise;
  assert.match(download.suggestedFilename(),/T2M/);
  const csv=await readFile(await download.path(),'utf8');
  assert.match(csv,/"T2M"/);
  assert.match(csv,/power\.larc\.nasa\.gov/);
  assert.equal(csv.trimEnd().split('\n').length,577,'Both points, each with 288 monthly rows');
  // Re-query a distinct NASA variable, not a fixture.
  await page.locator('#compare').uncheck();
  await page.locator('#analyze').click();
  await page.waitForFunction(()=>document.getElementById('data-label').textContent==='NASA DATA LOADED'
    && document.getElementById('unit-chip').textContent.includes('%'),null,{timeout:125000});
  assert.ok(calls.some(c=>c.parameters==='RH2M'));
  await page.locator('#variable').selectOption('T2M');
  await page.locator('#compare').check();
  await page.locator('#analyze').click();
  await page.waitForFunction(()=>document.getElementById('data-label').textContent==='NASA DATA LOADED'
    && document.getElementById('unit-chip').textContent.includes('°C'),null,{timeout:125000});
  await page.setViewportSize({width:390,height:844});
  const overflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
  assert.ok(overflow.scroll<=overflow.width+2,'Mobile overflow: '+JSON.stringify(overflow));
  await page.locator('#explore').screenshot({path:join(ROOT,'docs','screenshots','nasa-real-mobile.png'),animations:'disabled'});
  await writeFile(join(ROOT,'docs','screenshots','README.md'),[
    '# Verified LIVE NASA browser screenshots',
    '',
    'Captured: '+new Date().toISOString()+' (UTC).',
    '',
    'These images were produced by a real Chromium browser running the application against actual NASA POWER API responses via the project Cloudflare Pages Function code served locally. They are NOT generated from test fixtures, AI image generation, or a deployed Cloudflare site.',
    '',
    'Initial investigation: T2M, 2001–2024, Yogyakarta (-7.7956, 110.3695) and Jakarta (-6.2088, 106.8456).',
    'Secondary integration check: RH2M at Yogyakarta.',
    '',
    'The result describes model-derived grid-point estimates. Classical OLS intervals may be optimistic under serial correlation. Run this script again if the source changes.',
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

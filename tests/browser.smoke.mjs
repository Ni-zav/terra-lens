// Deterministic browser-only fixture. NEVER substitute these values for NASA observations
// in production. This test checks UI plumbing, not empirical scientific accuracy.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {join, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const mime = {'.html':'text/html', '.css':'text/css', '.js':'text/javascript',
  '.svg':'image/svg+xml', '.md':'text/plain', '.json':'application/json'};
const server = createServer(async (req, res) => {
  const uri=new URL(req.url, 'http://127.0.0.1');
  if (uri.pathname === '/api/power') {
    const {searchParams:q}=uri, code=q.get('parameters');
    const start=Number(q.get('start')), end=Number(q.get('end')), lat=Number(q.get('latitude'));
    const data={};
    for(let year=start;year<=end;year++) for(let month=1;month<=12;month++) {
      const key=String(year)+String(month).padStart(2,'0');
      const seasonal=Math.sin((month-1)*Math.PI/6);
      const base=code==='T2M'?24:code==='RH2M'?75:5;
      data[key]=Number((base+(year-start)*.075+seasonal*.9+lat*.03).toFixed(5));
    }
    const json=JSON.stringify({
      header:{title:'DETERMINISTIC TEST FIXTURE - NOT NASA DATA'},
      properties:{parameter:{[code]:data}}
    });
    res.writeHead(200,{'content-type':'application/json'}).end(json);
    return;
  }
  let path=uri.pathname === '/' ? 'index.html' : decodeURIComponent(uri.pathname).replace(/^\/+/,'');
  if(path.includes('..')) {res.writeHead(403).end();return;}
  try {
    const body=await readFile(join(ROOT,path));
    res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
let browser;
try {
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto('http://127.0.0.1:'+port,{waitUntil:'domcontentloaded'});
  assert.match(await page.locator('h1').textContent(),/Earth trend workspace/);
  await page.waitForFunction(()=>document.getElementById('data-label').textContent==='NASA DATA LOADED',
    null,{timeout:15000});
  await page.locator('#earth-globe').scrollIntoViewIfNeeded();
  await page.locator('#earth-globe canvas').waitFor({timeout:20000});
  const globeBox=await page.locator('#earth-globe canvas').boundingBox();
  await page.mouse.click(globeBox.x+globeBox.width/2,globeBox.y+globeBox.height/2);
  assert.ok(Math.abs(Number(await page.locator('#lat-a').inputValue())+8)<0.1);
  assert.ok(Math.abs(Number(await page.locator('#lon-a').inputValue())-110)<0.1);
  assert.match(await page.locator('#globe-status').textContent(),/Run analysis/);
  assert.equal((await page.locator('#data-label').textContent()).trim(),'INPUTS CHANGED');
  assert.match(await page.locator('#result-context').textContent(),/^Previous result:/);
  await page.locator('#city-a').selectOption('Yogyakarta');
  await page.locator('#compare').uncheck();
  await page.locator('#globe-b').click();
  await page.locator('#earth-globe canvas').click({position:{x:globeBox.width/2,y:globeBox.height/2}});
  assert.equal(await page.locator('#compare').isChecked(),true);
  assert.match(await page.locator('#globe-status').textContent(),/Point B set/);
  await page.locator('#city-b').selectOption('Jakarta');
  await page.locator('#analyze').click();
  await page.waitForFunction(()=>document.getElementById('data-label').textContent==='NASA DATA LOADED',
    null,{timeout:15000});
  assert.match(await page.locator('#metric-slope').textContent(),/°C/);
  assert.match(await page.locator('#metric-years').textContent(),/24/);
  assert.equal(await page.locator('#download').isDisabled(),false);
  assert.equal(await page.locator('#comparison-point').count(), 0, 'No stale legacy comparison cards');
  await page.locator('#tab-comparison').click();
  assert.equal(await page.locator('#comparison-panel').isVisible(), true);
  assert.equal(await page.locator('.comparison-point').count(), 2);
  assert.equal(await page.locator('#confidence-chart circle').count(), 2,
    'Forest plot must display one actual slope estimate for each point');
  assert.equal(await page.locator('#confidence-chart line').count() >= 8, true,
    'Confidence limits and zero/grid reference should be visible');
  assert.match(await page.locator('.comparison-point').first().textContent(), /Yogyakarta/);
  assert.match(await page.locator('.comparison-point').last().textContent(), /Jakarta/);
  assert.equal(await page.locator('link[href="./styles/observatory.css"]').count(), 1);
  assert.equal(await page.locator('#example-button').count(), 1);
  assert.ok(await page.locator('#annual-chart path').count()>=2);
  assert.ok(await page.locator('#monthly-chart path').count()>=2);
  await page.locator('#tab-annual').click();
  await page.locator('#tab-annual').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#tab-monthly').getAttribute('aria-selected'),'true');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#tab-annual').getAttribute('aria-selected'),'true');
  await page.locator('#annual-cursor').fill('0');
  assert.match(await page.locator('#annual-readout').textContent(),/2001.*Yogyakarta.*Jakarta/);
  await page.locator('#tab-monthly').click();
  await page.locator('#monthly-cursor').fill('0');
  assert.match(await page.locator('#monthly-readout').textContent(),/2001-01.*Yogyakarta.*Jakarta/);
  await page.locator('#tab-annual').click();
  const fullSlope=await page.locator('#metric-slope').textContent();
  await page.locator('[data-chart="annual"][data-years="10"]').click();
  await page.locator('#annual-cursor').fill('0');
  assert.match(await page.locator('#annual-readout').textContent(),/^2015/);
  assert.equal(await page.locator('#metric-slope').textContent(),fullSlope,
    'Changing the display period must not change the fitted analysis');
  await page.locator('[data-chart="annual"][data-years="all"]').click();
  // Desktop must fit actual controls and each view, not merely hide overflow.
  for (const [width,height] of [[1440,900],[1366,768],[1280,720],[1024,768],[1000,660]]) {
    await page.setViewportSize({width,height});
    for (const name of ['annual','monthly','comparison']) {
      await page.locator('#tab-'+name).click();
      const dimensions=await page.evaluate(() => {
        const selectors=['.controls','.location-column','.results','#analyze','.source-actions',
          '[role="tabpanel"]:not([hidden])'];
        return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,
          scrollHeight:document.documentElement.scrollHeight,
          boxes:selectors.map(selector=>{
            const node=document.querySelector(selector), box=node.getBoundingClientRect();
            return {selector,right:box.right,bottom:box.bottom,scroll:node.scrollHeight,client:node.clientHeight};
          })};
      });
      assert.ok(dimensions.scrollWidth<=width+2 && dimensions.scrollHeight<=height+2,
        'Desktop document overflow: '+JSON.stringify(dimensions));
      for (const box of dimensions.boxes) {
        assert.ok(box.right<=width+1 && box.bottom<=height+1 && box.scroll<=box.client+2,
          'Desktop content clipped: '+JSON.stringify({width,height,name,box}));
      }
    }
  }
  await page.setViewportSize({width:1440,height:900});
  await page.locator('#tab-annual').click();
  assert.equal(errors.length,0,'Browser errors: '+errors.join('; '));
  await mkdir(join(ROOT,'artifacts'),{recursive:true});
  await page.screenshot({path:join(ROOT,'artifacts','desktop.png'),fullPage:true});
  await page.setViewportSize({width:768,height:1024});
  const tabletOverflow = await page.evaluate(()=>({
    scroll:document.documentElement.scrollWidth,width:window.innerWidth
  }));
  assert.ok(tabletOverflow.scroll <= tabletOverflow.width+2,
    'Tablet horizontal overflow: '+JSON.stringify(tabletOverflow));
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:join(ROOT,'artifacts','mobile.png'),fullPage:true});
  const overflow=await page.evaluate(()=>({
    scroll:document.documentElement.scrollWidth,width:window.innerWidth
  }));
  assert.ok(overflow.scroll <= overflow.width+2, 'Mobile horizontal overflow: '+JSON.stringify(overflow));
  await page.locator('#tab-comparison').click();
  assert.equal(await page.locator('.comparison-point').count(), 2);
  const visibility = await page.locator('.comparison-point').first().evaluate(el=>({
    display:getComputedStyle(el).display, width:el.getBoundingClientRect().width
  }));
  assert.ok(visibility.display!=='none' && visibility.width > 200,
    'Comparison information must be readable on mobile: '+JSON.stringify(visibility));
  const noWebGL=await browser.newPage({viewport:{width:390,height:844}});
  await noWebGL.addInitScript(() => {
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args) {
      return type.startsWith('webgl') ? null : original.call(this,type,...args);
    };
  });
  await noWebGL.goto('http://127.0.0.1:'+port,{waitUntil:'domcontentloaded'});
  await noWebGL.locator('#earth-globe').scrollIntoViewIfNeeded();
  await noWebGL.locator('#earth-globe[data-error]').waitFor({timeout:20000});
  assert.equal(await noWebGL.locator('#lat-a').isEnabled(),true,
    'Manual coordinates must remain available without WebGL');
  await noWebGL.close();
  // Production must show a failure, never fixture data, when NASA cannot be reached.
  const offline=await browser.newPage({viewport:{width:1280,height:720}});
  await offline.route('**/api/power?**',route=>route.fulfill({status:503,body:'unavailable'}));
  await offline.route('**/power.larc.nasa.gov/**',route=>route.fulfill({status:503,body:'unavailable'}));
  await offline.goto('http://127.0.0.1:'+port,{waitUntil:'domcontentloaded'});
  await offline.waitForFunction(()=>document.getElementById('data-label').textContent==='REQUEST FAILED');
  assert.equal((await offline.locator('#metric-slope').textContent()).trim(),'—');
  assert.equal(await offline.locator('#download').isDisabled(),true);
  assert.match(await offline.locator('#status').textContent(),/Could not retrieve/);
  await offline.close();
  console.log('Browser smoke passed: fixture-only data rendering, A/B comparison, charts, desktop/tablet/mobile and export.');
} finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
}

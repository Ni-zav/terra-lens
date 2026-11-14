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
  assert.match(await page.locator('h1').textContent(),/Find the signal/);
  await page.locator('#analyze').click();
  await page.waitForFunction(()=>document.getElementById('data-label').textContent==='NASA DATA LOADED',
    null,{timeout:15000});
  assert.match(await page.locator('#metric-slope').textContent(),/°C/);
  assert.match(await page.locator('#metric-years').textContent(),/24/);
  assert.equal(await page.locator('#download').isDisabled(),false);
  assert.equal(await page.locator('#comparison-point').count(), 0, 'No stale legacy comparison cards');
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
  assert.equal(await page.locator('.comparison-point').count(), 2);
  const visibility = await page.locator('.comparison-point').first().evaluate(el=>({
    display:getComputedStyle(el).display, width:el.getBoundingClientRect().width
  }));
  assert.ok(visibility.display!=='none' && visibility.width > 200,
    'Comparison information must be readable on mobile: '+JSON.stringify(visibility));
  console.log('Browser smoke passed: fixture-only data rendering, A/B comparison, charts, desktop/tablet/mobile and export.');
} finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
}

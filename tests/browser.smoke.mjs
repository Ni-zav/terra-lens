// Synthetic records in this test server are fixtures only, never production data.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const ROOT=fileURLToPath(new URL('../',import.meta.url)), DIST=join(ROOT,'dist');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.json':'application/json'};
const server=createServer(async(req,res)=>{
  const uri=new URL(req.url,'http://127.0.0.1');
  if(uri.pathname==='/api/power'){
    const q=uri.searchParams,code=q.get('parameters'),start=Number(q.get('start')),end=Number(q.get('end')),lat=Number(q.get('latitude')),data={};
    for(let year=start;year<=end;year++)for(let month=1;month<=12;month++){
      const date=String(year)+String(month).padStart(2,'0'),base=code==='T2M'?24:code==='RH2M'?75:5;
      data[date]=Number((base+(year-start)*.075+Math.sin((month-1)*Math.PI/6)*.9+lat*.03).toFixed(5));
    }
    res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({header:{title:'SYNTHETIC TEST FIXTURE',sources:['FIXTURE']},properties:{parameter:{[code]:data}}}));return;
  }
  const path=uri.pathname==='/'?'index.html':decodeURIComponent(uri.pathname).replace(/^\/+/, '');
  if(path.includes('..')){res.writeHead(403).end();return;}
  try{const body=await readFile(join(DIST,path));res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}).end(body)}
  catch{res.writeHead(404).end('Not found')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;
let browser;
try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#data-label')?.textContent==='NASA data loaded',null,{timeout:20000});
  assert.match(await page.locator('#metric-slope').textContent(),/°C/);
  assert.equal((await page.locator('#metric-years').textContent()).trim(),'24');
  await page.locator('#earth-globe canvas').waitFor({timeout:20000});
  await page.locator('#earth-globe canvas').click({position:{x:(await page.locator('#earth-globe canvas').boundingBox()).width/2,y:(await page.locator('#earth-globe canvas').boundingBox()).height/2}});
  assert.ok(Math.abs(Number(await page.locator('#lat-a').inputValue())+8)<.1);
  assert.ok(Math.abs(Number(await page.locator('#lon-a').inputValue())-110)<.1);
  assert.match(await page.locator('#globe-status').textContent(),/Point A · Yogyakarta/);
  assert.equal((await page.locator('.loc-a .loc-city-badge').textContent()).trim(),'Yogyakarta');
  assert.equal((await page.locator('#data-label').textContent()).trim(),'Inputs changed');
  assert.match(await page.locator('#result-context').textContent(),/^Previous result:/);
  await page.locator('#city-a').selectOption('Yogyakarta');
  await page.locator('#compare').uncheck();await page.locator('#globe-b').click();
  const box=await page.locator('#earth-globe canvas').boundingBox();
  await page.locator('#earth-globe canvas').click({position:{x:box.width/2,y:box.height/2}});
  assert.equal(await page.locator('#compare').isChecked(),true);await page.locator('#city-b').selectOption('Jakarta');
  await page.locator('#analyze').click();await page.waitForFunction(()=>document.querySelector('#data-label')?.textContent==='NASA data loaded');
  await page.locator('#tab-comparison').click();assert.equal(await page.locator('.comparison-rows .comparison-point').count(),2);
  assert.equal(await page.locator('[aria-label="Paired difference in trends"]').count(),1);
  assert.equal(await page.locator('#confidence-chart circle').count(),2);
  await page.locator('#compare-c').check();
  await page.locator('#analyze').click();await page.waitForFunction(()=>document.querySelector('#data-label')?.textContent==='NASA data loaded');
  assert.equal(await page.locator('.comparison-rows .comparison-point').count(),3);
  assert.equal(await page.locator('[aria-label="Paired difference in trends"]').count(),2);
  assert.equal(await page.locator('#confidence-chart circle').count(),3);
  await page.locator('#compare-c').uncheck();
  await page.locator('#analyze').click();await page.waitForFunction(()=>document.querySelector('#data-label')?.textContent==='NASA data loaded');
  await page.locator('#tab-annual').click();await page.locator('#tab-annual').focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#tab-monthly').getAttribute('aria-selected'),'true');
  await page.locator('#monthly-cursor').fill('0');assert.match(await page.locator('#monthly-readout').textContent(),/2001-01.*Yogyakarta.*Jakarta/);
  await page.locator('#anomaly-toggle').click();
  assert.equal(await page.locator('#anomaly-toggle').getAttribute('aria-pressed'),'true');
  await page.getByRole('group',{name:'Monthly display mode'}).getByRole('button',{name:'Values'}).click();
  await page.locator('#tab-seasonal').click();
  assert.equal(await page.locator('#tab-seasonal').getAttribute('aria-selected'),'true');
  await page.locator('#seasonal-cursor').fill('0');assert.match(await page.locator('#seasonal-readout').textContent(),/Jan.*Yogyakarta.*Jakarta/);
  await page.locator('#tab-annual').click();await page.locator('#annual-cursor').fill('0');
  assert.match(await page.locator('#annual-readout').textContent(),/2001.*Yogyakarta.*Jakarta/);
  assert.match(await page.locator('#metric-robust').textContent(),/°C/);
  const slope=await page.locator('#metric-slope').textContent();
  await page.getByRole('group',{name:'Annual chart displayed period'}).getByRole('button',{name:'10Y'}).click();
  await page.waitForFunction(()=>{const e=document.getElementById('annual-cursor');return e?.max==='9'&&e.value==='9';});
  await page.locator('#annual-cursor').fill('0');assert.match(await page.locator('#annual-readout').textContent(),/^2015/);
  assert.equal(await page.locator('#metric-slope').textContent(),slope);
  await page.getByRole('group',{name:'Annual chart displayed period'}).getByRole('button',{name:'All'}).click();
  assert.equal(await page.locator('.echart canvas').count()>0,true,'ECharts must render a chart');
  await mkdir(join(ROOT,'artifacts'),{recursive:true});
  await page.screenshot({path:join(ROOT,'artifacts','react-fixture-desktop.png')});
  for(const [width,height] of [[1440,900],[1366,768],[1280,720],[1024,768],[1000,660],[900,700],[900,660],[820,700],[800,660]]){
    await page.setViewportSize({width,height});
    for(const name of ['annual','monthly','seasonal','comparison']){
      await page.locator('#tab-'+name).click();
      const d=await page.evaluate(()=>{
        const boxes=['.controls','.location-column','.results','.chart-shell','[role="tabpanel"]'].map(selector=>{
          const e=document.querySelector(selector),r=e.getBoundingClientRect();return {selector,right:r.right,bottom:r.bottom,scroll:e.scrollHeight,client:e.clientHeight,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth};});
        const inside=[['.insight-card>a','.insight-card'],['.globe-credit','.globe-panel'],['.source-actions','.sources-card']].map(([c,p])=>({child:c,bottom:document.querySelector(c).getBoundingClientRect().bottom,parentBottom:document.querySelector(p).getBoundingClientRect().bottom}));
        return {sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,boxes,inside};
      });
      assert.ok(d.sw<=width+2,'Desktop horizontal document overflow '+JSON.stringify({width,height,name,d})); // The independent Giovanni evidence section intentionally scrolls vertically below the viewport.
      for(const b of d.boxes)assert.ok(b.right<=width+1&&b.bottom<=height+1&&b.scroll<=b.client+2&&b.scrollWidth<=b.clientWidth+2,'Desktop content clipped '+JSON.stringify({width,height,name,b}));
      for(const item of d.inside)assert.ok(item.bottom<=item.parentBottom+1,'Desktop panel overlap '+JSON.stringify({width,height,name,item}));
    }
  }
  await page.setViewportSize({width:390,height:844});await page.locator('#tab-comparison').click();
  assert.ok(await page.locator('.comparison-point').first().isVisible());
  assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=392);
  await mkdir(join(ROOT,'artifacts'),{recursive:true});await page.screenshot({path:join(ROOT,'artifacts','react-fixture-mobile.png'),fullPage:true});
  const noWebGL=await browser.newPage({viewport:{width:390,height:844}});
  await noWebGL.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args)}});
  await noWebGL.goto(`http://127.0.0.1:${port}/`);await noWebGL.locator('#earth-globe').scrollIntoViewIfNeeded();await noWebGL.locator('#earth-globe[data-error]').waitFor({timeout:20000});assert.equal(await noWebGL.locator('#lat-a').isEnabled(),true);await noWebGL.close();
  const offline=await browser.newPage({viewport:{width:1280,height:720}});
  await offline.route('**/api/power?**',route=>route.fulfill({status:503,body:'unavailable'}));
  await offline.route('**/power.larc.nasa.gov/**',route=>route.fulfill({status:503,body:'unavailable'}));
  await offline.goto(`http://127.0.0.1:${port}/`);await offline.waitForFunction(()=>document.querySelector('#data-label')?.textContent==='Request failed');
  assert.equal((await offline.locator('#metric-slope').textContent()).trim(),'—');assert.equal(await offline.locator('#download').isDisabled(),true);await offline.close();
  assert.equal(errors.length,0,errors.join('; '));
  console.log('React/ECharts browser smoke passed: fixture-only data, globe, tabs, values, layout and offline failure.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}

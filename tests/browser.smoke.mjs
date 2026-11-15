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
  const compScroll=await page.evaluate(()=>{
    const shell=document.querySelector('.chart-shell'),panel=document.querySelector('#comparison-panel');
    return {shellOverflow:shell.scrollHeight<=shell.clientHeight+1,panelScrollable:panel.clientHeight<=shell.clientHeight};
  });
  assert.ok(compScroll.shellOverflow&&compScroll.panelScrollable,'Comparison must scroll inside #comparison-panel without overflowing .chart-shell');
  await page.locator('#compare-c').uncheck();
  await page.locator('#analyze').click();await page.waitForFunction(()=>document.querySelector('#data-label')?.textContent==='NASA data loaded');
  await page.locator('#tab-annual').click();await page.locator('#tab-annual').focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#tab-monthly').getAttribute('aria-selected'),'true');
  await page.locator('#monthly-cursor').fill('0');
  await page.waitForFunction(()=>document.getElementById('monthly-readout')?.textContent.startsWith('2001-01'));
  assert.match(await page.locator('#monthly-readout').textContent(),/2001-01.*Yogyakarta.*Jakarta/);
  await page.locator('#anomaly-toggle').click();
  assert.equal(await page.locator('#anomaly-toggle').getAttribute('aria-pressed'),'true');
  await page.getByRole('group',{name:'Monthly display mode'}).getByRole('button',{name:'Values'}).click();
  await page.locator('#tab-seasonal').click();
  assert.equal(await page.locator('#tab-seasonal').getAttribute('aria-selected'),'true');
  await page.locator('#seasonal-cursor').fill('0');
  await page.waitForFunction(()=>document.getElementById('seasonal-readout')?.textContent.startsWith('Jan'));
  assert.match(await page.locator('#seasonal-readout').textContent(),/Jan.*Yogyakarta.*Jakarta/);
  await page.locator('#tab-annual').click();await page.locator('#annual-cursor').fill('0');
  await page.waitForFunction(()=>document.getElementById('annual-readout')?.textContent.startsWith('2001'));
  assert.match(await page.locator('#annual-readout').textContent(),/2001.*Yogyakarta.*Jakarta/);
  assert.match(await page.locator('#metric-robust').textContent(),/°C/);
  const slope=await page.locator('#metric-slope').textContent();
  await page.getByRole('group',{name:'Annual chart displayed period'}).getByRole('button',{name:'10Y'}).click();
  await page.waitForFunction(()=>{const e=document.getElementById('annual-cursor');return e?.max==='9'&&e.value==='9';});
  await page.locator('#annual-cursor').fill('0');
  await page.waitForFunction(()=>document.getElementById('annual-readout')?.textContent.startsWith('2015'));
  assert.match(await page.locator('#annual-readout').textContent(),/^2015/);
  assert.equal(await page.locator('#metric-slope').textContent(),slope);
  await page.getByRole('group',{name:'Annual chart displayed period'}).getByRole('button',{name:'All'}).click();
  assert.equal(await page.locator('.echart canvas').count()>0,true,'ECharts must render a chart');
  await mkdir(join(ROOT,'artifacts'),{recursive:true});
  await page.screenshot({path:join(ROOT,'artifacts','react-fixture-desktop.png')});
  await page.locator('#tab-finder').click();
  await page.locator('#finder-run').waitFor({timeout:20000});
  await page.screenshot({path:join(ROOT,'artifacts','react-fixture-finder.png')});
  await page.locator('#tab-cases').click();
  await page.locator('#science-cases-title').waitFor({timeout:20000});
  assert.match(await page.locator('#sc-snapshot-badge').textContent(),/Verified Snapshot/);
  await page.locator('#case-btn-giss').click();
  assert.equal(await page.locator('#case-btn-giss').getAttribute('aria-pressed'),'true');
  await page.locator('#case-btn-swot').click();
  await page.screenshot({path:join(ROOT,'artifacts','react-fixture-cases.png')});
  await page.locator('#tab-giovanni').click();
  await page.locator('#giovanni-heading').waitFor({timeout:20000});
  assert.match(await page.locator('#giovanni-example-heading').textContent(),/NASA Giovanni tutorial/);
  const tutorialCard=page.locator('.giovanni-tutorial').filter({has:page.locator('#giovanni-example-heading')});
  assert.match(await tutorialCard.textContent(),/original Giovanni job URL and quality flags are also undocumented/);
  assert.equal(await tutorialCard.locator('details tbody tr').count(),44);
  assert.equal(await page.locator('#nasa-source-case').count(),1);
  const regionalDownload=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download regional evidence JSON'}).click();
  const regionalEvidence=JSON.parse(await readFile(await (await regionalDownload).path(),'utf8'));
  assert.equal(regionalEvidence.monthly.length,288);
  assert.equal(regionalEvidence.annual.length,24);
  assert.equal(regionalEvidence.sourceCSV_SHA256,'ff7cd37fd010ae16015ce22400c2cb583c975c6d9277e0235cbd674d774e54dc');
  assert.match(regionalEvidence.limitations,/No quality-flag variable/);
  const tutorialDownload=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download tutorial evidence JSON'}).click();
  const tutorialEvidence=JSON.parse(await readFile(await (await tutorialDownload).path(),'utf8'));
  assert.equal(tutorialEvidence.rows.length,44);
  assert.equal(tutorialEvidence.sha256,'34193c502c6417eb1163967a33dc2b19a87ea8be5518142f6196cb77b0a2b8fd');
  assert.match(tutorialEvidence.limitations,/quality flags are unavailable/);
  await page.screenshot({path:join(ROOT,'artifacts','react-fixture-giovanni.png')});
  for(const [width,height] of [[1440,900],[1366,768],[1280,720],[1024,768],[1000,660],[900,700],[900,660],[820,700],[800,660]]){
    await page.setViewportSize({width,height});
    for(const name of ['annual','monthly','seasonal','comparison','finder','cases','giovanni']){
      await page.locator('#tab-'+name).click();
      const d=await page.evaluate(()=>{
        const boxes=['.controls','.location-column','.results','.chart-shell','[role="tabpanel"]'].map(selector=>{
          const e=document.querySelector(selector),r=e.getBoundingClientRect();return {selector,right:r.right,bottom:r.bottom,scroll:e.scrollHeight,client:e.clientHeight,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth};});
        const inside=[['.insight-card>a','.insight-card'],['.globe-credit','.globe-panel'],['.source-actions','.sources-card']].map(([c,p])=>({child:c,bottom:document.querySelector(c).getBoundingClientRect().bottom,parentBottom:document.querySelector(p).getBoundingClientRect().bottom}));
        return {sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,boxes,inside};
      });
      assert.ok(d.sw<=width+2&&d.sh<=height+2,'Desktop document overflow '+JSON.stringify({width,height,name,d}));
      for(const b of d.boxes)assert.ok(b.right<=width+1&&b.bottom<=height+1&&b.scroll<=b.client+2&&b.scrollWidth<=b.clientWidth+2,'Desktop content clipped '+JSON.stringify({width,height,name,b}));
      for(const item of d.inside)assert.ok(item.bottom<=item.parentBottom+1,'Desktop panel overlap '+JSON.stringify({width,height,name,item}));
    }
  }
  for(const [mw,mh] of [[768,1024],[390,844],[360,800]]){
    await page.setViewportSize({width:mw,height:mh});
    for(const t of ['annual','comparison','cases','giovanni']){
      await page.locator(`#tab-${t}`).click();
      assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=mw+2,`Mobile/tablet overflow at ${mw}x${mh} (${t})`);
    }
  }
  await page.setViewportSize({width:390,height:844});await page.locator('#tab-comparison').click();
  assert.ok(await page.locator('.comparison-point').first().isVisible());
  await mkdir(join(ROOT,'artifacts'),{recursive:true});await page.screenshot({path:join(ROOT,'artifacts','react-fixture-mobile.png'),fullPage:true});
  const noWebGL=await browser.newPage({viewport:{width:390,height:844}});
  await noWebGL.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args)}});
  await noWebGL.goto(`http://127.0.0.1:${port}/`);await noWebGL.locator('#earth-globe').scrollIntoViewIfNeeded();await noWebGL.locator('#earth-globe[data-error]').waitFor({timeout:20000});assert.equal(await noWebGL.locator('#lat-a').isEnabled(),true);await noWebGL.close();
  // A missing month makes an internal year incomplete in both fixture series.
  // The UI must retain the calendar-year estimate but not report gap-blind HAC.
  const gaps=await browser.newPage({viewport:{width:1280,height:720}});
  const gapErrors=[];gaps.on('pageerror',e=>gapErrors.push(e.message));
  await gaps.route('**/api/power?**',async route=>{
    const response=await route.fetch(), json=await response.json();
    const records=Object.values(json.properties.parameter)[0];
    records['201001']=-999;
    await route.fulfill({response,json});
  });
  await gaps.goto(`http://127.0.0.1:${port}/`);
  await gaps.waitForFunction(()=>document.querySelector('#data-label')?.textContent==='NASA data loaded');
  assert.match(await gaps.locator('#metric-significance-detail').textContent(),/HAC unavailable: gaps/);
  await gaps.locator('#tab-comparison').click();
  assert.match(await gaps.locator('.paired-contrast').textContent(),/HAC and Durbin–Watson require consecutive/);
  assert.match(await gaps.locator('#finding-text').textContent(),/HAC inference unavailable/);
  assert.deepEqual(gapErrors,[]);await gaps.close();
  // Simulate a superseded request whose transport ignores cancellation and
  // completes after its accelerated timeout. It must not overwrite a new result.
  const race=await browser.newPage({viewport:{width:1280,height:720}});
  await race.addInitScript(()=>{
    const originalFetch=window.fetch.bind(window), originalTimer=window.setTimeout.bind(window);
    window.__testInitialCalls=0; window.__testTimeouts=0;
    window.fetch=(input,options)=>{
      if(String(input).startsWith('/api/power?') && ++window.__testInitialCalls<=2)
        return originalFetch(input,{...options,signal:undefined});
      return originalFetch(input,options);
    };
    window.setTimeout=(fn,ms,...args)=>ms===30000
      ? originalTimer(()=>{window.__testTimeouts++;fn();},3000,...args)
      : originalTimer(fn,ms,...args);
  });
  let raceRequests=0;
  await race.route('**/api/power?**',async route=>{
    if(++raceRequests<=2)await new Promise(resolve=>setTimeout(resolve,4500));
    await route.continue().catch(()=>{});
  });
  await race.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded'});
  await race.waitForFunction(()=>window.__testInitialCalls>=2);
  await race.locator('#lat-a').fill('-8.1');
  await race.locator('#analyze').click();
  await race.waitForFunction(()=>document.querySelector('#data-label')?.textContent==='NASA data loaded');
  await race.waitForTimeout(5000);
  assert.equal(await race.evaluate(()=>window.__testTimeouts),1,'The superseded request must actually reach its timeout');
  assert.equal((await race.locator('#data-label').textContent()).trim(),'NASA data loaded');
  assert.match(await race.locator('#status').textContent(),/Loaded 2 NASA points/);
  assert.equal(await race.locator('#lat-a').inputValue(),'-8.1');
  await race.close();
  // The checked-in NASA area export is used here as a real-source integration
  // fixture; the synthetic POWER responses remain limited to this test server.
  const area=await browser.newPage({viewport:{width:1280,height:720},acceptDownloads:true});
  await area.goto(`http://127.0.0.1:${port}/`);
  await area.waitForFunction(()=>document.querySelector('#data-label')?.textContent==='NASA data loaded');
  await area.locator('#tab-giovanni').click();
  await area.getByRole('heading',{name:'Explore NASA Giovanni cases'}).waitFor();
  let catalogCalls=0;
  await area.route('https://cmr.earthdata.nasa.gov/search/collections.json?*',route=>{catalogCalls++;return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({feed:{entry:[{id:'C123-TEST',title:'Synthetic catalog test collection',short_name:'TEST',version_id:'1'}]}})})});
  await area.route('https://cmr.earthdata.nasa.gov/search/variables.umm_json?*',route=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({hits:1,items:[{meta:{'concept-id':'V123-TEST'},umm:{Name:'TESTVAR',LongName:'Synthetic variable',Units:'K',FillValues:[{Value:9999}]},associations:{collections:[{'concept-id':'C123-TEST'}]}}]})}));
  await area.locator('#catalog-term').fill('soil moisture');
  await area.locator('#catalog-search').click();
  await area.getByText('Synthetic catalog test collection').waitFor();
  await area.locator('#catalog-search').click();
  await area.getByText(/collection records returned \(cached\)/).waitFor();
  assert.equal(catalogCalls,1,'repeat catalog request should use bounded memory cache');
  await area.getByRole('button',{name:'View variables for TEST'}).click();
  await area.getByRole('link',{name:'TESTVAR'}).waitFor();
  assert.match(await area.getByRole('region',{name:'Catalog variable results'}).innerText(),/unit K.*declared fill 9999/);
  await area.locator('#catalog-variable-filter').fill('not-present');
  assert.equal(await area.getByRole('link',{name:'TESTVAR'}).count(),0);
  await area.locator('#catalog-variable-filter').fill('testvar');
  await area.getByRole('link',{name:'TESTVAR'}).waitFor();
  assert.match(await area.locator('#panel-giovanni').textContent(),/no upload needed/i);
  assert.match(await area.locator('#panel-giovanni').textContent(),/separate NASA POWER point investigation/i);
  assert.match(await area.locator('#panel-giovanni').textContent(),/cannot be confidently translated into extra heatwave days per summer/i);
  assert.match(await area.locator('#panel-giovanni').textContent(),/reprocessed September 2020 and June–September 2021/i);
  await area.locator('#region-west').fill('-123');await area.locator('#region-east').fill('-121');
  await area.locator('#region-south').fill('35');await area.locator('#region-north').fill('37');
  const query=await area.locator('#giovanni-region-query').getAttribute('href');
  assert.equal(new URLSearchParams(new URL(query).hash.slice(1)).get('bbox'),'-123,35,-121,37');
  await area.locator('#giovanni-file').setInputFiles(join(ROOT,'data/source-snapshots/g4.areaAvgTimeSeries.M2TMNXSLV_5_12_4_T2M.20010101-20241231.110E_8S_111E_7S.csv'));
  await area.getByText(/288 monthly records, 24 complete years/).waitFor();
  assert.match(await area.locator('#sources').textContent(),/Copied links do not include the imported Giovanni file/);
  assert.match(await area.locator('#provenance-text').textContent(),/G is a user-imported Giovanni area-averaged product/);
  await area.locator('#tab-comparison').click();
  assert.match(await area.locator('#comparison-panel').textContent(),/spatial support differs/);
  // Synthetic cloud import fixture: a declared fill month must not create a
  // complete year or enter the calculated trend.
  await area.locator('#tab-giovanni').click();
  const syntheticCloud=['param_name,T2M','unit,K','fill_value,1e15'];
  for(let year=2001;year<=2010;year++) for(let month=1;month<=12;month++)
    syntheticCloud.push(`${year}-${String(month).padStart(2,'0')}-01,${year===2001&&month===1?'1e15':280}`);
  await area.locator('#giovanni-file').setInputFiles({name:'synthetic-cloud-test.csv',mimeType:'text/csv',buffer:Buffer.from(syntheticCloud.join('\n'))});
  await area.getByText(/119 monthly records, 9 complete years/).waitFor();
  assert.match(await area.locator('.giovanni-summary').textContent(),/Not enough complete years/i);
  await area.close();
  const deepLink=await browser.newPage({viewport:{width:1280,height:720}});
  await deepLink.goto(`http://127.0.0.1:${port}/#giovanni`);
  await deepLink.getByRole('heading',{name:'Explore NASA Giovanni cases'}).waitFor();
  assert.equal(await deepLink.locator('#tab-giovanni').getAttribute('aria-selected'),'true');
  await deepLink.close();
  const offline=await browser.newPage({viewport:{width:1280,height:720}});
  await offline.route('**/api/power?**',route=>route.fulfill({status:503,body:'unavailable'}));
  await offline.route('**/power.larc.nasa.gov/**',route=>route.fulfill({status:503,body:'unavailable'}));
  await offline.goto(`http://127.0.0.1:${port}/`);await offline.waitForFunction(()=>document.querySelector('#data-label')?.textContent==='Request failed');
  assert.equal((await offline.locator('#metric-slope').textContent()).trim(),'—');assert.equal(await offline.locator('#download').isDisabled(),true);await offline.close();
  // Experimental regional finder: synthetic fixture is allowed for UI tests ONLY.
  const finderPage=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
  const finderErrors=[];finderPage.on('pageerror',e=>finderErrors.push(e.message));
  await finderPage.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded'});
  await finderPage.locator('#tab-finder').click();
  await finderPage.locator('#finder-run').waitFor({timeout:25000});
  assert.equal(await finderPage.locator('.discovery-table tbody tr').count(),8,'All eight declared sites must be shown before scanning');
  await finderPage.locator('#finder-run').click();
  await finderPage.waitForFunction(()=>document.getElementById('finder-status')?.textContent.includes('Finished:'),
    null,{timeout:45000});
  assert.match(await finderPage.locator('#finder-status').textContent(),/8 trends/);
  assert.equal(await finderPage.locator('.discovery-table tbody tr').count(),8);
  assert.equal(await finderPage.locator('.discovery-table [aria-pressed=true]').count(),2);
  assert.ok((await finderPage.evaluate(()=>document.documentElement.scrollWidth))<=392,
    'Discovery screen must not cause mobile page overflow');
  const expectedHref=await finderPage.locator('.discovery-inspect').getAttribute('href');
  assert.match(expectedHref,/auto=1/);
  assert.match(expectedHref,/compare=1/);
  const finderDownloaded=finderPage.waitForEvent('download');
  await finderPage.locator('#finder-download').click();
  const downloadResult=await finderDownloaded;
  const evidence=JSON.parse(await readFile(await downloadResult.path(),'utf8'));
  assert.equal(evidence.schema,'terra-lens-sentinel-screen-v1');
  assert.equal(evidence.records.length,8);
  assert.equal(evidence.count.successes,8);
  assert.equal(evidence.protocol.maxConcurrency,3);
  assert.match(evidence.brief.uncertainty,/post-selection/);
  assert.ok(evidence.records.every(r=>r.sourceURL?.includes('power.larc.nasa.gov')));
  assert.equal(finderErrors.length,0,finderErrors.join('; '));
  await finderPage.close();
  assert.equal(errors.length,0,errors.join('; '));
  console.log('React/ECharts browser smoke passed: fixture-only data, globe, tabs, values, layout and offline failure.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}

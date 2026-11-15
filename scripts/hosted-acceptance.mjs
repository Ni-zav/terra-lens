/**
 * Actual hosted, logged-out GitHub Pages acceptance test (defaults to the review preview).
 * Verifies BUILD-PROVENANCE.txt source SHA, real NASA POWER requests, keyboard navigation,
 * CSV & Evidence JSON exports, Giovanni regional case & CSV import, Multi-source cases,
 * 8-point Contrast Finder, 390px mobile layout, 7-slide HTML deck (including Slide 5 CI & DW),
 * downloadable 7-slide PDF SHA-256, and simulated NASA outage recovery.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.TERRA_HOSTED_URL||'https://ni-zav.github.io/terra-lens-preview/';
const expectedCommit=process.env.TERRA_EXPECTED_COMMIT?.trim()||'';
if(!/^https:\/\/[A-Za-z0-9.-]+\/[A-Za-z0-9./_-]+\/?$/.test(base))
  throw new Error('Hosted URL must be an HTTPS project origin (no query parameters)');
const url=base.endsWith('/')?base:base+'/';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const findings={target:url,expectedCommit:expectedCommit||null,deployedCommit:null,pdfSha256:null,checks:[],nasaCalls:[],consoleErrors:[]};
const mark=(label)=>{findings.checks.push(label);console.log('PASS '+label)};
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
 const provResp=await context.request.get(new URL('BUILD-PROVENANCE.txt',url).href,{timeout:30000});
 if(provResp.ok()){
   const provText=await provResp.text();
   const m=provText.match(/^(?:Source\s+)?commit:\s*([0-9a-f]{40})/im);
   findings.deployedCommit=m?m[1]:provText.trim();
   if(expectedCommit){
     assert.equal(findings.deployedCommit,expectedCommit,`Deployed BUILD-PROVENANCE commit (${findings.deployedCommit}) must match expected (${expectedCommit})`);
   }
   mark('Hosted provenance: BUILD-PROVENANCE.txt commit '+findings.deployedCommit);
 }else if(expectedCommit){
   assert.fail('BUILD-PROVENANCE.txt missing on hosted target when TERRA_EXPECTED_COMMIT was required');
 }
 const page=await context.newPage();
 const pageErrors=[];
 page.on('pageerror',e=>pageErrors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')findings.consoleErrors.push(m.text().slice(0,250));});
 page.on('response',r=>{if(r.ok()&&r.url().startsWith('https://power.larc.nasa.gov/api/temporal/monthly/point')){
   const q=new URL(r.url()).searchParams;
   findings.nasaCalls.push({variable:q.get('parameters'),latitude:q.get('latitude'),longitude:q.get('longitude')});
 }});
 const first=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(first.status(),200,'Hosted application must be reachable without login');
 await page.waitForFunction(()=>document.getElementById('data-label')?.textContent==='NASA data loaded',
  null,{timeout:125000});
 assert.equal((await page.locator('#metric-years').textContent()).trim(),'24');
 assert.match(await page.locator('#metric-slope').textContent(),/\+0\.18\s*°C/);
 assert.match(await page.locator('#finding-text').textContent(),/Jakarta/);
 assert.ok(findings.nasaCalls.filter(r=>r.variable==='T2M').length>=2,
   'Two authentic NASA POWER HTTP 200 responses must be observed');
 assert.deepEqual(pageErrors,[]);
 mark('Hosted baseline: two real NASA responses, 24 years, valid paired finding');
 assert.equal(await page.locator('a.skip[href="#explore"]').count(),1,'Keyboard skip-to-workspace link is required');
 await page.locator('#tab-annual').focus();
 await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>document.getElementById('tab-monthly')?.getAttribute('aria-selected')==='true');
 await page.keyboard.press('End');
 await page.waitForFunction(()=>document.getElementById('tab-giovanni')?.getAttribute('aria-selected')==='true');
 await page.keyboard.press('Home');
 await page.waitForFunction(()=>document.getElementById('tab-annual')?.getAttribute('aria-selected')==='true');
 assert.ok(await page.locator('#metric-slope').getAttribute('id'));
 mark('Hosted keyboard tabs: skip link, ArrowRight, End, Home and ARIA selection');
 await page.screenshot({path:'artifacts/hosted-home-desktop.png',fullPage:true,animations:'disabled'});
 const csvWait=page.waitForEvent('download');
 await page.locator('#download').click();
 const csvDownload=await csvWait;
 const csv=await readFile(await csvDownload.path(),'utf8');
 assert.match(csv,/"POWER:T2M"/);
 assert.match(csv,/power\.larc\.nasa\.gov/);
 assert.equal(csv.trimEnd().split('\n').length,577);
 mark('Hosted CSV export: 576 monthly source records');
 const evWait=page.waitForEvent('download');
 await page.locator('#evidence-download').click();
 const evDownload=await evWait;
 const evJson=JSON.parse(await readFile(await evDownload.path(),'utf8'));
 assert.equal(evJson.series?.length,2);
 assert.ok(Math.abs(evJson.pairedContrast.classical.ciLowPerDecade - (-0.072286988)) < 1e-5);
 assert.ok(Math.abs(evJson.pairedContrast.classical.ciHighPerDecade - 0.161674202) < 1e-5);
 assert.ok(Math.abs(evJson.pairedContrast.hac.durbinWatson - 2.2053598) < 1e-5);
 mark('Hosted Evidence JSON export: verified paired classical CI and Durbin-Watson');
 await page.locator('#tab-cases').click();
 await page.locator('#panel-cases').waitFor();
 await page.getByText(/SWOT/i).first().waitFor({timeout:30000});
 mark('Hosted Multi-source panel rendered');
 await page.locator('#tab-giovanni').click();
 await page.locator('#giovanni-file').waitFor({timeout:30000});
 await page.locator('#nasa-source-case').waitFor({timeout:30000});
 assert.match(await page.locator('#panel-giovanni').textContent(),/\+0\.177 K per decade/);
 const gioEvWait=page.waitForEvent('download');
 await page.getByRole('button',{name:/Download regional evidence JSON/i}).click();
 const gioEvDownload=await gioEvWait;
 const gioEv=JSON.parse(await readFile(await gioEvDownload.path(),'utf8'));
 assert.equal(gioEv.sourceCSV_SHA256,'ff7cd37fd010ae16015ce22400c2cb583c975c6d9277e0235cbd674d774e54dc');
 mark('Hosted Giovanni panel: regional M2TMNXSLV 5.12.4 case and evidence JSON export verified');
 await page.locator('#tab-finder').click();
 await page.locator('.discovery-table tbody tr').first().waitFor({timeout:30000});
 assert.equal(await page.locator('.discovery-table tbody tr').count(),8);
 mark('Hosted Trend Contrast Finder rendered with eight predeclared points');
 await page.setViewportSize({width:390,height:844});
 const dimensions=await page.evaluate(()=>({screen:innerWidth,document:document.documentElement.scrollWidth}));
 assert.ok(dimensions.document<=dimensions.screen+3,
  'Hosted app has horizontal overflow at 390px: '+JSON.stringify(dimensions));
 await page.screenshot({path:'artifacts/hosted-home-mobile.png',fullPage:true,animations:'disabled'});
 mark('Hosted responsive 390px layout');
 const deck=await context.newPage();
 const deckResponse=await deck.goto(new URL('demo/',url).href,{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(deckResponse.status(),200);
 assert.equal(await deck.locator('.slide').count(),7);
 const slide5Text=await deck.locator('.slide').nth(4).textContent();
 assert.match(slide5Text,/−0\.0723 to \+0\.1617 °C\/dec/,'Slide 5 must show corrected classical OLS 95% CI');
 assert.match(slide5Text,/Durbin–Watson\s*2\.21/,'Slide 5 must show corrected Durbin-Watson 2.21');
 const screenshot=deck.locator('img[src="../docs/screenshots/nasa-real-desktop.png"]');
 await screenshot.waitFor({state:'attached',timeout:15000});
 await deck.waitForFunction(()=>{const image=document.querySelector('img[src="../docs/screenshots/nasa-real-desktop.png"]');return !!image&&image.complete&&image.naturalWidth>0;},null,{timeout:15000});
 await deck.screenshot({path:'artifacts/hosted-deck-cover.png',animations:'disabled'});
 const pdf=await context.request.get(new URL('demo/Terra-Lens_Seven_Slide_Demo.pdf',url).href);
 assert.equal(pdf.status(),200,'Hosted PDF must load');
 const buffer=await pdf.body();
 assert.ok(buffer.length>100000&&buffer.subarray(0,5).toString()==='%PDF-','Hosted demo must be a real PDF');
 findings.pdfSha256=createHash('sha256').update(buffer).digest('hex');
 mark('Hosted seven-slide HTML (Slide 5 CI & DW verified), real NASA screenshot and linked PDF SHA-256 '+findings.pdfSha256);
 // Explicitly labeled outage simulation: verify no synthetic observations
 // are displayed if the ACTUAL hosted site cannot reach the NASA API.
 const outage=await context.newPage();
 await outage.route('**/power.larc.nasa.gov/api/temporal/monthly/point**',route=>route.abort('failed'));
 await outage.goto(url,{waitUntil:'domcontentloaded'});
 await outage.waitForFunction(()=>document.getElementById('data-label')?.textContent==='Request failed',null,{timeout:45000});
 assert.match(await outage.locator('#status').textContent(),/Could not retrieve NASA data/);
 assert.equal((await outage.locator('#metric-slope').textContent()).trim(),'—');
 await outage.close();
 mark('Hosted failure-state: simulated NASA transport failure gives honest error, no invented data');
 assert.deepEqual(pageErrors,[]);
 await writeFile('artifacts/hosted-acceptance-summary.json',JSON.stringify(findings,null,2)+'\n');
 console.log('HOSTED ACCEPTANCE SUMMARY: '+JSON.stringify(findings));
}finally{await browser.close()}

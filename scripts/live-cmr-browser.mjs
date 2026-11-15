// Live NASA CMR integration check. No fixture data or credentials.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','4176'],{stdio:'ignore'});
let browser;
try{
 for(let i=0;i<40;i++){
  try{if((await fetch('http://127.0.0.1:4176/')).ok)break}catch{}
  await new Promise(r=>setTimeout(r,250));
  if(i===39)throw Error('Preview server did not start');
 }
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const responses=[];
 page.on('response',r=>{if(r.url().startsWith('https://cmr.earthdata.nasa.gov/search/collections.json'))responses.push({status:r.status(),url:r.url()})});
 await page.goto('http://127.0.0.1:4176/#giovanni',{waitUntil:'domcontentloaded'});
 await page.locator('#catalog-term').fill('M2TMNXSLV');
 await page.locator('#catalog-search').click();
 const results=page.getByText(/collection records returned/),error=page.locator('#panel-giovanni [role=alert]');
 await Promise.race([results.waitFor({timeout:70000}),error.waitFor({timeout:70000})]);
 if(await error.isVisible())throw Error(await error.innerText());
 assert.ok(responses.some(r=>r.status===200),'NASA CMR must return HTTP 200');
 assert.match(await page.locator('#panel-giovanni').innerText(),/M2TMNXSLV/);
 const resultLink=page.locator('a[href*="C1276812859-GES_DISC"]').first();await resultLink.waitFor();
 const q=new URL(responses[0].url).searchParams;
 assert.equal(q.get('bounding_box'),'110,-8,111,-7');assert.equal(q.get('page_size'),'10');
 const before=responses.length;await page.locator('#catalog-search').click();
 await page.getByText(/collection records returned \(cached\)/).waitFor();assert.equal(responses.length,before);
 console.log('PASS live NASA CMR browser search, requested region and in-memory cache');
}finally{await browser?.close();server.kill('SIGTERM')}

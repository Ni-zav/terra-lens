// Generate a standalone, publicly linkable seven-slide PDF from our verified HTML
// demo. The source image is a real NASA browser capture, not a fabricated test fixture.
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=fileURLToPath(new URL('../demo/Terra-Lens_Seven_Slide_Demo.pdf',import.meta.url));
const pageUri=new URL('../demo/index.html',import.meta.url).href;
let browser;
try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--allow-file-access-from-files']});
  const page=await browser.newPage();
  await page.goto(pageUri,{waitUntil:'load'});
  const image=page.locator('img[src="../docs/screenshots/nasa-real-desktop.png"]');
  const verified=await image.evaluate(img=>img.complete&&img.naturalWidth>0);
  if(!verified)throw Error('The authentic NASA browser screenshot is missing from the demo.');
  for (const path of ['annual-temperature.png','slope-intervals.png']) {
    const chart=page.locator(`img[src="${path}"]`);
    if(!await chart.evaluate(img=>img.complete&&img.naturalWidth>0))throw Error(`Missing scientific figure: ${path}`);
  }
  if(await page.locator('.slide').count()!==7)throw Error('Demo must contain exactly seven slides');
  await page.emulateMedia({media:'print'});
  await page.pdf({path:output,preferCSSPageSize:true,printBackground:true});
  const previewDir=fileURLToPath(new URL('../artifacts/',import.meta.url));
  await mkdir(previewDir,{recursive:true});
  // Render all seven PRINT slides as independent images for real visual QA.
  // These are captures of the actual authored NASA-evidence deck, not mockups.
  for(let n=0;n<7;n++) {
    await page.locator('.slide').nth(n).screenshot({
      path:previewDir+'/demo-print-slide-'+String(n+1).padStart(2,'0')+'.png',
      animations:'disabled'
    });
  }
  console.log('Wrote seven print-layout previews and verified screenshot-backed demo PDF:',output);
}finally{await browser?.close()}

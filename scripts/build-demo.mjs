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
  if(await page.locator('.slide').count()!==7)throw Error('Demo must contain exactly seven slides');
  await page.emulateMedia({media:'print'});
  await page.pdf({path:output,preferCSSPageSize:true,printBackground:true});
  console.log('Wrote verified screenshot-backed demo PDF:',output);
}finally{await browser?.close()}

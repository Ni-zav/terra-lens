// Responsive seven-slide story regression. This checks REAL deck HTML and its
// public NASA browser screenshot; no fixture values are presented as science.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const url = new URL('../demo/index.html', import.meta.url).href;
let browser;
try {
  browser = await chromium.launch({headless:true,args:['--no-sandbox','--allow-file-access-from-files']});
  for (const width of [360,390,430,768,1024,1280,1440]) {
    const page=await browser.newPage({viewport:{width,height:900}});
    const errs=[];
    page.on('pageerror',err=>errs.push(err.message));
    await page.goto(url,{waitUntil:'load'});
    assert.equal(await page.locator('.slide').count(),7);
    const image=page.locator('img[src="../docs/screenshots/nasa-real-desktop.png"]');
    assert.equal(await image.evaluate(img=>img.complete && img.naturalWidth>0),true,
      'Authentic NASA browser screenshot must load at '+width);
    for(let slide=0;slide<7;slide++){
      if(slide)await page.locator('#next').click();
      assert.equal(await page.locator('.slide.active').count(),1);
      assert.match(await page.locator('#counter').textContent(),
        new RegExp('Slide '+(slide+1)+' of 7'));
      const dims=await page.evaluate(()=>{
        const e=document.querySelector('.slide.active');
        const bound=e.getBoundingClientRect();
        return {scroll:document.documentElement.scrollWidth,
          width:window.innerWidth, slideScroll:e.scrollHeight, slideClient:e.clientHeight,
          blockWidth:bound.width,overflow:getComputedStyle(e).overflow};
      });
      assert.ok(dims.scroll<=dims.width+3,'Deck overflows at '+width+' slide '+(slide+1)+': '+JSON.stringify(dims));
      // At desktop fixed-slide widths, hidden overflow would silently clip content.
      if(width>1050)assert.ok(dims.slideScroll<=dims.slideClient+5,
        'Slide content clipped at '+width+' slide '+(slide+1)+': '+JSON.stringify(dims));
      if(width<=1050)assert.notEqual(dims.overflow,'hidden',
        'Responsive story must allow vertical content reflow at '+width);
    }
    assert.equal(errs.length,0,'Browser errors at '+width+': '+errs.join('; '));
    await page.close();
  }
  console.log('Seven-slide browser story passed at 360/390/430/768/1024/1280/1440px; screenshot loaded, no page overflow or desktop clipping.');
} finally {await browser?.close();}

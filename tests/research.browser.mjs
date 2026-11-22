/**
 * Real Chromium against dist. Uses archived NASA responses on a local route.
 * Invalid, missing, revision and outage replies are test-only mutations.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync, spawn} from 'node:child_process';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'artifacts', '2.0');
await mkdir(output, {recursive:true});
const local = [
  await readFile(join(root,'data/source-snapshots/power-2001-2024/power-yogyakarta.json'),'utf8'),
  await readFile(join(root,'data/source-snapshots/power-2001-2024/power-jakarta.json'),'utf8')
].map(JSON.parse);
const vite = spawn(process.execPath, [resolve(root,'node_modules/vite/bin/vite.js'), 'preview',
  '--host', '127.0.0.1', '--port', '0'], {cwd:root});
const base = await new Promise((resolveURL, reject) => {
  vite.once('error', reject);
  vite.once('exit', code => reject(new Error('Preview exited '+code)));
  vite.stdout.on('data', buffer => {
    const match = String(buffer).match(/http:\/\/127\.0\.0\.1:\d+\//);
    if (match) resolveURL(match[0]);
  });
});
const checks = {};
const pageErrors = [];
const manifest = {};
const near = (a,b,t=1e-7) => assert.ok(Math.abs(a-b)<t, `${a} versus ${b}`);
async function save(page, file, click, summary) {
  const event = page.waitForEvent('download');
  await click();
  const download = await event;
  assert.equal(await download.failure(),null);
  const path = join(output,file);
  await download.saveAs(path);
  const bytes = await readFile(path);
  manifest[file] = {suggestedFilename: download.suggestedFilename(),
    sha256:createHash('sha256').update(bytes).digest('hex'), bytes:bytes.length};
  const raw = new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if (!file.endsWith('.json')) return raw;
  const result = JSON.parse(raw);
  assert.doesNotMatch(raw, /\b(?:NaN|Infinity)\b/);
  if (summary) Object.assign(manifest[file],summary(result));
  return result;
}
function csv(file) {
  return JSON.parse(execFileSync('python3', ['-c', `
import csv, json, sys
with open(sys.argv[1], newline='', encoding='utf-8') as stream:
    print(json.dumps(list(csv.DictReader(stream))))
`,join(output,file)],{maxBuffer:4_000_000}).toString());
}
async function snapshot(page, name, fullPage = false) {
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:join(output,name+'.png'),fullPage,animations:'disabled'});
}
function annualFromMonths(months, year) {
  const records = months.filter(month=>month.year===year);
  const weights = records.map(month=>new Date(Date.UTC(year,month.month,0)).getUTCDate());
  return records.reduce((value,month,i)=>value+month.value*weights[i],0) / weights.reduce((a,b)=>a+b,0);
}
async function waitStatus(page, pattern) {
  await page.waitForFunction(str=>new RegExp(str).test(document.querySelector('#data-label')?.textContent||''),pattern.source);
}
const browser = await chromium.launch();
try {
  const context = await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true, reducedMotion:'reduce',
    permissions:['clipboard-read','clipboard-write']});
  context.on('page', page=>page.on('pageerror',error=>pageErrors.push(error.message)));
  let requests = 0;
  let mode = 'archive';
  await context.route(/(?:\/api\/power|power\.larc\.nasa\.gov\/api\/temporal\/monthly\/point)\?/, async route => {
    requests++;
    const params = new URL(route.request().url()).searchParams;
    const latitude = Number(params.get('latitude'));
    if (mode==='outage'||(mode==='partial'&&latitude===-6.2088)) {
      await route.fulfill({status:503,body:'test-only upstream timeout'});
      return;
    }
    const payload = structuredClone(local[latitude===-6.2088 ? 1 : 0]);
    const values = payload.properties.parameter.T2M;
    if (mode==='revision') values['200101'] += 1;
    if (mode==='gap') values['201001'] = -999;
    if (mode==='short') for (const key of Object.keys(values)) if (key.slice(0,4)>2009) delete values[key];
    if (mode==='empty') for (const key of Object.keys(values)) values[key] = -999;
    if (mode==='negative') values['200101'] = -2.5;
    await route.fulfill({json:payload});
  });

  const page = await context.newPage();
  await page.goto(base);
  const visible = await page.locator('#understand .research-result').innerText();
  assert.match(visible,/2001–2024.*\+0,179 °C per dekade.*titik grid model/);
  assert.equal(requests,0,'Default must not require a NASA request');
  assert.ok((await page.locator('.research-limit').boundingBox()).y<900);
  await snapshot(page,'understand-desktop-id');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').getAttribute('class'),'skip');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator(':focus').getAttribute('id'),'understand');
  await page.getByRole('button',{name:'English'}).focus();
  await page.keyboard.press('Enter');
  assert.match(await page.locator('.research-result').innerText(),/\+0\.179 °C per decade/);
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.match(await page.locator('.research-pair').innerText(),/does not establish a difference/);
  await page.getByRole('link',{name:'Sources and methods',exact:true}).click();
  await page.waitForURL('**/#verify');
  await snapshot(page,'verify-archive-en');
  const archived = await save(page,'archive-evidence.json',()=>page.getByRole('button',{name:'Download Evidence JSON'}).click(),
    value=>({months:value.series.map(s=>s.monthly.length),annual:value.series.map(s=>s.annual.length)}));
  assert.equal(archived.schema,'terra-lens-evidence-v2');
  assert.equal(archived.interpretation.comparisons[0].findingStatus,'difference-not-established');
  assert.match(archived.series[0].provenance.archive.run,/43579062738/);
  assert.equal(archived.series[0].provenance.retrievedAt,null);
  assert.equal(archived.series[0].provenance.sourceMode,'snapshot');
  for (const s of archived.series) {
    assert.equal(s.monthly.length,288);
    assert.equal(s.annual.length,24);
    assert.equal(s.variable.unit,'°C');
    assert.equal(s.coverage.missingMonths,0);
    for (const row of s.annual) near(row.value,annualFromMonths(s.monthly,row.year));
  }
  near(archived.series[0].ols.slopePerDecade,.179141281);
  near(archived.comparisons[0].contrast.hac.ciLowPerDecade,-.057415991);
  await save(page,'archive-months.csv',()=>page.getByRole('button',{name:'Download CSV'}).click());
  const archiveRows=csv('archive-months.csv');
  manifest['archive-months.csv'].rows=archiveRows.length;
  assert.equal(archiveRows.length,576);
  assert.deepEqual(Object.keys(archiveRows[0]), ['series','location','latitude','longitude','spatial_support','variable','year','month','value','unit','source_url','retrieved_at','source_mode','captured_at']);
  assert.equal(archiveRows[0].latitude,'-7.7956');
  assert.equal(archiveRows[0].longitude,'110.3695');
  assert.equal(archiveRows[0].unit,'°C');
  assert.equal(archiveRows[0].retrieved_at,'');
  assert.equal(archiveRows[0].source_mode,'snapshot');
  assert.equal(archiveRows[0].source_url,archived.series[0].provenance.url);
  assert.ok(archiveRows.every(row=>!row.retrieved_at&&row.captured_at===archived.series[0].provenance.capturedAt));
  for (const [i,row] of archiveRows.entries()) {
    const value=archived.series[Math.floor(i/288)].monthly[i%288];
    assert.equal(+row.value,value.value);
    assert.equal(+row.year,value.year);
    assert.equal(+row.month,value.month);
  }
  await page.getByRole('link',{name:'Open research brief'}).click();
  await page.locator('.research-brief').waitFor();
  for (const lang of ['en','id']) {
    await page.getByRole('button',{name:lang==='en'?'English':'Bahasa Indonesia'}).click();
    await snapshot(page,'brief-'+lang,true);
    const inAppPDF = await page.pdf({path:join(output,`app-brief-${lang}.pdf`),preferCSSPageSize:true,tagged:true});
    assert.equal((inAppPDF.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,1);
    const file=`research-brief-${lang}.html`;
    await save(page,file,async()=>{
      await page.locator('.brief-tools button').first().focus();
      await page.keyboard.press('Enter');
    });
    const report=await context.newPage();
    await report.goto(pathToFileURL(join(output,file)).href);
    const evidence=JSON.parse(await report.locator('#brief-evidence').textContent());
    assert.equal(evidence.locale,lang);
    assert.ok(Number.isFinite(Date.parse(evidence.generatedAt)));
    assert.deepEqual(evidence.evidence.interpretation,archived.interpretation);
    assert.equal(await report.locator('html').getAttribute('lang'),lang);
    assert.match(await report.locator('article').innerText(),lang==='id'?/pulau panas perkotaan.*BMKG/s:/urban heat islands.*BMKG/s);
    for (const link of ['power.larc.nasa.gov/api','staklim-yogya.bmkg.go.id','43579062738']) {
      assert.equal(await report.locator(`a[href*="${link}"]`).count(),1);
    }
    assert.match(await report.locator('article footer').innerText(), lang==='id'?/Hanya untuk kajian awal riset/:/Research screening only/);
    assert.equal(await report.locator('h1').count(),1);
    const pdf=await report.pdf({path:join(output,`research-brief-${lang}.pdf`), preferCSSPageSize:true, tagged:true});
    assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,1);
    manifest[file].embeddedMonths=evidence.evidence.series.map(s=>s.monthly.length);
    await report.close();
  }
  checks['S01/S02/S03/S09/E01/E02/E06/U01/U03/U06']='Archive data, locale parity, raw/annual rows, paired HAC, two one-page reports, keyboard skip and locale persistence';
  await page.getByRole('button',{name:'English'}).click();
  await page.locator('nav a[href="#explore"]').click();
  await waitStatus(page,/NASA data loaded/);
  assert.ok(requests>=2);
  assert.match(await page.locator('#metric-slope').innerText(),/\+0\.18 °C/);
  await save(page,'investigation-months.csv',()=>page.locator('#download').click());
  const liveRows=csv('investigation-months.csv');
  manifest['investigation-months.csv'].rows=liveRows.length;
  assert.equal(liveRows.length,576);
  assert.ok(liveRows.every(r=>r.source_mode==='freshly-fetched'&&Number.isFinite(Date.parse(r.retrieved_at))));
  await page.locator('#share').click();
  const share=await page.evaluate(()=>navigator.clipboard.readText());
  assert.equal(new URL(share).searchParams.get('latA'),'-7.7956');
  const reopened=await context.newPage();
  const before=requests;
  await reopened.goto(share);
  await waitStatus(reopened,/NASA data loaded/);
  assert.ok(requests>before);
  await reopened.close();

  // The imported label is user-controlled. CSV text is neutralized while negative numbers stay numeric.
  await page.locator('#tab-giovanni').click();
  await page.locator('#giovanni-product').waitFor();
  const imported = offset => ['param_name,T2M','unit,°C','lat,-7.8','lon,110.3',
    ...Array.from({length:120},(_,i)=>`${2001+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')},${offset+i/100}`)].join('\n');
  for (const trigger of ['=','+','-','@']) {
    const product=`${trigger}SUM(1,2) Suhu "Yogyakarta" °C`;
    await page.locator('#giovanni-product').fill(product);
    await page.locator('#giovanni-file').setInputFiles({name:'test-user.csv',mimeType:'text/csv',buffer:Buffer.from(imported(-25))});
    await page.locator('.giovanni-summary').getByText(product,{exact:false}).waitFor();
    await save(page,`import-text-${trigger.charCodeAt(0)}.csv`,()=>page.locator('#download').click());
    const rows=csv(`import-text-${trigger.charCodeAt(0)}.csv`).filter(row=>row.series==='G');
    assert.equal(rows.length,120);
    assert.equal(rows[0].location,`'${product} (Giovanni)`);
    assert.equal(rows[0].latitude,'-7.8');
    assert.equal(rows[0].value,'-25');
    assert.equal(rows[0].source_mode,'user-imported');
    manifest[`import-text-${trigger.charCodeAt(0)}.csv`].rows=696;
  }
  await page.locator('#tab-annual').click();
  await page.getByRole('button',{name:'Giovanni import (G)'}).click();
  await page.locator('.legend').getByText(/SUM/).waitFor();
  assert.doesNotMatch(await page.locator('.legend').innerText(),/Jakarta/);
  await page.locator('#tab-comparison').click();
  assert.match(await page.locator('#comparison-panel').innerText(),/validated only for two NASA POWER/);
  const withImport=await save(page,'mixed-evidence.json',()=>page.locator('#evidence-download').click(),
    value=>({months:value.series.map(s=>s.monthly.length),comparisons:value.comparisons.length}));
  assert.equal(withImport.series[2].provenance.authenticated,false);
  assert.equal(withImport.series[2].monthly.length,120);
  assert.equal(withImport.interpretation.comparisons[1].findingStatus,'incompatible');
  near(withImport.comparisons[0].contrast.hac.slopePerDecade,.044693606655);
  await page.locator('#tab-giovanni').click();
  const invalid = [
    [imported(9)+'\n2001-01,11',/Multiple samples/], ['time,value\n2001-01,1',/must include param_name/],
    ['',/must include param_name/], ['param_name,T2M\nunit,K\n2001-02-31,280',/Invalid calendar date/],
    ['param_name,T2M\nunit,K\nfrequency,daily\n2001-01-01,280',/cadence is not monthly/],
    ['param_name,T2M\nunit,K\n2001-01-01 24:00:00,280',/Invalid time of day/],
    ['x'.repeat(12_000_001),/too large/]
  ];
  for (const [body,pattern] of invalid) {
    await page.locator('#giovanni-file').setInputFiles({name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from(body)});
    await page.locator('#panel-giovanni').getByRole('alert').filter({hasText:pattern}).waitFor();
    assert.match(await page.locator('.giovanni-summary').innerText(),/@SUM/);
  }
  await page.locator('#giovanni-file').setInputFiles(join(root,'data/source-snapshots/g4.areaAvgTimeSeries.M2TMNXSLV_5_12_4_T2M.20010101-20241231.110E_8S_111E_7S.csv'));
  await page.locator('.giovanni-summary').getByText(/288 monthly records/).waitFor();
  const area=await save(page,'area-import-evidence.json',()=>page.locator('#evidence-download').click(),
    value=>({months:value.series.map(s=>s.monthly.length),comparisons:value.comparisons.length}));
  assert.equal(area.series[2].provenance.authenticated,false);
  assert.deepEqual(area.series[2].provenance.requestedBounds,[110,-8,111,-7]);
  assert.equal(area.series[2].variable.unit,'K');
  assert.equal(area.comparisons[1].contrast,null);
  await page.locator('#tab-giovanni').click();
  for (const [key,name,count] of [['regional','region',288],['tutorial','tutorial',44]]) {
    const exported=await save(page,`giovanni-${name}.json`,()=>page.getByRole('button',{name:`Download ${key} evidence JSON`}).click(),
      value=>({records:(value.monthly??value.rows).length}));
    assert.equal((exported.monthly??exported.rows).length,count);
    assert.match(exported.limitations,/quality/i);
    assert.equal(exported.sourceMode,'snapshot');
    if (key==='regional') assert.equal(exported.retrievedAt,'2026-11-15T01:42:21Z');
  }

  for (const [label, extension, sha] of [
    ['Preserved original CSV','csv','ff7cd37fd010ae16015ce22400c2cb583c975c6d9277e0235cbd674d774e54dc'],
    ['Preserved original NetCDF','nc','d9a320f77ef79b65ec6dba4454e247c700b420cb4966270cf677f88f75f74668']
  ]) {
    const event=page.waitForEvent('download');
    await page.getByRole('link',{name:label,exact:true}).click();
    const artifact=await event;
    const file=join(output,'giovanni-original.'+extension);
    await artifact.saveAs(file);
    const bytes=await readFile(file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);
    manifest['giovanni-original.'+extension]={suggestedFilename:artifact.suggestedFilename(),sha256:sha,bytes:bytes.length};
  }
  await page.locator('#tab-cases').click();
  await page.getByText(/Related evidence for context only/).waitFor();
  await snapshot(page,'gistemp-context-desktop');
  const giss=await save(page,'gistemp-archive.json',()=>page.getByRole('button',{name:'Export Case JSON'}).click(),
    value=>({months:value.advanced.sources.map(s=>s.monthly.length),annual:value.advanced.sources.map(s=>s.annual.length)}));
  assert.equal(giss.advanced.differencesNotTested,true);
  const [localSource,globalSource]=giss.advanced.sources;
  assert.equal(localSource.sourceMode,'snapshot');
  assert.equal(localSource.coordinates.lat,-7.7956);
  assert.equal(localSource.originalUnit,'°C');
  assert.match(localSource.sourceURL,/power\.larc\.nasa\.gov/);
  assert.equal(globalSource.sourceMode,'snapshot');
  assert.equal(globalSource.snapshotDate,'2026-11-14');
  assert.equal(globalSource.originalBaseline,'1951–1980');
  assert.equal(globalSource.transformedBaseline,'2001–2020');
  assert.equal(globalSource.originalMonthly.length,288);
  assert.equal(globalSource.annual.length,24);
  near(globalSource.trend.slopePerDecade,.2503698558210228);
  await page.locator('#sc-reverify-giss').click();
  await page.getByText('Live POWER + Dated GISS Table').waitFor();
  const refreshed=await save(page,'gistemp-power-refresh.json',()=>page.getByRole('button',{name:'Export Case JSON'}).click(),
    value=>({months:value.advanced.sources.map(s=>s.monthly.length),annual:value.advanced.sources.map(s=>s.annual.length)}));
  assert.equal(refreshed.advanced.sources[0].sourceMode,'freshly-fetched');
  assert.deepEqual(refreshed.advanced.sources[1].originalMonthly.map(({year,month,value})=>[year,month,value]),
    globalSource.originalMonthly.map(({year,month,value})=>[year,month,value]));
  assert.equal(refreshed.advanced.sources[1].snapshotDate,globalSource.snapshotDate);
  assert.equal(refreshed.advanced.sources[1].sourceMode,'snapshot');
  mode='outage';
  await page.locator('#sc-reverify-giss').click();
  await page.getByText(/POWER refresh failed/).waitFor();
  assert.match(await page.locator('#sc-snapshot-badge').innerText(),/Verified Snapshot/);
  mode='archive';
  await page.locator('#case-btn-swot').click();
  await page.getByText(/Three shared months are insufficient/).waitFor();
  await snapshot(page,'swot-context-desktop');
  await page.getByRole('button',{name:'Inspect all 12 SWOT passes & QA flags'}).click();
  assert.equal(await page.locator('#case-swot-view tbody tr').count(),12);
  const swot=await save(page,'swot-archive.json',()=>page.getByRole('button',{name:'Export Snapshot JSON'}).click(),
    value=>({overpasses:value.swot.observations.length,months:value.caseStudy.advanced.harmonization.pairs.length}));
  assert.equal(swot.sourceMode,'snapshot');
  assert.equal(swot.swot.collection,'SWOT_L2_HR_RiverSP_D');
  assert.deepEqual(swot.swot.qualityCounts,{'0':0,'1':10,'2':2,'3':0});
  assert.ok(swot.swot.observations.every(o=>Number.isFinite(Date.parse(o.time))&&o.unit==='m'));
  assert.match(swot.swot.sourceURL,/feature_id=74267300251/);
  assert.equal(swot.power.unit,'mm/day');
  assert.equal(swot.caseStudy.advanced.association.status,'insufficient');
  assert.ok(!Object.hasOwn(swot.caseStudy.advanced.association,'pValue'));
  await page.locator('#tab-finder').click();
  await page.locator('#finder-run').click();
  await page.locator('#finder-status').filter({hasText:/Finished:.*8 trends/}).waitFor();
  const finderBefore=requests;
  await page.locator('#finder-run').click();
  await page.locator('.discovery-table').getByText('NASA data · cached').first().waitFor();
  await page.locator('#finder-status').filter({hasText:/Finished:.*8 trends/}).waitFor();
  assert.equal(requests,finderBefore);
  const finder=await save(page,'finder-evidence.json',()=>page.locator('#finder-download').click(),
    value=>({records:value.records.length,months:value.records.map(r=>r.monthly.length)}));
  assert.equal(finder.records.length,8);
  assert.equal(finder.selectionInference,'exploratory-selected');
  assert.ok(finder.records.every(r=>r.sourceMode==='cached'&&Number.isFinite(Date.parse(r.retrievedAt))));
  assert.match(await page.locator('.discovery-paired').innerText(),/Exploratory only/);
  const link=await page.locator('.discovery-inspect').getAttribute('href');
  assert.equal(new URL(link).searchParams.get('screen'),'1');
  await page.locator('.discovery-inspect').click();
  await waitStatus(page,/NASA data loaded/);
  await page.locator('#tab-comparison').click();
  await page.getByText(/Re-fetching the selected pair/).waitFor();
  const selected=await save(page,'finder-pair-investigation.json',()=>page.locator('#evidence-download').click(),
    value=>({months:value.series.map(r=>r.monthly.length),comparisons:value.comparisons.length}));
  assert.equal(selected.interpretation.comparisons[0].findingStatus,'exploratory-selected');
  checks['S08/S10']='Eight-point scan and repeat using original cached timestamps, Finder and post-selected investigation downloads';
  checks['C01–C09/E03–E05/E07/E09/E10']='Real downloads with independent CSV parser, large multi-series JSON, incompatible Giovanni retained separately, GISS refresh/metadata, 12 dated SWOT passes';

  await page.goto(base+'?variable=not-a-variable&latA=999&auto=1');
  await waitStatus(page,/Request failed/);
  assert.match(await page.locator('#status').innerText(),/Unsupported/);
  assert.ok(await page.locator('#download').isDisabled());
  await page.goto(base+'?latA=999&auto=1');
  await waitStatus(page,/Request failed/);
  assert.match(await page.locator('#status').innerText(),/Invalid coordinates/i);
  assert.ok(await page.locator('#download').isDisabled());

  await page.goto(base+'#explore');
  await waitStatus(page,/NASA data loaded/);
  await page.locator('#end').fill('2023');
  await waitStatus(page,/Inputs changed/);
  assert.ok(await page.locator('#evidence-download').isDisabled());
  await page.locator('nav a[href="#understand-investigation"]').click();
  await page.getByText(/Settings have changed/).waitFor();
  assert.equal(await page.locator('main .research-meta').count(),0);
  await page.locator('nav a[href="#explore"]').click();
  await page.locator('#end').fill('2024');
  mode='gap';
  await page.locator('#analyze').click();
  await waitStatus(page,/NASA data loaded/);
  await page.locator('#tab-monthly').click();
  await page.locator('#monthly-cursor').fill('108');
  await page.getByText(/2010-01.*no record/).waitFor();
  const gap=await save(page,'gap-evidence.json',()=>page.locator('#evidence-download').click(),
    value=>({months:value.series.map(s=>s.monthly.length),annual:value.series.map(s=>s.annual.length)}));
  assert.equal(gap.series[0].coverage.missingMonths,1);
  assert.equal(gap.series[0].annual.length,23);
  assert.equal(gap.interpretation.comparisons[0].findingStatus,'unavailable-inference');
  assert.equal(gap.comparisons[0].contrast.hac,null);

  mode='short';
  await page.locator('#analyze').click();
  await waitStatus(page,/NASA data loaded/);
  await page.locator('nav a[href="#understand-investigation"]').click();
  await page.locator('.research-result').filter({hasText:/At least 10 complete calendar years/}).waitFor();
  assert.doesNotMatch(await page.locator('.research-result').innerText(),/°C per decade/);
  await page.locator('nav a[href="#explore"]').click();
  mode='empty';
  await page.locator('#analyze').click();
  await waitStatus(page,/Request failed/);
  assert.equal(await page.locator('#metric-slope').innerText(),'—');

  mode='partial';
  await page.locator('#analyze').click();
  await waitStatus(page,/NASA data loaded/);
  assert.match(await page.locator('#status').innerText(),/Point B could not load/);
  await page.locator('nav a[href="#understand-investigation"]').click();
  await page.getByText(/Some points failed/).waitFor();
  assert.equal(await page.locator('.research-pair').count(),0);
  await page.locator('nav a[href="#explore"]').click();
  mode='outage';
  await page.locator('#analyze').click();
  await waitStatus(page,/Request failed/);
  await page.locator('nav a[href="#understand-investigation"]').click();
  await page.getByText(/NASA data for this request are unavailable/).waitFor();
  assert.doesNotMatch(await page.locator('.research-result').innerText(),/°C per decade/);
  mode='revision';
  await page.getByRole('button',{name:'Retry',exact:true}).click();
  await page.locator('.research-meta').filter({hasText:'Fetched from NASA POWER'}).waitFor();
  await page.getByRole('link',{name:'Sources and methods',exact:true}).click();
  const revision=await save(page,'revision-evidence.json',()=>page.getByRole('button',{name:'Download Evidence JSON'}).click(),
    value=>({months:value.series.map(s=>s.monthly.length),annual:value.series.map(s=>s.annual.length)}));
  assert.notEqual(revision.series[0].ols.slopePerDecade,archived.series[0].ols.slopePerDecade);
  assert.equal(revision.series[0].monthly[0].value,archived.series[0].monthly[0].value+1);
  checks['S04–S08/S10/C10/E08/U07–U09']='Adverse browser replies, scope and share selection, live retry, no fallback counts, revised source evidence. Weak and contradictory states also covered in node tests.';

  const mobile=await context.newPage({viewport:{width:390,height:844}});
  await mobile.addInitScript(()=>{
    const context = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:context.call(this,type,...args)};
  });
  await mobile.setViewportSize({width:390,height:844});
  await mobile.goto(base);
  await mobile.getByRole('button',{name:'Bahasa Indonesia'}).click();
  for (const width of [1024,768,390,360,320]) {
    await mobile.setViewportSize({width,height:844});
    assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Understand overflow at ${width}px`);
  }
  await mobile.setViewportSize({width:390,height:844});
  await snapshot(mobile,'understand-mobile-id');
  assert.ok((await mobile.locator('.research-limit').boundingBox()).y<844);
  await mobile.getByRole('link',{name:'Buka ringkasan riset'}).click();
  await snapshot(mobile,'brief-mobile-id',true);
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mobile.locator('nav a[href="#explore"]').click();
  await mobile.locator('#earth-globe').scrollIntoViewIfNeeded();
  await mobile.locator('#earth-globe[data-error]').waitFor();
  assert.ok(await mobile.locator('#lat-a').isEnabled());
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for (const [hash, tab] of [['#giovanni','giovanni'],['#science-cases','cases'],['#contrast-finder','finder'],['#tab-comparison','comparison'],['#sources','annual']]) {
    await mobile.goto(base+hash);
    if (hash!=='#sources') await mobile.locator('#tab-'+tab+'[aria-selected=true]').waitFor();
    else await mobile.locator('#sources').waitFor();
  }
  checks['U02/U04/U05']='Mobile widths 320–1024, reduced motion, disabled WebGL and alternative controls, named chart, verified deep links.';
  assert.deepEqual(pageErrors,[]);
} finally {
  await writeFile(join(output,'download-manifest.json'),JSON.stringify({checks, files:manifest},null,2)+'\n');
  await browser.close();
  vite.kill();
}
console.log('Terra-Lens 2.0 browser acceptance passed. Download paths and hashes: '+join(output,'download-manifest.json'));

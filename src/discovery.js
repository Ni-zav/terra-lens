/**
 * A bounded, predeclared sentinel sample. This is NOT a spatially representative
 * raster, random sample, population exposure estimate or exhaustive search.
 */
import {annualMeans, linearTrend} from './stats.js';
import {pairedContrast} from './contrast.js';
import {VARIABLES} from './power.js';

export const SENTINEL_POINTS = Object.freeze([
  {id:'aceh',label:'Banda Aceh',lat:5.5483,lon:95.3238},
  {id:'medan',label:'Medan',lat:3.5952,lon:98.6722},
  {id:'jakarta',label:'Jakarta',lat:-6.2088,lon:106.8456},
  {id:'bandung',label:'Bandung',lat:-6.9175,lon:107.6191},
  {id:'yogyakarta',label:'Yogyakarta',lat:-7.7956,lon:110.3695},
  {id:'surabaya',label:'Surabaya',lat:-7.2575,lon:112.7521},
  {id:'denpasar',label:'Denpasar',lat:-8.6500,lon:115.2167},
  {id:'makassar',label:'Makassar',lat:-5.1477,lon:119.4327}
].map(point=>Object.freeze(point)));

export const INVESTIGATIONS = Object.freeze({
  T2M: {
    question:'Which sampled places merit closer investigation of long-term near-surface air temperature change?',
    audience:'Local science groups and climate educators',
    next:'Check official station records, exposure and local topography before proposing heat-adaptation priorities.',
    cannot:'No heat illness, heatwave frequency, city average or future risk can be inferred from monthly model point means.'
  },
  T2M_MAX: {
    question:'Where do modeled monthly averages of daily high temperatures show different fitted long-term changes?',
    audience:'Researchers exploring daytime heat conditions',
    next:'Check daily extreme-heat thresholds and independent weather stations before discussing human heat exposure.',
    cannot:'This is NOT the highest temperature reached or a heatwave-frequency metric.'
  },
  RH2M: {
    question:'How have modeled near-surface relative-humidity averages changed at selected points?',
    audience:'Public health and environmental research educators',
    next:'Pair with temperature and exposure observations before discussing thermal comfort or health.',
    cannot:'Relative humidity alone is not wet-bulb temperature, a health hazard index or a causal attribution.'
  },
  PRECTOTCORR: {
    question:'Where is the modeled average daily precipitation rate changing across these selected points?',
    audience:'Water, farming and watershed research groups',
    next:'Validate with gauges, rainy-season timing, runoff and agricultural conditions before making resource decisions.',
    cannot:'The unit is mm/day averaged across months, NOT annual rainfall total, flood probability or drought severity.'
  }
});
export function investigationFor(variable) {
  return INVESTIGATIONS[variable] || {
    question:'What historical change does the selected NASA POWER variable suggest at these points?',
    audience:'Students, educators and research communicators',
    next:'Check the meaning, units and independent measurements before a local recommendation.',
    cannot:'A monthly reanalysis point trend is not a causal finding, whole-area measurement, forecast or risk score.'
  };
}
function abortError() { const e=new Error('Investigation cancelled'); e.name='AbortError'; return e; }
function message(error) {
  // Never export a stack trace, token or entire server response.
  return error instanceof Error ? error.message.slice(0,200) : 'NASA request failed';
}
/**
 * Concurrent NASA sampling with an immutable predeclared request budget.
 * Records include errors and insufficient coverage; no silently skipped points.
 * The caller must AbortController-cancel superseded browser runs.
 */
export async function samplePoints({points=SENTINEL_POINTS,variable='T2M',start=2001,end=2024,
  fetchPoint,signal,concurrency=3,onProgress=()=>{}}) {
  if (!Object.hasOwn(VARIABLES,variable)) throw new RangeError('Unsupported NASA POWER variable');
  if (!Number.isInteger(start)||!Number.isInteger(end)||start<1981||end>2025||end-start<9)
    throw new RangeError('Use at least 10 calendar years between 1981 and 2025');
  if (!Array.isArray(points)||points.length<2||points.length>12||
    new Set(points.map(p=>p.id)).size!==points.length) throw new RangeError('Expected 2–12 uniquely named sampling points');
  if (!Number.isInteger(concurrency)||concurrency<1||concurrency>3) throw new RangeError('Concurrency must be 1–3');
  if (typeof fetchPoint!=='function') throw new TypeError('A NASA data fetcher is required');
  const records=Array(points.length);
  let next=0,completed=0;
  const worker=async()=>{
    while(next<points.length) {
      if(signal?.aborted)throw abortError();
      const index=next++;
      const point=points[index];
      let record;
      try {
        const source=await fetchPoint({lat:point.lat,lon:point.lon,variable,start,end},{signal});
        if(signal?.aborted)throw abortError();
        if(!Array.isArray(source.monthly))throw new Error('NASA response lacks monthly records');
        const annual=annualMeans(source.monthly);
        const trend=linearTrend(annual);
        record={...point,status:trend?'ok':'insufficient-years',monthly:source.monthly,annual,trend,
          source:source.source||'NASA POWER',sourceURL:source.url||null,
          retrievedAt:source.fetchedAt||null,metadata:source.metadata||{},variable,
          cacheHit:Boolean(source.cacheHit)};
      } catch(error) {
        if(signal?.aborted||error?.name==='AbortError')throw abortError();
        record={...point,status:'error',error:message(error),monthly:[],annual:[],trend:null,variable};
      }
      records[index]=record;
      completed++;
      onProgress({completed,total:points.length,records:records.filter(Boolean)});
    }
  };
  await Promise.all(Array.from({length:Math.min(concurrency,points.length)},worker));
  if(signal?.aborted)throw abortError();
  return records;
}
export function summarizeDiscovery(records,expected=SENTINEL_POINTS) {
  const byId=new Map(records.map(r=>[r.id,r]));
  const ordered=expected.map(p=>byId.get(p.id)).filter(Boolean);
  const ranked=ordered.filter(r=>r.status==='ok'&&Number.isFinite(r.trend?.slopePerDecade))
    .sort((a,b)=>a.trend.slopePerDecade-b.trend.slopePerDecade||a.id.localeCompare(b.id));
  const failures=ordered.filter(r=>r.status==='error');
  const insufficient=ordered.filter(r=>r.status==='insufficient-years');
  const low=ranked[0]||null,high=ranked.at(-1)||null;
  const oppositeSigns=Boolean(low&&high&&low.trend.slopePerDecade<0&&high.trend.slopePerDecade>0);
  return {
    expectedCount:expected.length,receivedCount:ordered.length,completed:ordered.length===expected.length,
    ranked,failures,insufficient,low,high,oppositeSigns,
    candidatePairs:ranked.length*(ranked.length-1)/2,
    // This is a data-selected pair; its p-value MUST NOT be used as confirmatory evidence.
    selectedPair:low&&high&&low.id!==high.id?pairedContrast(low.annual,high.annual):null
  };
}
export function makeResearchBrief(summary,variable,start,end) {
  const inv=investigationFor(variable);
  const unit=VARIABLES[variable].unit;
  const scope=`${summary.receivedCount}/${summary.expectedCount} points returned · ${summary.ranked.length} trend estimates · ${summary.failures.length} failures · ${summary.insufficient.length} insufficient-year series`;
  let finding='No reliable ranking: fewer than two valid fitted point trends.';
  if(summary.low&&summary.high&&summary.low.id!==summary.high.id) {
    finding=`Among only the analyzed sample, ${summary.low.label} has the lowest fitted slope (${summary.low.trend.slopePerDecade.toFixed(3)} ${unit}/decade) and ${summary.high.label} the highest (${summary.high.trend.slopePerDecade.toFixed(3)} ${unit}/decade). ${summary.oppositeSigns?'Fitted slopes have opposite signs.':'No opposite-sign extremes were found.'}`;
  }
  return {
    question:inv.question,audience:inv.audience,scope,period:`${start}–${end}`,
    finding:summary.completed?finding:'Provisional only: not all predeclared NASA points have finished. '+finding,
    responsibleAction:inv.next,
    doNotConclude:inv.cannot,
    uncertainty:'Ranking is descriptive and selected after looking at the same data. Separate OLS p-values are not tests of spatial differences; post-selection paired HAC tests are exploratory and uncorrected for searching multiple points. NASA POWER point estimates do not represent city populations or prove cause.',
    validation:'Replicate the selected pair on shared complete years; seek independent station or satellite observations, check temporal autocorrelation, spatial support and model uncertainty. Do not use this screening result alone to allocate public resources.'
  };
}
export function discoveryEvidence({records,variable,start,end,selected}) {
  const summary=summarizeDiscovery(records);
  return {
    schema:'terra-lens-sentinel-screen-v1',
    generatedAt:new Date().toISOString(),
    question:investigationFor(variable).question,
    protocol:{
      frame:'Eight predeclared Indonesian sentinel coordinate points; convenience sample, no raster interpolation or geographic representativeness',
      framePoints:SENTINEL_POINTS,variable,unit:VARIABLES[variable].unit,start,end,
      plannedRequests:SENTINEL_POINTS.length,maxConcurrency:3,
      aggregation:'Day-weighted monthly means, only complete 12-month calendar years',
      inference:'Per-point classical OLS descriptive screening. Extreme pair selected after reviewing same data; paired HAC exploratory only. No multiple-testing correction or causal claims.'
    },
    count:{expected:summary.expectedCount,completed:summary.receivedCount,
      successes:summary.ranked.length,failures:summary.failures.length,insufficient:summary.insufficient.length,
      possiblePairs:summary.candidatePairs},
    records:records.map(r=>({...r})),
    selected: selected||null,
    brief:makeResearchBrief(summary,variable,start,end)
  };
}

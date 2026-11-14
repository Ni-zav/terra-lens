/**
 * UI-independent orchestration for progressive disclosure.
 * No browser DOM, no map library, and no credentials are required.
 * Use with custom fetcher/Cloudflare proxy where browser CORS blocks NASA.
 */
import {fetchSWOT,SWOT_EXAMPLE} from './swot.js';
import {fetchNASA} from '../power.js';
import {fetchGISTEMP,fetchGISTEMPtext,parseGISTEMP,parseGISTEMPtext} from './gistemp.js';
import {compareLocalGlobal} from './gistemp.js';
import {buildWaterCase} from './interconnect.js';

const isLat=lat=>Number.isFinite(lat)&&lat>=-90&&lat<=90;
const isLon=lon=>Number.isFinite(lon)&&lon>=-180&&lon<=180;
function checkedPoint(point){
  if(!isLat(point?.lat)||!isLon(point?.lon))throw RangeError('A valid NASA POWER latitude and longitude are required');
  return {lat:point.lat,lon:point.lon,label:point.label||'Selected NASA POWER grid point'};
}
export async function analyzeRiverContext({
    featureId=SWOT_EXAMPLE.featureId,start=SWOT_EXAMPLE.start,end=SWOT_EXAMPLE.end,
    powerPoint={lat:38.2527,lon:-85.7585,label:'Louisville sample grid point'},
    maxQuality=2,year=2025
  }={},{
    swotFetcher=fetchNASACompatibleFetch,powerFetcher=fetch,
    signal
  }={}){
  const point=checkedPoint(powerPoint);
  if(!Number.isInteger(year)||year<1981||year>2025)
    throw RangeError('Choose an available NASA POWER calendar year');
  // No source records are invented: both adapters require real responses.
  const [swot,power]=await Promise.all([
    fetchSWOT({featureId,start,end,maxQuality},{fetcher:swotFetcher,signal}),
    fetchNASA({...point,variable:'PRECTOTCORR',start:year,end:year},
      {fetcher:powerFetcher,signal})
  ]);
  const result=buildWaterCase({swot,power,
    contextLocation:`SWOT river reach ${featureId}; nearby NASA POWER grid point ${point.label} (${point.lat}, ${point.lon}). No watershed spatial harmonization.`});
  return {...result,context:{featureId,point,
    connectivity:'SWOT RiverSP and NASA POWER are aligned by calendar month only. This is a context display, not causal model.'}};
}
async function fetchNASACompatibleFetch(url,opts){return fetch(url,opts);}
export async function analyzeLocalGlobal({
  powerPoint={lat:-7.7956,lon:110.3695,label:'Yogyakarta sampling point'},
  from=2001,to=2024,baselineStart=2001,baselineEnd=2020,
  // For reliable offline/hosted demo pass the exact NASA official table text.
  // Supported: CSV (direct GISS format) or TXT (hundredths of °C table).
  gistempSourceText=null,gistempSourceFormat='txt'
}={},{
  powerFetcher=fetch,gistempFetcher=fetch,signal
}={}){
  const point=checkedPoint(powerPoint);
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<1981||to>2025||to-from<9)
    throw RangeError('Need at least 10 complete calendar years in POWER coverage');
  if(!(from<=baselineStart&&baselineStart<=baselineEnd&&baselineEnd<=to))
    throw RangeError('Baseline must be fully inside the requested analysis period');
  let global;
  if(gistempSourceText!==null){
    global=(gistempSourceFormat==='csv'?parseGISTEMP:parseGISTEMPtext)(gistempSourceText);
    global.sourceURL=gistempSourceFormat==='csv'
      ?'https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv'
      :'https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.txt';
    global.note+=' Caller-supplied text: verify original NASA source and download date independently.';
  }else{
    try {global=await fetchGISTEMP({fetcher:gistempFetcher,signal});}
    catch(error){
      if(signal?.aborted||error?.name==='AbortError')throw error;
      global=await fetchGISTEMPtext({fetcher:gistempFetcher,signal});
    }
  }
  const power=await fetchNASA({...point,variable:'T2M',start:from,end:to},
    {fetcher:powerFetcher,signal});
  const result=compareLocalGlobal({
    localPowerMonthly:power.monthly,globalGISTEMP:global,from,to,
    baselineStart,baselineEnd
  });
  return {...result,context:{point,globalAcquisition:global.note||'Direct GISS request',
    localSourceURL:power.url,localRetrievedAt:power.fetchedAt,
    caveat:'Date and global-local support differences must be shown before any decision.'}};
}

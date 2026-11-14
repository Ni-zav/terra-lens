/**
 * Process an authentic participant-downloaded NASA Giovanni MONTHLY time series.
 * Never authenticates to NASA; requires actual CSV and independently sourced
 * product/DOI/URL metadata. Refuses unlabeled or sparse files. No synthetic
 * data, tokens or Earthdata secrets go in the resulting evidence.
 *
 * GIOVANNI_CSV_FILE=/secure/path/original.csv
 * GIOVANNI_PRODUCT_ID=M2TMNXSLV
 * GIOVANNI_PRODUCT_DOI=10.xxxx/yyyy
 * GIOVANNI_DATA_URL=https://giovanni.gsfc.nasa.gov/giovanni/... 
 * node scripts/verify-giovanni-source.mjs
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseGiovanniMonthlyCSV} from '../src/giovanni.js';
import {annualMeans,linearTrend} from '../src/stats.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const {GIOVANNI_CSV_FILE, GIOVANNI_PRODUCT_ID, GIOVANNI_PRODUCT_DOI, GIOVANNI_DATA_URL}=process.env;
if(!GIOVANNI_CSV_FILE||!GIOVANNI_PRODUCT_ID||!GIOVANNI_PRODUCT_DOI||!GIOVANNI_DATA_URL)
  throw new Error('Set GIOVANNI_CSV_FILE, GIOVANNI_PRODUCT_ID, GIOVANNI_PRODUCT_DOI, GIOVANNI_DATA_URL from actual NASA export. No sample substitutions.');
if(!/^[A-Za-z0-9_.:-]{5,128}$/.test(GIOVANNI_PRODUCT_ID))
  throw new Error('Invalid declared NASA collection identifier');
if(!/^10\.\d{4,9}\/\S+$/.test(GIOVANNI_PRODUCT_DOI))
  throw new Error('Specify the real NASA collection DOI from its official product page');
const sourceUrl=new URL(GIOVANNI_DATA_URL);
if(sourceUrl.protocol!=='https:'||!(sourceUrl.hostname==='nasa.gov'||sourceUrl.hostname.endsWith('.nasa.gov')))
  throw new Error('NASA source URL must be HTTPS and hosted on a verified NASA domain');
const bytes=await readFile(GIOVANNI_CSV_FILE);
if(bytes.byteLength>12_000_000)throw new Error('Original CSV exceeds 12 MB');
const decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
const parsed=parseGiovanniMonthlyCSV(decoded);
const annual=annualMeans(parsed.monthly);
const trend=linearTrend(annual);
if(!trend)throw new Error('NASA export has fewer than ten complete calendar years; cannot assert a statistically tested trend');
const evidence={
  schema:'terra-lens-giovanni-real-source-evidence-v1',
  generatedAt:new Date().toISOString(),
  sourceClaimsRequireManualNASAReview:true,
  originalCSV:{
    sha256:createHash('sha256').update(bytes).digest('hex'),
    sizeBytes:bytes.byteLength,
    nasaExportURL:sourceUrl.href,
    exactFilePreservedOutsideGit:true
  },
  declaredProduct:{
    collectionId:GIOVANNI_PRODUCT_ID,
    collectionDOI:GIOVANNI_PRODUCT_DOI,
    provider:'NASA GES DISC Giovanni'
  },
  originalMetadata:parsed.metadata,
  originalMonthlyRecords:parsed.monthly,
  derivedDayWeightedCompleteYears:annual,
  classicalOLS:trend,
  limitations:[
    'A local CSV file and caller-supplied URL/DOI cannot prove NASA origin without independent source review.',
    'Monthly CSV point/area definition, units, product version and physical QA must be verified in Giovanni and collection documentation.',
    'Classical OLS assumes independent residuals; climate autocorrelation may invalidate p-values and 95% intervals.',
    'Missing/incomplete years excluded without interpolation; derived annual day weighted aggregation may differ from NASA portal aggregation.',
    'This execution alone does not certify 2026 NASA challenge Resources-tab source eligibility.'
  ]
};
const target=process.env.GIOVANNI_EVIDENCE_OUTPUT
  ? resolve(process.env.GIOVANNI_EVIDENCE_OUTPUT)
  :join(root,'artifacts','giovanni-source-evidence.json');
await mkdir(dirname(target),{recursive:true});
await writeFile(target,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({
  state:'NASA-provenance-pending-independent-review',
  reportedProduct:evidence.declaredProduct,
  sha256:evidence.originalCSV.sha256,
  monthlyRows:parsed.monthly.length,
  completeYears:annual.length,
  period:trend.start+'–'+trend.end,
  claimedUnit:parsed.metadata.unit,
  slopePerDecade:trend.slopePerDecade,
  classicalP:trend.pValue,
  evidencePath:target,
  next:'Run python scripts/verify-giovanni-source-python.py; inspect unmodified original CSV and official NASA product page manually.'
},null,2));

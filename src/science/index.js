// Stable frontend integration surface. Import from this file, not internal paths.
export {SCIENCE_CATALOG,SCIENCE_QUESTIONS,scienceForAudience} from './catalog.js';
export {SWOT_EXAMPLE,SWOT_RIVER_COLLECTION,HYDROCRON_URL,swotRequestURL,
  parseSWOTHydrocron,swotMonthlySnapshots,fetchSWOT} from './swot.js';
export {GISTEMP_CSV_URL,GISTEMP_TXT_URL,parseGISTEMP,parseGISTEMPtext,
  fetchGISTEMP,fetchGISTEMPtext,rebaseMonthlyAnomalies,compareLocalGlobal} from './gistemp.js';
export {powerMonthlyContext,alignSWOTandPOWER,descriptiveAssociation,
  buildWaterCase} from './interconnect.js';
export {analyzeRiverContext,analyzeLocalGlobal} from './engine.js';
export {parseGiovanniAreaCSV, analyzeGiovanniArea} from './giovanni-case.js';

# Terra-Lens data/science engine — frontend integration contract

**Branch:** `feat/nasa-multisource-science-20261114` in `Ni-zav/terra-lens`. This branch adds **NO React/CSS/visualization edits** and must not be merged to `main` without the user's approval. The UI/design work can proceed on a different branch in parallel.

## Why this is better than more standalone charts

The user can ask a question in plain language; the backend returns a **short, responsible answer** plus a separate **advanced** source-level evidence bundle. The same scientific record drives both; the frontend must not fabricate monthly values or substitute decorative imagery for observations.

### Stable imports

```js
import {
  SCIENCE_CATALOG, SCIENCE_QUESTIONS, scienceForAudience,
  analyzeRiverContext, analyzeLocalGlobal,
  fetchSWOT, parseSWOTHydrocron, swotMonthlySnapshots,
  parseGISTEMPtext, compareLocalGlobal, buildWaterCase
} from './src/science/index.js';
```

`scienceForAudience()` returns a catalog for the default/simple UI. `scienceForAudience({advanced:true})` exposes all sources and even planned capabilities, **clearly labeled as planned**.

### Ready-to-use question 1: river satellite + nearby precipitation context

```js
const result = await analyzeRiverContext({
  featureId: '74267300251',
  start: '2025-03-15T00:00:00Z',
  end: '2025-05-16T00:00:00Z',
  powerPoint: {lat: 38.2527, lon: -85.7585, label:'Louisville-area grid cell'},
  maxQuality: 2, // include degraded satellite overpasses WITH flags visible
  year: 2025
}, {signal: controller.signal});

// First screen: result.simple.title, .whatChanged, .where,
// .observationCount, .commonMonths, .nextStep, .limitation
// Advanced drawer: result.advanced.sourceA/B, .harmonization, .association
```

This makes **real NASA requests**. For a static GitHub Pages frontend, Hydrocron's browser CORS behavior needs an acceptance test. An optional authenticated team-controlled proxy may be needed; never store Earthdata credentials in frontend code. The repo has a Cloudflare Pages proxy for POWER, but Hydrocron has **not** been proxied yet. For a robust demo use the dated GitHub Actions evidence artifact or checked-in review-branch source snapshot rather than inventing values during network failure.

The Ohio River reach is a real, *specific SWORD ID*, not a free-form geocoded city or arbitrary point. You cannot click anywhere and claim there is a SWOT river reach under that pixel without SWORD discovery.

### Ready-to-use question 2: local reanalysis vs global observed temperature index

```js
import sourceTxt from './data/source-snapshots/nasa-giss-gistemp-global-2001-2024.txt?raw'; // Vite
const result = await analyzeLocalGlobal({
  powerPoint:{lat:-7.7956,lon:110.3695,label:'Near Yogyakarta'},
  from:2001,to:2024,
  baselineStart:2001,baselineEnd:2020,
  gistempSourceText:sourceTxt,gistempSourceFormat:'txt'
}, {signal:controller.signal});
// result.simple is one short answer with BOTH rates and limitations;
// result.advanced contains ORIGINAL records, rebased monthly anomalies,
// full-year annual derived anomalies, trend objects and methodological caveats.
```

This is reliable without a direct NASA GISS browser request. The GISS source TXT is a **dated copy of only 2001–2024 from the official NASA table** (not a live NASA response). POWER remains a live NASA request. GISTEMP's original baseline is 1951–1980; the engine separately subtracts 2001–2020 *monthly* normals from both series and day-weights complete years. This aligns displayed anomaly reference periods, **not spatial support, source uncertainty or scientific construction**. No formal test of a point-vs-globe difference is claimed.

### Output shape

```ts
interface Investigation {
  schema: 'terra-lens-cross-source-water-v1'|'terra-lens-local-global-context-v1';
  simple: {
    title: string; // readable question and answer
    // other specific named scientific facts, units, years and limitations
  };
  advanced: {
    // actual source observations / monthly / complete annual values,
    // source URLs, field units, QA, excluded data, assumptions;
    // each case explicitly documents which tests were NOT performed.
  };
  context?: object;
}
```

The frontend may build tabs/cards/charts/map however it likes. Do not silently discard `simple.limitation`, `advanced.caveat(s)`, `qualityCounts`, `excluded`, or `advanced.harmonization`.

## Progressive disclosure suggestion (not implemented as UI)

**Simple:** one question → two source descriptions → one auditable numeric answer → “what this means / cannot say” → “verify next” → “View data & method”.

**Advanced:** time-series selection, exact NASA URLs, dates, different source cadences and QA, month-level missingness, whether an OLS comparison is statistically meaningful, original observations, export JSON.

**Critical evidence distinctions:**
- Water surface elevation **meters relative to a geoid** is not water depth, discharge, flood level, extent or a prediction.
- Precipitation **mm/day monthly mean rate** is not monthly accumulation or a watershed-wide rain total.
- SWOT **irregular overpasses** cannot be treated as a daily continuous hydrological gauge.
- GISTEMP **global area index anomaly** cannot be mapped to a latitude/longitude city pin.
- Comparing NASA sources is not causal attribution, and their differences are not automatically statistical significance.

## Repo coordination & commands

These pure modules are intended to be **cherry-picked or imported into the UI branch only after review**. Avoid merging the whole data branch if frontend differences are still being redesigned. The core files are under `src/science/*` and `data/source-snapshots/*`. The workflow and scripts under `scripts/live-*`, `scripts/verify-*`, and `.github/workflows/*` are independent of React and CSS.

```bash
npm ci
npm run check
node scripts/live-swot-water-case.mjs
python scripts/verify-swot-water-python.py
node scripts/live-gistemp-context.mjs
python scripts/verify-gistemp-python.py
```

Actual NASA network is required for SWOT and POWER; the official GISS dated snapshot allows reliable global context when its live host is inaccessible.

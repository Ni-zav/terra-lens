# Terra-Lens 2.0 acceptance evidence

22 November 2026 WIB · Base `daa63d1abd33f808b13a6f64d6ef3de042b18ecd` · macOS arm64, Node 24.22.2, npm 11.19.1, Python 3.13.18, Playwright Chromium 1.65.1.

## Executed

| Check | Meaning and result |
| --- | --- |
| Baseline clean archive, `npm ci && npm run check` | 81 tests and production build passed before edits. Both builds report existing large async globe and chart bundle warnings. |
| Final `npm run check` | 85 deterministic tests, syntax checks and Vite production build. The annual, OLS, Mann–Kendall, Theil–Sen and HAC implementations remain unchanged. |
| `node tests/browser.smoke.mjs` | Synthetic fixtures only. Expert workspace, readouts, comparison, globe and no-WebGL fallback, deep link, imports, CMR mock cache, missing year, request race, error states and 360–1440 px layouts. |
| `node tests/research.browser.mjs` | Built app and archived NASA payloads, with explicit adverse response mutations. Real downloads verified in Chromium. Python's CSV reader parses the downloaded CSV. Two exported HTML briefs and two app print versions each render as one tagged A4 page. PNG inspection and independent pypdf extraction verified titles, units, dates, source, and BMKG step. |
| `node tests/demo.responsive.mjs` | Historical seven-slide app at 360–1920 px. |
| `node scripts/live-browser.mjs` | Real POWER via the local Pages Function code and supported direct fallback. T2M Yogyakarta and Jakarta, RH2M at Yogyakarta, all eight Finder points, 390 px reflow, actual CSV and JSON downloads. |
| `python scripts/verify-scipy.py --snapshot` | Independently reproduced archived Gregorian day weights, slopes, t intervals, MK/Sen and paired HAC. |
| `python scripts/verify-scipy.py --responses-dir artifacts/live-2.0` | Independently reproduced the same quantities on the actual response bodies saved during the live Chromium run. The results matched the historical pair to the precision documented in the source register. |
| `python scripts/verify-discovery-scipy.py artifacts/live-2.0/live-finder-evidence.json` | Independently reproduced all eight live-browser point trends and the post-selected Surabaya–Medan HAC calculation. The resulting interval remains exploratory. |
| `python scripts/verify-gistemp-python.py` and `python scripts/verify-swot-water-python.py` | Dated NASA cases. GISS/POWER matched independent rebasing and slope calculations. SWOT preserved 12 passes, ten suspect and two degraded, three common months and the distinct precipitation rate. |
| `python scripts/verify-giovanni-area.py`, `verify-giovanni-grid.py`, `verify-giovanni-tutorial.py`, `verify-transcribed-merra-grid.py` | Existing source files independently checked. Regional CSV and NetCDF had 288 months and 24 complete years with +0.177171 K/decade. All five original OPeNDAP reprocessed subsets were bit-equal to preserved weighted-grid cells. netCDF4 emitted a time-variable `valid_range` casting warning in the grid checks. |
| `TERRA_EXPECTED_COMMIT=662a33a8d9b34cd691e43c80572f73dbea004784 node scripts/hosted-acceptance.mjs` | Real NASA through the frozen public review site, including logged-out retrieval, exports, 390 px layout, simulated outage and recovery, and historical demo PDF hash. Tests of the 2.0 branch used its local build. |

The separate live Python HTTP client encountered connection resets during direct retrieval. The direct Node eight-point acquisition had two endpoint request failures on its first run. Complete live browser captures supplied the response files for the independent checks above. Fresh Earthdata-authenticated Giovanni acquisition, deployment-host-specific Cloudflare behavior, a manual screen-reader session, and the five-person comprehension pilot were outside the executed checks. BMKG records and local heat-risk validation have yet to be obtained.

## Coverage against the acceptance matrix

| Scenario IDs | Observed evidence |
| --- | --- |
| S01–S03 | Archived Yogyakarta +0.179141 and Jakarta +0.223835 °C/decade. Paired difference +0.044694 with approximate HAC 95% interval −0.057416 to +0.146803 and p = 0.373853. The presentation and export state says a difference was not established. |
| S04–S07 | Deterministic weak, contradictory, mixed, negative and different-unit inputs. Browser missing month produced 287 records and 23 complete years at each point. The chart labeled the gap and the paired HAC was unavailable. A short response showed the 10-year requirement. |
| S08–S10 | Finder selection, cache hits with original timestamp, post-selection state after following its A/B link, unchanged canonical values across locales and independent re-check of revisions. |
| C01–C05 | Separate river WSE and rain-rate plots with context-only scope before the figures. Saved SWOT timestamps, excluded count and QA were visible. GISTEMP snapshot or refreshed POWER paths show separate dates, original global baseline and display baseline. |
| C06–C09 | Imported K area average and same-unit point import remained separate from POWER. Unknown and mismatched supports and differing products blocked shared plots or paired tests. Compatible POWER A/B kept the canonical comparison. |
| C10, E08, U07–U09 | Partial, empty, invalid, stale and failed requests were exercised. An unchanged or invalid request produced no fallback measurements, stale queries disabled expert exports, and a new response replaced the result after a retry. Shared inputs triggered a new request. |
| E01–E07, E09–E10 | Downloaded files include original units, URLs, counts, numeric values, interpretation and source statuses. Four formula prefixes were neutralized in text while −25 and negative coordinates survived as numbers. Duplicate, empty, malformed, nonmonthly and oversized CSVs showed an error. The largest file in the 2.0 acceptance run exceeded 300 kB and completed before Blob cleanup. |
| U01–U06 | Question and scope visible at 1440 and 390 px. Short report path worked by keyboard with locale persistence, named chart, exact-rows alternatives, no-WebGL fallback, and reduced motion. Tested for overflow at 320, 360, 390, 768 and 1024 px. Accessibility claims are limited to the browser checks performed. |
| U10 | Protocol prepared in the [walkthrough](../demo/terra-lens-2-walkthrough.md). Human observations are pending. |

## Browser artifacts

The CI Tests workflow uploads the 2.0 files with `artifacts/2.0/download-manifest.json` for names, parsed counts, byte lengths and SHA-256. A run includes 576 archived monthly CSV rows, 576 fresh-request-route rows from the local archived fixture, 696-row formula-escape CSVs, an imported area JSON with three sets of 288 months, two one-page reports, both GISTEMP paths with 24 annual rows per series, the 12-pass SWOT archive and the eight-point Finder file. HTML downloads embed the same evidence structure as Evidence JSON v2.

The Live NASA Browser Evidence workflow uploads separately captured NASA response bodies, screenshots and files. Compare source files independently before using any later numerical result. [Source evidence](TERRA_LENS_2_SOURCES.md) · [Maintainer runbook](MAINTAINER_RUNBOOK.md)

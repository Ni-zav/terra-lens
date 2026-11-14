# Terra-Lens — repository agent instructions

Terra-Lens is a real NASA Space Apps 2026 Earth system trend investigation app. This public repository contains scientific application code, public methodology, API integration, repeatable tests and publicly shareable evidence. Keep it publication-grade, reproducible and accessible. **Do not add internal research, competitor strategy, team/private submission drafts, tokens, or private credentials to this repository.**

## Primary execution contract

Inspect current branch, files and CI before editing; do not trust stale conversation summaries. Resolve issues end-to-end rather than returning a plan. Make focused commits, test, review visual captures, and report actual evidence. Never force-push history without explicit user authorization. The Nov 15, 2026 23:59 WIB competition deadline makes real deployment, science compliance and judges' ability to open a working demo higher priority than ambitious new features.

## Scientific rules (hard constraints)

- NASA POWER real API records are the production data source; never replace actual observations with generated, simulated, fixture or AI-derived measurements. Mock data are permitted only inside clearly marked tests.
- Respect the NASA POWER typed source adapter in `src/power.js`; `T2M` is 2 m air temperature °C, `RH2M` is relative humidity %, `PRECTOTCORR` is daily average precipitation rate mm/day (not annual rainfall total).
- Annual series consist only of years with all 12 valid months, with Gregorian day-weighted means, no filling gaps or interpolation; annual OLS fits actual calendar years, not array index.
- Report linear slope in units per decade, a **classical** two-sided Student-t p-value and 95% classical confidence interval, and only after enough complete years. State that serial correlation, model uncertainty and repeated testing can make inference optimistic.
- Coordinates refer to NASA POWER **model-derived grid-point estimates**, not street thermometers, city-wide observations or inferred spatial surfaces. Do not claim between-location slope significance from two separate p-values.
- Geographic maps display point location context, not NASA raster coverage or trend values unless a separate, verifiable gridded dataset and proper spatial algorithm are actually integrated.
- The public method is documented in `docs/METHODOLOGY.md`, verified case in `docs/CASE_STUDY.md`. Update docs with any behavior or science changes.

## Design quality bar

Create a convincing, editorial scientific observatory, not a generic AI-generated dashboard. Prioritize legibility, whitespace, direct labels and meaningful data marks. Existing primary hues: Point A cyan `#62d6e4`, Point B amber `#f6b975`; dark canvas `#071019`. Never imply Point A's color means statistical success. Make location A/B results equally prominent. Test desktop (1440,1280,1024), tablet (768) and phones (390,360). No page-wide overflow, microscopic plot ticks or button clipping. Charts must show units, real dates, missing gaps and accessible exact-value inspection. Avoid heavy frameworks without a measured benefit.

Interactive HTML demo lives in `demo/index.html`; it is a responsive story. A PDF/PPTX is a separately optimized **fixed 16:9** export. The NASA demo limit is a maximum of seven slides OR a 30-second video. Actual NASA screenshots and their provenance live in `docs/screenshots/`; never substitute browser-test fixtures.

## NASA & release gate

**Still verify** the selected challenge's exact official NASA Resources-tab eligibility rule and actual listed dataset usage. NASA POWER is genuine NASA data, but indirect links with listed resources are not proof that the explicit required dataset-use condition was satisfied. Deployment and official Team Project submission status also require evidence; GitHub Actions passing alone does not establish either.

Do not invent deployment URLs or claim the official NASA Team Project was submitted. Preserve links, source acknowledgments and AI-assisted work disclosure.

## Test commands

- `npm run check`: syntax, deterministic statistical and Cloudflare proxy tests.
- Install Playwright and Chromium, then `node tests/browser.smoke.mjs`: fixture-only browser UI/responsive test.
- `node scripts/live-browser.mjs`: actual NASA retrieval through the Pages Function code served locally, A/B and another variable, CSV, mobile screenshot.
- Install SciPy and run `python scripts/verify-scipy.py`: independently validate JS calculations on the SAME real NASA API responses.
- `node scripts/build-demo.mjs`: generate demo PDF from authentic screenshot-backed HTML; the CI workflow checks exactly seven PDF pages.

GitHub Actions contains tests, live NASA, independent SciPy, screenshot publication and seven-slide PDF generation. If a CI publish step conflicts with concurrent jobs, resolve without force-push, preserve currently newer source, and avoid uploading obsolete screenshots.

At finish provide: exact commits/PRs, CI results, user-visible site (only if deployed and verified), genuine NASA scientific/Resources compliance status, demo link and official team submission status.

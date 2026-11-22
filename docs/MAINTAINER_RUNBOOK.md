# Terra-Lens maintainer runbook

## Build and validate

The production application is a static Vite bundle. The baseline at `daa63d1` had one POWER workspace with seven tabs, three-column desktop controls, lazy charts and globe, local Giovanni import, and three separate data-case paths. Version 2.0 adds a bilingual presentation layer and archive entry while the existing calculations still run from `src/stats.js`, `src/series.js` and `src/contrast.js`. No additional runtime dependency is required.

Use Node 20.19+ with the npm lockfile. GitHub Actions uses Node 22. The release audit used Node 24.22.2, npm 11.19.1, Chromium through Playwright 1.65.1 and Python 3.13.18.

```sh
npm ci
npm run check
npx playwright install chromium
node tests/browser.smoke.mjs
node tests/research.browser.mjs
node tests/demo.responsive.mjs
```

The browser commands test `dist/`. The 2.0 suite needs Python 3 on PATH for independent CSV parsing and writes screenshots, actual files and `download-manifest.json` to `artifacts/2.0/`. Time-stamped exports have different checksums across runs. To check independent source math, install SciPy, NumPy and netCDF4 in a virtual environment.

```sh
python scripts/verify-scipy.py --snapshot
python scripts/verify-gistemp-python.py
python scripts/verify-swot-water-python.py
python scripts/verify-giovanni-area.py
python scripts/verify-giovanni-grid.py
python scripts/verify-giovanni-tutorial.py
python scripts/verify-transcribed-merra-grid.py
node scripts/live-browser.mjs
python scripts/verify-scipy.py --responses-dir artifacts/live-browser
python scripts/verify-discovery-scipy.py artifacts/live-browser/live-finder-evidence.json
```

The last two commands require NASA network access for browser retrieval and work with the returned response files. The browser serves the Pages Function locally to exercise the proxy code and can fall back to NASA directly. A direct Python retrieval is also available with `python scripts/verify-scipy.py`. Authenticated Giovanni refresh uses a separate [acquisition workflow](GIOVANNI_AUTHENTIC_SOURCE_GATE.md). Preserve the original downloaded files privately where required by their access terms. Never put NASA credentials, Earthdata tokens or user imports into a public artifact.

## Maintain only the supported paths

Use the [source register](TERRA_LENS_2_SOURCES.md) as the capability table. Check it when a source adds a version, when the corresponding parser fails, or before a release. Have one maintainer own any source refresh PR. Prefer testing an already supported variable or case before proposing another connector.

- Recheck current POWER metadata and an independent fit when the API changes. Save the exact replies, compare old and new source versions and month-level differences, and document changes to slopes or coverage. Requests can fail or upstream archives can revise older data.
- Leave the evidence-screening inputs pinned unless intentionally creating a new dated case. Updating a case means preserving both old and new files, checksums, retrieval metadata and regression values. Update the brief, locale copy and source register together.
- Refresh GISTEMP and SWOT through a separate, reviewed change when evidence or source version warrants it. For GISTEMP retain the original baseline and table. For SWOT retain reach, version, pass time, quality, exclusions and the rain rate source separately.
- Review the authentic Giovanni dataset, product version, bounds, usage terms and input-granule quality when the upstream release changes. Local uploads stay in the browser unless the user downloads or shares evidence. A checksum establishes identity of bytes.
- During an outage the requested result shows an error with a retry path. The dated study remains accessible as its own case. A share link stores inputs and requests data again. Finder cache entries retain their original date. Keep CMR metadata availability distinct from science-body availability.

## Review exported evidence

Evidence JSON keeps the `terra-lens-evidence-v2` fields and adds an `interpretation` object with unrounded numeric values and language-neutral status codes. Comparison values are derived on common complete years only. CSV keeps its original first 12 headings and appends `source_mode` and `captured_at`. Dates may be blank when retrieval is unknown. Spreadsheet-formula prefixes are escaped only in text fields. The standalone report is UTF-8 HTML with embedded `terra-lens-screening-brief-v1` JSON. Each downloaded report includes source URLs and a localized print layout.

Before a release, open actual CSV and JSON downloads, compare via the manifest and repeat the report in print preview. Use the site in a 390 px viewport with keyboard focus and reduced motion. Built-in English expert vocabulary remains available in Explore. User-facing interpretation uses the ID/EN dictionary. Preserve physical units and distinctions among model estimates, observations, indices and area averages across both languages.

## Release and restore

Feature branches run checks and upload artifacts. Production GitHub Pages builds and publishes `dist/` on `main` or manual dispatch. The frozen 2026 review is a separate site with provenance SHA `662a33a8d9b34cd691e43c80572f73dbea004784`. Keep its seven-slide PDF and review deployment frozen.

For a deliberate release, review the PR, resolve any failed required checks, record the exact source commit and artifact, and verify production with the read-only hosted script. For rollback, identify the last verified Pages source from Actions, prepare and review a revert on `main`, then let the production workflow rebuild. Verify the served site in a logged-out Chromium and compare the published evidence paths before declaring recovery. A Cloudflare Pages deployment, if maintained separately, should point at the chosen commit, build `dist/` and test `/api/power` on that host.

## Contribute without changing the science

Copy, translation, accessibility, case documentation and export tests can be reviewed independently. A calculation change needs a specific reproduced defect, a before/after dataset and independent numerical verification. For a new source require a named user task, authenticated sample, explicit spatial and temporal support, units, QA and a justification for any proposed statistical comparison.

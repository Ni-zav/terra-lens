# Verified NASA case study — Yogyakarta and Jakarta

**Run:** 14 November 2026, 04:59 UTC (11:59 WIB) · **Source:** NASA POWER monthly point API, MERRA-2-derived meteorological data. This report contains values returned by real NASA API requests, **not browser-test fixture data**.

**Reproduction:** `node scripts/live-evidence.mjs`. Auditable successful workflow: [NASA Live Evidence #43559281083](https://github.com/Ni-zav/terra-lens/actions/runs/43559281083). The workflow uploaded an artifact `live-nasa-case-study` with the computed annual series and metadata.

## Study definition

- Variable: `T2M`, 2-meter near-surface air temperature (°C).
- Time period: 2001–2024 inclusive.
- Unit of analysis: one NASA POWER grid point at each requested coordinate.
- Processing: 288 valid monthly records, 24 complete annual means for each point; calendar-day-weighted annual means; OLS slope versus calendar year, two-sided classical Student t-test, 95% t-based CI.
- Inference threshold: α = 0.05, *conditional on OLS error assumptions*.

| Selected point | Requested latitude, longitude | Trend (°C/decade) | Classical 95% CI (°C/decade) | Classical two-sided p-value |
|---|---|---:|---:|---:|
| Yogyakarta | -7.7956, 110.3695 | +0.1791 | +0.0348 to +0.3235 | 0.01732 |
| Jakarta | -6.2088, 106.8456 | +0.2238 | +0.0962 to +0.3515 | 0.001455 |

Source API queries:

- [Yogyakarta NASA POWER JSON](https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M&community=AG&longitude=110.3695&latitude=-7.7956&start=2001&end=2024&format=JSON)
- [Jakarta NASA POWER JSON](https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M&community=AG&longitude=106.8456&latitude=-6.2088&start=2001&end=2024&format=JSON)

## Findings and non-findings

Under the tool's **classical OLS assumptions**, both estimated point-level slopes are positive and have p-values below 0.05. **This does not prove** that the residuals are independent or that inference remains significant after autocorrelation-aware correction. A visual comparison of the two point slopes does not establish a significant *difference between* their trends.

These are historical modeled/reanalysis grid-cell estimates, not urban area averages or thermometer readings. Do not attribute changes to urbanization, greenhouse gases, land use, or any single cause on this evidence alone.

## Validation status

- [x] Source requests succeeded from GitHub Actions on 14 Nov 2026.
- [x] Monthly response parsing and annual aggregation yielded 24 complete calendar years each.
- [x] Independent nonproduction browser fixture and computation unit tests passed in CI.
- [x] Independent SciPy `linregress` slope, t-interval, and p-value independently reproduced on **the same live NASA responses** as the JavaScript implementation. [Passing workflow #43563257853](https://github.com/Ni-zav/terra-lens/actions/runs/43563257853), 14 Nov 2026. The logs show matching trends and confidence intervals to at least six decimal places.
- [x] Chromium browser tested with the **real** NASA API through the actual Pages Function code running locally, including two points, another variable, 576-row CSV and mobile overflow. [Live NASA browser workflow #43563581913](https://github.com/Ni-zav/terra-lens/actions/runs/43563581913); [actual screenshots](screenshots/README.md).
- [ ] Cloudflare Pages **deployed** site verified end-to-end. Locally running the Pages Function code is not proof of Cloudflare deployment.
- [ ] Exact official 2026 challenge **Resources tab** membership checked and any required listed NASA data source actually used. NASA POWER is valid NASA data, but may not appear in that required list.
- [x] Real-NASA browser screenshots generated. They are not synthetic browser-test fixtures.

## Reading the evidence

Use this case study as the first credible hackathon demo and preserve the numerical values only alongside the exact 2001–2024 period, coordinates, variable, source, retrieval timestamp and OLS assumptions. NASA may revise its datasets, so subsequent requests might differ.

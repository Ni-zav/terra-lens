# Statistical method and interpretation

## What data mean

For each selected latitude and longitude, Terra-Lens requests a historical monthly series from the **NASA POWER monthly point API**, with NASA GMAO MERRA-2-derived meteorological variables. Coordinates select one grid-cell estimate, not a city average or field sensor.

All displayed series are from API responses at runtime. Missing values (null, nonfinite and NASA fill values such as -999) are dropped. Keys must be `YYYYMM`, with 1 ≤ MM ≤ 12; API-generated `YYYY13` annual summary keys are ignored. We do not interpolate missing observations.

## Annual aggregation

For a year `y` with **all twelve** months, let `v[y,m]` be the reported monthly mean and `d[y,m]` the number of Gregorian calendar days. We calculate

`A[y] = Σ(v[y,m] × d[y,m]) / Σ(d[y,m])`

for `m=1…12`. Incomplete years are excluded. This treats monthly rates/means as representative of their days. The original NASA POWER monthly API's own annual statistic may use a different aggregation convention, so we calculate and label our own derived annual series.

For `PRECTOTCORR`, this gives the **yearly average daily precipitation rate (mm/day)**. It is not a precipitation volume or an annual accumulation in mm.

## Trend

For `n ≥ 10` complete years, fit by ordinary least squares

`A[y] = α + β × (y - mean(years)) + ε[y]`.

The estimated `β` has unit per calendar year; Terra-Lens displays `10β`, in unit **per decade**. With nonconsecutive complete years, actual year values are used, not row indices.

Classical slope standard error:

`SE(β) = sqrt( Σ residual² / ((n-2) × Σ(year - mean(years))²) )`.

Two-sided t-test: `t = β / SE(β)` with `df = n-2` and `H0: β = 0`.
Two-sided p-value is from the Student t distribution. The 95% slope interval is

`[β - t_(0.975, n-2) × SE(β), β + t_(0.975, n-2) × SE(β)]`.

The implementation computes Student t tail probability through the regularized incomplete beta function; deterministic reference quantile tests are included.

Classification at `α=0.05` is *classical test significant* or *not significant*. If fewer than ten complete years are available, no significance result is shown.

## The limits are essential, not footnotes

1. **Serial correlation:** adjacent climate years may be correlated. Classical OLS p-values/CI assume independent residuals; significance may be overstated.
2. **Heteroskedasticity and nonlinear behavior:** simple linear inference does not model changing variance, abrupt regime shifts or curved trends.
3. **Multiple searches:** repeating variables, years and coordinates creates multiple-testing risk; p < 0.05 does not automatically control discovery errors.
4. **Model uncertainty:** the API gives reanalysis estimates affected by input data, assimilation and revisions, not direct station observations.
5. **Geography:** point comparison does not describe an entire region; differences in individual slopes are **not** a formal statistical test of between-region difference.
6. **No causation:** slope and significance say nothing by themselves about what physically caused change.
7. **No forecasts:** this code does not predict future climate values.
8. **Missing data:** excluding incomplete years can bias trends if missingness is systematic.
9. **Exploratory scope:** data definitions, units and model-version evolution must be revisited for publication-grade analyses.

Recommended post-hackathon statistical upgrades: residual autocorrelation diagnostics, HAC/Newey–West slope intervals, Mann–Kendall tests with autocorrelation adjustment, seasonal de-trending, spatial field significance/multiple-testing corrections, and cross-source validation.

## Interpretation examples (illustrative text, not NASA results)

- If a fitted slope is `+0.20 °C/decade`, it describes the linear estimate for that **selected point/time range**, not any city's overall warming.
- If `p ≥ 0.05`, the data fail this specific test's threshold; that does **not** prove there is no change.
- If `p < 0.05`, the significance statement is **conditional on assumptions**, not proof of causation or data accuracy.

## Code

Pure operations: `src/stats.js`. NASA adapter: `src/power.js`. Deterministic tests: `tests/analysis.test.mjs`.

# Terra-Lens 2.0 source evidence

## Yogyakarta and Jakarta archive

The pinned case uses two decoded NASA POWER response files preserved byte for byte from the [independent SciPy workflow artifact](https://github.com/Ni-zav/terra-lens/actions/runs/43579062738) (`independent-nasa-scipy-evidence`). The generating job records its start at 2026-11-14 09:08:01 UTC. UTC retrieval times for the individual files were not separately recorded. Their evidence exports therefore carry an archive run timestamp and a null retrieval timestamp.

| Requested coordinates | Source file | SHA-256 |
| --- | --- | --- |
| Yogyakarta −7.7956°, 110.3695° | [NASA POWER T2M JSON](../data/source-snapshots/power-2001-2024/power-yogyakarta.json) | `f41ca1614cf6d7906fe75ef0dd3dc60df0d48da091d404a8a73e7e7b16f2eadc` |
| Jakarta −6.2088°, 106.8456° | [NASA POWER T2M JSON](../data/source-snapshots/power-2001-2024/power-jakarta.json) | `59ab1b420c356eab89340deb7d6398e72afcac054c05715b7dccce480e710865` |

Both original queries requested 2001–2024. Their API headers declare POWER Monthly and Annual API v2.10.0, MERRA2, local solar time and fill value −999. The app shows requested and returned coordinates separately. It keeps 288 monthly records per point and excludes the API's annual month-13 summary.

| Derived result | Estimate | Sample and uncertainty |
| --- | --- | --- |
| Yogyakarta fitted trend | +0.179141 °C/decade | 24 complete years. Classical 95% CI +0.034798 to +0.323484, p = 0.017319. Mann–Kendall p = 0.023996. |
| Jakarta fitted trend | +0.223835 °C/decade | 24 complete years. Classical 95% CI +0.096212 to +0.351458, p = 0.001455. Mann–Kendall p = 0.000970. |
| Jakarta minus Yogyakarta | +0.044694 °C/decade | 24 shared years. Two-lag approximate HAC 95% CI −0.057416 to +0.146803, p = 0.373853. |

The HAC range leaves the ordering unresolved. Estimates apply to selected grid points. Separate tests use the same observations and cannot validate physical model accuracy. See [methods](METHODOLOGY.md) and [the original case study](CASE_STUDY.md).

The separate POWER/GISTEMP example preserves its own later November 14 snapshot and rebases each series to its own 2001–2020 calendar-month normals. Its archived rebased POWER fit is +0.179091 °C/decade and its global fit is +0.250370 °C/decade. The rebased display is a context view with its own source lineage and transformations.

## Source paths and boundaries

| Path | Availability in 2.0 | Meaning |
| --- | --- | --- |
| POWER workspace and Finder | Live requests. The Finder can reuse successful responses for 15 minutes and keeps the original timestamp. | Monthly modeled point estimates. Confirm parameter, unit and source list in the response. MERRA-2 supplies the historical archive, and near-real-time GEOS-IT values can be replaced as MERRA-2 arrives. |
| POWER Yogyakarta screening and Ohio precipitation | Dated archives | Screening uses near-surface air temperature. Ohio PRECTOTCORR represents the average daily rain rate for the month at a nearby point in mm/day, with no basin accumulation estimate. |
| Ohio SWOT RiverSP vD | Dated archive | SWORD reach 74267300251. Twelve irregular passes in March–May 2025, ten suspect and two degraded, with zero exclusions in this archive. Elevation above reference geoid is distinct from water depth, discharge or flood stage. Only three calendar months overlap with POWER, insufficient for association. The Hydrocron utility can query the API separately from the shipped browser case. |
| GISS GISTEMP v4 | Dated official excerpt | Global land–ocean anomaly index, original baseline 1951–1980. The case can refresh its POWER half. Rebasing to 2001–2020 is for visualization and descriptive context. It does not match geographic support. |
| Giovanni regional and tutorial | Dated bundled evidence | The verified M2TMNXSLV v5.12.4 regional product uses stated weighted bounds and retains original job files and DOI. The separate tutorial has incomplete job lineage and unknown quality flags. |
| Giovanni local file | User import, origin unverified | The hash identifies bytes. Source URL and DOI are user declarations for Cloud imports. Valid classic area exports include exact bounds. Imported data can be viewed in a separate chart with source-specific units. |
| CMR catalog search | Live public metadata or a 15-minute memory-cache entry | Metadata discovery, with collection and variable records as disclosed in the app. |
| GPM IMERG, GLDAS, MODIS, FIRMS | Planned | The app does not request or analyze observations from these sources. |

Primary NASA references checked for this release include [POWER monthly service](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/), [POWER meteorology and GEOS-IT replacement](https://power.larc.nasa.gov/docs/methodology/data/sources_hydrology/), [POWER native grid resolution](https://power.larc.nasa.gov/docs/methodology/), [GISTEMP and upstream revisions](https://data.giss.nasa.gov/gistemp/), [GISTEMP baselines](https://data.giss.nasa.gov/gistemp/faq/), [Giovanni weighting and provenance](https://giovanni.gsfc.nasa.gov/giovanni/doc/UsersManualworkingdocument.docx.html), [Hydrocron reach records](https://podaac.github.io/hydrocron/timeseries/) and [Hydrocron missing pass handling](https://podaac.github.io/hydrocron/user-guide/time/).

## Local use and historical record

The brief is intended for a hypothetical local analyst or educator deciding whether to ask for more evidence. Its next step is to request compatible BMKG station data, review gaps and station history, and independently check land use, land-surface data quality and exposure or vulnerability for any risk assessment. No station records have been obtained for this case. Availability, coverage and usage terms remain for the analyst to confirm. [BMKG Yogyakarta data service](https://staklim-yogya.bmkg.go.id/portal-pelayanan-data/) · [BMKG Data Online](https://dataonline.bmkg.go.id/dataonline-home) · [IPCC AR6 WGII risk framework](https://www.ipcc.ch/report/ar6/wg2/chapter/technical-summary/)

The official Resources tab HTML on 22 November lists Giovanni, Hydrology Time Series and AppEEARS. The repository preserves the authentic Giovanni source-use evidence and its limitations. NASA determines eligibility. The frozen November 15 submission materials remain under their original review deployment provenance. [Official challenge Resources tab](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/?tab=resources) · [Regional source handoff](NASA_QUALIFYING_SOURCE_HANDOFF.md) · [Frozen review provenance](https://ni-zav.github.io/terra-lens-preview/BUILD-PROVENANCE.txt)

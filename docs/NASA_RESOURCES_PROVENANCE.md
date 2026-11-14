# 2026 challenge Resources qualification — careful evidence status

**Snapshot:** 14 November 2026. **Selected challenge:** [Be An Earth System Trend Detective!](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/).

## Binding Global Award rule

NASA Global Organizing (GO) Team publicly states that Global Awards require **at least one NASA data source included in the Resources of the selected challenge** to be *actually used*, and the sources identified and cited. Adding a resource hyperlink alone is insufficient. NASA public organizer references:
- https://github.com/nasa/spaceapps/discussions/1827
- https://github.com/nasa/spaceapps/discussions/1849
- https://github.com/nasa/spaceapps/discussions/1947

## What has been verified and what has not

| Source/resource | Evidence | Status |
|---|---|---|
| [Official challenge Resources tab](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/?tab=resources) | Direct search/open returned 502/bad gateway from available tooling, including URL `?tab=resources`. | **NOT directly verified** |
| Independent community transcription of Resources tab | https://github.com/nasa-hackathon-2026/resources (not NASA-operated) lists Giovanni, Hydrology Time Series, AppEEARS, and SWOT Mission among the challenge resources. This cannot replace a direct NASA-official snapshot. | **Secondary corroboration only** |
| **NASA SWOT** mission via PO.DAAC Hydrocron | Actual `SWOT_L2_HR_RiverSP_D` reach 74267300251 downloaded, QA screened, analyzed in conjunction with NASA POWER; [real-data run](https://github.com/Ni-zav/terra-lens/actions/runs/43610222429). NASA official API documentation: https://podaac.github.io/hydrocron/timeseries/ | **Actual NASA satellite dataset analyzed. Appears linked to challenge resources via secondary list; final eligibility confirmation still pending** |
| NASA POWER | Real model-derived T2M, PRECTOTCORR already verified; no direct evidence POWER itself is named in official Resources. | **Live and validated, but not assumed qualifying** |
| NASA GISS GISTEMP v4 | Authentic original NASA table snapshot (2001–2024) independently processed alongside live NASA POWER. [NASA original table](https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.txt). | **Analyzed additional NASA data; NOT assumed officially listed** |
| NASA Giovanni | Local CSV importer exists on `main`; not authenticated to Earthdata or supplied a verifiable NASA product download in this project yet. | **Software-only support, not evidence of qualifying dataset analysis** |
| AppEEARS, GLDAS, GPM, MODIS | Product-specific actual raw data and QA not yet integrated. | **Planned only** |

**Important:** NASA SWOT is a joint NASA/CNES mission. The secondary resource index points to a Canadian Space Agency SWOT informational page, while the actual science dataset here is NASA PO.DAAC RiverSP. This is a scientifically valid NASA SWOT dataset, but **we cannot prove it meets the GO Team's selected challenge tab requirement until the official resource entry is personally checked**. Do not tell judges the gate is definitively cleared on this evidence alone.

## One-minute participant verification

1. Open the [official challenge Resources tab](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/?tab=resources) in a regular logged-in browser.
2. Preserve a screenshot or copied resource names/URLs, including the entry concerning SWOT or Hydrology Time Series, and any Giovanni link. This is the missing primary-source evidence.
3. If SWOT qualifies, reference precisely: `SWOT_L2_HR_RiverSP_D`, SWORD Reach `74267300251`, original NASA Hydrocron request URL, `wse` in meters with quality flags, 12 observed passes in March–May 2025. Cite PO.DAAC and the product DOI [10.5067/SWOT-RIVERSP-D](https://doi.org/10.5067/SWOT-RIVERSP-D).
4. If NASA Global Organizing Team treats that secondary-source-linked mission as insufficient, obtain actual NASA Giovanni or AppEEARS source dataset from the listed tool and independently analyze it; do not claim success based only on the importer interface.
5. Cite NASA POWER and NASA GISS separately as additional original NASA resources; do not confuse helpful scientific data with the event's mandatory listed-source gate.

No NASA login credentials, Earthdata tokens or private account data are stored in this repository.

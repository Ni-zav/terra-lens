# 2026 challenge Resources qualification — careful evidence status

**Snapshot:** 15 November 2026. **Selected challenge:** [Be An Earth System Trend Detective!](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/).

## Binding Global Award rule

NASA Global Organizing (GO) Team publicly states that Global Awards require **at least one NASA data source included in the Resources of the selected challenge** to be *actually used*, and the sources identified and cited. Adding a resource hyperlink alone is insufficient. NASA public organizer references:
- https://github.com/nasa/spaceapps/discussions/1827
- https://github.com/nasa/spaceapps/discussions/1849
- https://github.com/nasa/spaceapps/discussions/1947

## What has been verified and what has not

| Source/resource | Evidence | Status |
|---|---|---|
| [Official challenge Resources tab](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/?tab=resources) | The official page response was retrieved on 15 November 2026; its embedded Resources content lists Giovanni, Hydrology Time Series and AppEEARS under NASA Data & Resources, and SWOT under Space Agency Partner Resources. | **Directly verified** |
| Independent community transcription of Resources tab | https://github.com/nasa-hackathon-2026/resources (not NASA-operated) lists Giovanni, Hydrology Time Series, AppEEARS, and SWOT Mission among the challenge resources. This cannot replace a direct NASA-official snapshot. | **Secondary corroboration only** |
| **NASA SWOT** mission via PO.DAAC Hydrocron | Actual `SWOT_L2_HR_RiverSP_D` reach 74267300251 downloaded, QA screened, analyzed in conjunction with NASA POWER; [real-data run](https://github.com/Ni-zav/terra-lens/actions/runs/43610222429). NASA official API documentation: https://podaac.github.io/hydrocron/timeseries/ | **Real NASA-led mission dataset analyzed. The official page places SWOT under SPACE AGENCY PARTNER resources, not the NASA-resources group. Do not count as meeting mandatory NASA-source eligibility without organizer confirmation.** |
| NASA POWER | Real model-derived T2M, PRECTOTCORR already verified; no direct evidence POWER itself is named in official Resources. | **Live and validated, but not assumed qualifying** |
| NASA GISS GISTEMP v4 | Authentic original NASA table snapshot (2001–2024) independently processed alongside live NASA POWER. [NASA original table](https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.txt). | **Analyzed additional NASA data; NOT assumed officially listed** |
| NASA Giovanni | Local CSV importer exists on `main`; not authenticated to Earthdata or supplied a verifiable NASA product download in this project yet. | **Software-only support, not evidence of qualifying dataset analysis** |
| AppEEARS, GLDAS, GPM, MODIS | Product-specific actual raw data and QA not yet integrated. | **Planned only** |

**Important:** NASA SWOT is a joint NASA/CNES mission. The official challenge Resources tab places the **SWOT Mission information entry under Space Agency Partner resources**, *separately* from the NASA entries Giovanni, Hydrology Time Series and AppEEARS. The secondary resource index points to a Canadian Space Agency SWOT informational page, while the actual science dataset here is NASA PO.DAAC RiverSP. This is a scientifically valid NASA SWOT dataset, but **we cannot prove it meets the GO Team's selected challenge tab requirement without organizer confirmation that this partner entry qualifies**. Do not tell judges the gate is definitively cleared on this evidence alone.

## Current conservative eligibility decision: NOT SATISFIED

The resource list is directly verified, but actual analysis of an original dataset obtained from a listed NASA resource has not been demonstrated. This is a project evidence decision, not NASA’s final eligibility determination.

The real SWOT study is valid and useful, but an organizer may treat it as a partner-resource use, not as the required listed **NASA** dataset. NASA POWER and NASA GISS are genuine NASA sources but are not named among the NASA resources on the official tab. We therefore keep a **NO-GO for declaring Global Award source compliance** until one of the following is documented:

1. NASA GO Team explicitly confirms that PO.DAAC SWOT RiverSP used through the listed partner SWOT entry satisfies the mandatory NASA-source requirement; **or**
2. The team obtains and **actually analyzes** an authentic dataset exported through challenge-listed NASA Giovanni/Hydrology Time Series or AppEEARS (with the original NASA dataset ID/version/DOI and retained records), and records the original data and provenance.

The Giovanni importer and new source-file verifier are software capabilities only until an authentic participant-supplied source CSV is processed. No anonymous workflow has silently substituted a Giovanni dataset.

## One-minute participant verification

1. Open the [official challenge Resources tab](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/?tab=resources) in a regular logged-in browser.
2. Preserve a screenshot or copied resource names/URLs, including the entry concerning SWOT or Hydrology Time Series, and any Giovanni link. The public page response was inspected on 15 November; preserve a fresh screenshot if the team needs a submission record.
3. If SWOT qualifies, reference precisely: `SWOT_L2_HR_RiverSP_D`, SWORD Reach `74267300251`, original NASA Hydrocron request URL, `wse` in meters with quality flags, 12 observed passes in March–May 2025. Cite PO.DAAC and the product DOI [10.5067/SWOT-RIVERSP-D](https://doi.org/10.5067/SWOT-RIVERSP-D).
4. If NASA Global Organizing Team treats that secondary-source-linked mission as insufficient, obtain actual NASA Giovanni or AppEEARS source dataset from the listed tool and independently analyze it; do not claim success based only on the importer interface.
5. Cite NASA POWER and NASA GISS separately as additional original NASA resources; do not confuse helpful scientific data with the event's mandatory listed-source gate.

No NASA login credentials, Earthdata tokens or private account data are stored in this repository.

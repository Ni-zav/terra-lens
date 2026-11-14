# Terra-Lens 🌍

**Follow the evidence.** An interactive Earth-system trend explorer for the **NASA Space Apps Challenge 2026**, responding to **[Be An Earth System Trend Detective!](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/)**.

Terra-Lens lets users select an environmental variable, choose geographic points, inspect NASA monthly observations over time, estimate linear trends per decade, and understand the difference between an observed change and statistical evidence for a trend.

**The application uses real NASA POWER data. It does not silently generate, substitute, or claim AI-predicted observations as measured data.**

## Capabilities

| NASA challenge question | Terra-Lens answer |
| --- | --- |
| What is changing? | Select NASA POWER 2 m temperature, relative humidity, or corrected precipitation rate. |
| Where? | Pick coordinates or compare two named point locations. |
| How much? | Estimate an ordinary-least-squares linear slope per decade and fitted change over the observed span. |
| When? | Plot monthly and complete-year historical time series. |
| Is it significant? | Report classical two-sided Student t-test p-value and 95% confidence interval, with limitations. |

The map-like coordinate graphic is **not** a spatial heat map. A NASA POWER grid-point sample is **not** an official city-level observation or a polygon average.

## Start immediately

No dependency install is needed for the website:

```bash
git clone https://github.com/Ni-zav/terra-lens.git
cd terra-lens
python3 -m http.server 4173
# visit http://localhost:4173
```

Then select a variable, 10+ calendar years, and one or two locations; press **Analyze NASA data**. The application requests the NASA API through `/api/power` when a Cloudflare Pages Function is available, otherwise tries NASA POWER directly.

**Production hosting:** Cloudflare Pages with the bundled proxy is recommended, because a browser may be blocked by NASA upstream CORS. Connect the repository to Cloudflare Pages with framework preset **None**, no build step, and output directory **.**. A local static server does not provide the Pages Function.

## Tests

```bash
npm run check
```

Node 20+ required for tests. The browser smoke test is separate; its deterministic fixture is only for tests and never used in the shipped app.

## Project evidence

- [Verified NASA case study — Yogyakarta and Jakarta](docs/CASE_STUDY.md)
- [Mathematical method and interpretation](docs/METHODOLOGY.md)

## Scientific limitations

Annual values use day-weighted monthly means, retaining only years with all 12 valid months. The trend is simple OLS on annual means. The reported p-value and confidence interval assume independent, roughly homoskedastic residuals; autocorrelation, nonlinear behavior, reanalysis changes, and exploratory multiple comparisons can make significance claims unreliable. **A p-value is not a causal explanation or a statement about the future.** Detailed caveats appear in the methodology.

NASA POWER's meteorological parameters are derived from NASA GMAO **MERRA-2** assimilation/reanalysis. They are model-derived, not direct measurements at street level.

## Authorship and acknowledgments

Built during the 14–15 November 2026 hackathon window. AI-assisted research, code drafting, testing and submission preparation were used. This is disclosed for evaluation; scientific results are produced by deterministic code, not generative AI. There is no generative AI answering scientific questions or substituting observations in the running application.

Source attribution: [NASA POWER](https://power.larc.nasa.gov/), [NASA POWER monthly API](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/), [NASA MERRA-2](https://gmao.gsfc.nasa.gov/reanalysis/MERRA-2/), [NASA Space Apps Challenge](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/). Browser fonts are loaded from Google Fonts where available.

Independent hackathon project. Not affiliated with, sponsored by, or endorsed by NASA.

## License

MIT; see [LICENSE](LICENSE).

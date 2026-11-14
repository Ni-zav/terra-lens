#!/usr/bin/env python3
"""Independently reproduce NASA POWER annual OLS using SciPy and compare with JS.

This script downloads actual NASA data at runtime. It does NOT use synthetic fixtures.
Requires: Python 3, SciPy, Node 20+. Run from the repository root.
"""
import calendar
import datetime as dt
import json
import math
from pathlib import Path
import subprocess
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from scipy.stats import linregress, t

BASE = "https://power.larc.nasa.gov/api/temporal/monthly/point"
CASES = {"Yogyakarta": (-7.7956, 110.3695), "Jakarta": (-6.2088, 106.8456)}
JS = """
import {readFileSync} from 'node:fs';
import {parseMonthly} from './src/power.js';
import {annualMeans, linearTrend} from './src/stats.js';
const raw=JSON.parse(readFileSync(process.argv[1], 'utf8'));
const annual=annualMeans(parseMonthly(raw, 'T2M'));
const trend=linearTrend(annual);
console.log(JSON.stringify({n:annual.length, slope:trend.slopePerDecade,
  lower:trend.ciLowPerDecade, upper:trend.ciHighPerDecade, p:trend.pValue}));
"""

def download(url):
    last = None
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={"User-Agent": "Terra-Lens-SciPy-Verification/1.0"}),
                         timeout=65) as response:
                return json.load(response)
        except Exception as error:
            last = error
            if attempt != 2:
                time.sleep(4)
    raise RuntimeError(f"NASA POWER data unavailable after 3 attempts: {last}")

def annual_series(payload):
    parameter = payload["properties"]["parameter"]["T2M"]
    by_year = {}
    count = 0
    for key, raw in parameter.items():
        if len(key) != 6 or not key.isdigit():
            continue
        year, month = int(key[:4]), int(key[4:])
        if month < 1 or month > 12 or raw is None:
            continue
        try:
            value = float(raw)
        except (ValueError, TypeError):
            continue
        if not math.isfinite(value) or value <= -990:
            continue
        by_year.setdefault(year, {})[month] = value
        count += 1
    series = []
    for year in sorted(by_year):
        monthly = by_year[year]
        if len(monthly) != 12:
            continue
        weights = [calendar.monthrange(year, month)[1] for month in range(1, 13)]
        annual = sum(monthly[month] * weights[month - 1] for month in range(1, 13)) / sum(weights)
        series.append([year, annual])
    return count, series

def main():
    artifacts = Path("artifacts")
    artifacts.mkdir(exist_ok=True)
    records = {
        "generated_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "source": "NASA POWER monthly point API; real observations, not test fixtures",
        "period": "2001–2024",
        "variable": "T2M",
        "results": {},
    }
    for name, (latitude, longitude) in CASES.items():
        url = BASE + "?" + urlencode({
            "parameters": "T2M", "community": "AG", "longitude": longitude,
            "latitude": latitude, "start": 2001, "end": 2024, "format": "JSON",
        })
        payload = download(url)
        # Local artifact used for same-response JavaScript comparison.
        path = artifacts / f"power-{name.lower()}.json"
        path.write_text(json.dumps(payload), encoding="utf-8")
        month_count, rows = annual_series(payload)
        assert month_count == 288 and len(rows) == 24, (
            f"{name}: expected 288 valid months and 24 complete years, got {month_count}, {len(rows)}"
        )
        x, y = zip(*rows)
        reg = linregress(x, y)
        margin = t.ppf(0.975, len(rows) - 2) * reg.stderr
        py = {
            "n": len(rows), "slope": reg.slope * 10,
            "lower": (reg.slope - margin) * 10,
            "upper": (reg.slope + margin) * 10,
            "p": reg.pvalue,
        }
        js = json.loads(subprocess.run(
            ["node", "--input-type=module", "-e", JS, str(path)],
            check=True, capture_output=True, text=True,
        ).stdout)
        for metric in ("n", "slope", "lower", "upper", "p"):
            assert math.isclose(py[metric], js[metric], rel_tol=1e-8, abs_tol=1e-9), (
                f"{name} {metric}: SciPy={py[metric]!r} vs JS={js[metric]!r}"
            )
        records["results"][name] = {
            "coordinates": {"latitude": latitude, "longitude": longitude},
            "n_months": month_count, "n_complete_years": len(rows),
            "source_url": url, "scipy": py, "javascript": js,
            "annual_series": [{"year": year, "value": value} for year, value in rows],
        }
        print(f"{name}: {len(rows)} years; SciPy/JS slope={py['slope']:+.6f} °C/decade; "
              f"95% CI [{py['lower']:+.6f}, {py['upper']:+.6f}]; p={py['p']:.8g}; PASS")
    (artifacts / "scipy-verification.json").write_text(
        json.dumps(records, indent=2) + "\n", encoding="utf-8")
    print("Independent SciPy and JavaScript computations agree on the SAME live NASA responses.")

if __name__ == "__main__":
    main()

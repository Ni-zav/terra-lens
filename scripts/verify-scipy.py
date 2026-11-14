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

import numpy as np
from scipy.stats import linregress, t, theilslopes, norm

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

JS_PAIR = """
import {readFileSync} from 'node:fs';
import {parseMonthly} from './src/power.js';
import {annualMeans} from './src/stats.js';
import {pairedContrast} from './src/contrast.js';
const annual = name => annualMeans(parseMonthly(
  JSON.parse(readFileSync(name, 'utf8')), 'T2M', {start:2001,end:2024}));
const result=pairedContrast(annual(process.argv[1]),annual(process.argv[2]));
console.log(JSON.stringify({n:result.n,lag:result.hac.lag,slope:result.hac.slopePerDecade,
  se:result.hac.sePerDecade,lower:result.hac.ciLowPerDecade,
  upper:result.hac.ciHighPerDecade,p:result.hac.pValue}));
"""
def verify_paired_slope(records, artifacts):
    left={row["year"]:row["value"] for row in records["results"]["Yogyakarta"]["annual_series"]}
    right={row["year"]:row["value"] for row in records["results"]["Jakarta"]["annual_series"]}
    years=np.array(sorted(set(left)&set(right)),dtype=float)
    values=np.array([right[int(year)]-left[int(year)] for year in years],dtype=float)
    n=len(years)
    assert n>=10, "Paired comparison requires at least ten matched years."
    x=years-years.mean()
    y=values-values.mean()
    slope=float(np.dot(x,y)/np.dot(x,x))
    residual=values-(values.mean()+slope*x)
    z=x*residual
    lag=min(n-2,max(1,int(math.floor(4*(n/100)**(2/9)))))
    variance=float(np.dot(z,z))
    for k in range(1,lag+1):
        variance+=2*(1-k/(lag+1))*float(np.dot(z[k:],z[:-k]))
    se=math.sqrt(max(0,variance*(n/(n-2))/(float(np.dot(x,x))**2)))
    critical=float(t.ppf(.975,n-2))
    p=float(2*t.sf(abs(slope/se),n-2)) if se>0 else (1.0 if abs(slope)<1e-12 else 0.0)
    py={"n":n,"lag":lag,"slope":slope*10,"se":se*10,
        "lower":(slope-critical*se)*10,"upper":(slope+critical*se)*10,"p":p}
    js=json.loads(subprocess.run(
        ["node","--input-type=module","-e",JS_PAIR,
         str(artifacts/"power-yogyakarta.json"),str(artifacts/"power-jakarta.json")],
        check=True,capture_output=True,text=True,
    ).stdout)
    for metric in py:
        assert math.isclose(float(py[metric]),float(js[metric]),rel_tol=1e-7,abs_tol=1e-9), (
            f"Paired contrast {metric}: NumPy/SciPy={py[metric]!r}, JS={js[metric]!r}"
        )
    print(f"Paired B−A NASA contrast: n={n}; slope={py['slope']:+.6f} °C/decade; "
          f"HAC {lag=}, CI [{py['lower']:+.6f},{py['upper']:+.6f}]; p={p:.8g}; PASS")
    records["paired_B_minus_A"]={
        "definition":"Jakarta minus Yogyakarta, aligned complete calendar years",
        "method":"Exploratory Bartlett Newey-West HAC, HC1 scaling, approximate t(n-2)",
        "numpy_scipy":py,"javascript":js,"caveat":"Same NASA response, independent numerical implementation; not observational accuracy validation or a causal test."
    }

JS_MK = """
import {readFileSync} from 'node:fs';
import {parseMonthly} from './src/power.js';
import {annualMeans, mannKendall} from './src/stats.js';
const r=mannKendall(annualMeans(parseMonthly(JSON.parse(readFileSync(process.argv[1],'utf8')),'T2M')));
console.log(JSON.stringify({s:r.s,var_s:r.varS,z:r.z,p:r.pValue,sen:r.senSlopePerDecade,
  sen_lower:r.senCiLowPerDecade,sen_upper:r.senCiHighPerDecade}));
"""

def verify_mann_kendall(name, rows, path):
    """Mann-Kendall via NumPy sign matrix + SciPy normal; Theil-Sen via scipy.stats.theilslopes."""
    years=np.array([r[0] for r in rows],dtype=float); values=np.array([r[1] for r in rows],dtype=float)
    n=len(values)
    iu=np.triu_indices(n,1)
    s=float(np.sign(values[None,:]-values[:,None])[iu].sum())
    _,counts=np.unique(values,return_counts=True)
    var_s=(n*(n-1)*(2*n+5)-float(np.sum(counts*(counts-1)*(2*counts+5))))/18
    z=0.0 if s==0 else (s-np.sign(s))/math.sqrt(var_s)
    ts=theilslopes(values,years,alpha=0.95)
    py={"s":s,"var_s":var_s,"z":z,"p":float(2*norm.sf(abs(z))),
        "sen":ts.slope*10,"sen_lower":ts.low_slope*10,"sen_upper":ts.high_slope*10}
    js=json.loads(subprocess.run(["node","--input-type=module","-e",JS_MK,str(path)],
        check=True,capture_output=True,text=True).stdout)
    for metric in py:
        # erfc approximation has ~1e-7 relative error, so p is compared at 1e-6.
        tol=1e-6 if metric=="p" else 1e-9
        assert math.isclose(float(py[metric]),float(js[metric]),rel_tol=tol,abs_tol=1e-9), (
            f"{name} Mann-Kendall {metric}: NumPy/SciPy={py[metric]!r}, JS={js[metric]!r}")
    print(f"{name}: Mann-Kendall S={s:+.0f}, p={py['p']:.6g}; Theil-Sen {py['sen']:+.6f} "
          f"[{py['sen_lower']:+.6f},{py['sen_upper']:+.6f}] °C/decade; PASS")
    return {"numpy_scipy":py,"javascript":js}

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
        mk = verify_mann_kendall(name, rows, path)
        records["results"][name] = {
            "mann_kendall_theil_sen": mk,
            "coordinates": {"latitude": latitude, "longitude": longitude},
            "n_months": month_count, "n_complete_years": len(rows),
            "source_url": url, "scipy": py, "javascript": js,
            "annual_series": [{"year": year, "value": value} for year, value in rows],
        }
        print(f"{name}: {len(rows)} years; SciPy/JS slope={py['slope']:+.6f} °C/decade; "
              f"95% CI [{py['lower']:+.6f}, {py['upper']:+.6f}]; p={py['p']:.8g}; PASS")
    verify_paired_slope(records, artifacts)
    (artifacts / "scipy-verification.json").write_text(
        json.dumps(records, indent=2) + "\n", encoding="utf-8")
    print("Independent SciPy and JavaScript computations agree on the SAME live NASA responses.")

if __name__ == "__main__":
    main()

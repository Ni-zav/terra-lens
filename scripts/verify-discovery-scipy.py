#!/usr/bin/env python3
"""Independently check saved real NASA screen evidence.

Uses numpy and scipy, not the browser JS stats implementation.
Recomputes annual Gregorian-day means, classical regression, and selected-pair
HAC as a diagnostic. This checks numerical reproduction, not physical truth,
statistical selection validity, or NASA resource-tab compliance.
"""
import argparse
import calendar
import json
import math
from pathlib import Path
import numpy as np
from scipy import stats

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("evidence", nargs="?", type=Path, default=Path(__file__).resolve().parents[1] / "artifacts" / "discovery-nasa-evidence.json")
path = parser.parse_args().evidence
doc = json.loads(path.read_text())
assert doc["schema"] == "terra-lens-sentinel-screen-v1"
records = doc["records"]
assert len(records) == 8, "Expected eight predeclared real NASA points"
assert all(r["status"] == "ok" for r in records)
assert all(r["sourceURL"].startswith("https://power.larc.nasa.gov/") for r in records)
for record in records:
    monthly = {(r["year"], r["month"]): r["value"] for r in record["monthly"]}
    annual = record["annual"]
    assert len(monthly) == len(record["monthly"]), "Duplicated month"
    assert len(annual) >= 10
    for row in annual:
        year = row["year"]
        assert all((year, m) in monthly for m in range(1, 13))
        days = [calendar.monthrange(year, month)[1] for month in range(1, 13)]
        mean = sum(monthly[(year, m)] * days[m-1] for m in range(1,13)) / sum(days)
        assert math.isclose(mean, row["value"], abs_tol=1e-10), (record["label"], year)
    year = np.array([p["year"] for p in annual], dtype=float)
    values = np.array([p["value"] for p in annual], dtype=float)
    fit = stats.linregress(year, values)
    observed = record["trend"]
    assert math.isclose(fit.slope*10, observed["slopePerDecade"], abs_tol=1e-8), record["label"]
    assert math.isclose(fit.pvalue, observed["pValue"], abs_tol=1e-8), record["label"]
    ci = stats.t.ppf(.975, len(year)-2)*fit.stderr*10
    assert math.isclose(fit.slope*10-ci, observed["ciLowPerDecade"], abs_tol=1e-7)
    assert math.isclose(fit.slope*10+ci, observed["ciHighPerDecade"], abs_tol=1e-7)
    print(f'{record["label"]}: {len(year)} years; SciPy slope {fit.slope*10:+.6f} {doc["protocol"]["unit"]}/decade; PASS')

pair = doc["selectedPairedContrast"]
if pair:
    by_id = {r["id"]:r for r in records}
    selected = doc["selected"]
    a,b = by_id[selected["A"]],by_id[selected["B"]]
    ya = {p["year"]:p["value"] for p in a["annual"]}
    yb = {p["year"]:p["value"] for p in b["annual"]}
    years = sorted(set(ya).intersection(yb))
    assert len(years) == pair["n"]
    x = np.asarray(years,dtype=float)
    d = np.asarray([yb[y]-ya[y] for y in years],dtype=float)
    center = x-x.mean()
    slope = (center*d).sum()/(center*center).sum()
    residual = d-(d.mean()+slope*center)
    lag = min(len(x)-2,max(1,int(4*(len(x)/100)**(2/9))))
    z = center*residual
    variance_sum = (z*z).sum()
    for k in range(1,lag+1):
        variance_sum += 2*(1-k/(lag+1)) * (z[k:]*z[:-k]).sum()
    variance = max(0,variance_sum*len(x)/(len(x)-2) / (center@center)**2)
    se = math.sqrt(variance)
    t = slope/se if se>0 else (0 if abs(slope)<1e-12 else float("inf"))
    df = len(x)-2
    critical=stats.t.ppf(.975,df)
    p=2*stats.t.sf(abs(t),df)
    assert math.isclose(slope*10,pair["hac"]["slopePerDecade"],abs_tol=1e-8)
    assert math.isclose((slope-critical*se)*10,pair["hac"]["ciLowPerDecade"],abs_tol=1e-7)
    assert math.isclose((slope+critical*se)*10,pair["hac"]["ciHighPerDecade"],abs_tol=1e-7)
    assert math.isclose(p,pair["hac"]["pValue"],abs_tol=1e-7)
    print(f'Post-selected pair {a["label"]} to {b["label"]}: {len(x)} years; '
          f'approximate HAC slope difference {slope*10:+.6f}; p={p:.6f}; '
          f'NUMERICALLY VERIFIED; NOT confirmatory post-selection evidence.')
print("PASS: eight real NASA responses independently reproduced in SciPy. No physical/eligibility certification.")

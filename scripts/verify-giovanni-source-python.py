#!/usr/bin/env python3
"""Recompute participant-supplied NASA Giovanni monthly CSV evidence numerically.

This verifies JS computations against a separate reference implementation.
It does NOT authenticate the original file, DOI, NASA login or Space Apps
source eligibility. Requires scipy and the JSON produced by JS verifier.
"""
import calendar
import hashlib
import json
import math
import os
from collections import defaultdict
from pathlib import Path
from scipy.stats import linregress, t as student_t

p=Path(os.getenv('GIOVANNI_EVIDENCE_FILE',Path(__file__).resolve().parents[1]/'artifacts'/'giovanni-source-evidence.json'))
d=json.loads(p.read_text())
assert d['schema']=='terra-lens-giovanni-real-source-evidence-v1'
assert d['sourceClaimsRequireManualNASAReview'] is True
raw=d['originalMonthlyRecords']
assert len(raw)>=120
month_seen=set()
by_year=defaultdict(dict)
for r in raw:
    y,m,v=r['year'],r['month'],r['value']
    assert (y,m) not in month_seen,'duplicate monthly record'
    month_seen.add((y,m))
    assert 1<=m<=12 and math.isfinite(v)
    by_year[y][m]=v
annual=[]
for year,months in sorted(by_year.items()):
    if len(months)!=12:continue
    weights=[calendar.monthrange(year,m)[1] for m in range(1,13)]
    annual.append({'year':year,
                   'value':sum(months[m]*weights[m-1] for m in range(1,13))/sum(weights)})
actual=d['derivedDayWeightedCompleteYears']
assert len(annual)==len(actual)>=10,'Need at least ten complete years'
for a,b in zip(annual,actual):
    assert a['year']==b['year'] and math.isclose(a['value'],b['value'],abs_tol=1e-9)
reg=linregress([r['year'] for r in annual],[r['value'] for r in annual])
ols=d['classicalOLS']
assert math.isclose(reg.slope,ols['slopePerYear'],abs_tol=1e-10)
assert math.isclose(reg.slope*10,ols['slopePerDecade'],abs_tol=1e-9)
assert math.isclose(reg.pvalue,ols['pValue'],abs_tol=1e-7)
critical=student_t.ppf(.975,len(annual)-2)
assert math.isclose((reg.slope-critical*reg.stderr)*10,ols['ciLowPerDecade'],abs_tol=1e-6)
assert math.isclose((reg.slope+critical*reg.stderr)*10,ols['ciHighPerDecade'],abs_tol=1e-6)
original=os.getenv('GIOVANNI_CSV_FILE')
if original:
    digest=hashlib.sha256(Path(original).read_bytes()).hexdigest()
    assert digest==d['originalCSV']['sha256'],'Original NASA file changed since JS evidence was produced'
else:
    print('WARNING: original file not supplied to Python, SHA cannot be checked again.')
print(f'PASS: {len(annual)} complete-year aggregates and classical OLS match SciPy from the actual supplied monthly records')
print('Unverified: NASA file authenticity, product ID/DOI, geographical support, source QA and challenge eligibility. Verify these manually.')

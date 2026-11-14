#!/usr/bin/env python3
"""Independent Python check from actual NASA GISS+POWER downloaded records."""
import json,math,calendar,statistics
from pathlib import Path
p=Path(__file__).resolve().parents[1]/'artifacts'/'gistemp-power-global-local.json'
d=json.loads(p.read_text())
assert d['schema']=='terra-lens-gistemp-power-real-evidence-v1'
source=d['comparison']['advanced']['sources']
assert len(source)==2
assert len(d['global']['series'])>=288
assert d['global']['sourceURL'].startswith('https://data.giss.nasa.gov/')
if d['global'].get('notLive'):
 assert d['global'].get('snapshotDate')=='2026-11-14'
 assert 'snapshot' in d['gissAcquisition'].lower()
# Independent spot checks against NASA GISS official 2026-11-14 original text.
spot={(2001,1):0.45,(2016,2):1.36,(2024,12):1.26}
actual={(r['year'],r['month']):r['value'] for r in d['global']['series']}
for key,expected in spot.items():
 assert math.isclose(actual[key],expected,abs_tol=1e-12),('NASA original value mismatch',key)
assert len(d['local']['monthly'])==288
def rebase(rows):
 groups={m:[] for m in range(1,13)}
 for r in rows:
  if 2001<=r['year']<=2020: groups[r['month']].append(r['value'])
 assert all(len(v)==20 for v in groups.values())
 normal={m:statistics.mean(v) for m,v in groups.items()}
 return [{'year':r['year'],'month':r['month'],'value':r['value']-normal[r['month']]}
         for r in rows if 2001<=r['year']<=2024]
def aggregate(rows):
 months={(r['year'],r['month']):r['value'] for r in rows}
 assert len(months)==len(rows)
 output=[]
 for y in range(2001,2025):
  weights=[calendar.monthrange(y,m)[1] for m in range(1,13)]
  vals=[months[(y,m)] for m in range(1,13)]
  output.append((y,sum(w*v for w,v in zip(weights,vals))/sum(weights)))
 return output
def slope(series):
 ym=statistics.mean(y for y,v in series)
 vm=statistics.mean(v for y,v in series)
 return 10*sum((y-ym)*(v-vm) for y,v in series)/sum((y-ym)**2 for y,v in series)
for raw,derived in [(d['local']['monthly'],source[0]),(d['global']['series'],source[1])]:
 annual=aggregate(rebase(raw))
 assert len(annual)==len(derived['annual'])==24
 for (year,v),js in zip(annual,derived['annual']):
  assert year==js['year']
  assert math.isclose(v,js['value'],abs_tol=1e-10)
 rate=slope(annual)
 assert math.isclose(rate,derived['trend']['slopePerDecade'],abs_tol=1e-8)
 print('PASS independent NASA record, rebasing, annual day weights and trend:',derived['source'],rate)
print('Independent numeric agreement does not certify GISS/POWER equivalence, source uncertainties, or award eligibility.')

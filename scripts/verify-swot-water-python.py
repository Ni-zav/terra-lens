#!/usr/bin/env python3
"""Independent Python verification of NASA's real SWOT/POWER evidence.

No invented observations; verifies the saved original numeric records and
month-group aggregation, date support and exclusions. It does NOT certify
the physical origin beyond recorded source URLs or NASA eligibility.
"""
import json
import math
import statistics
from datetime import datetime
from pathlib import Path
e=json.loads((Path(__file__).resolve().parents[1]/'artifacts'/'swot-nasa-water-case.json').read_text())
assert e['schema']=='terra-lens-swot-nasa-water-evidence-v1'
swot,power=e['swot'],e['power']
assert swot['sourceURL'].startswith('https://soto.podaac.earthdatacloud.nasa.gov/')
assert power['url'].startswith('https://power.larc.nasa.gov/')
assert swot['collection']=='SWOT_L2_HR_RiverSP_D'
assert len(power['monthly'])==12
valid=swot['observations']
assert len(valid)>=5
assert all(o['reachId']=='74267300251' for o in valid)
assert all(o['quality']<=2 for o in valid)
assert all(o['value']>0 and math.isfinite(o['value']) for o in valid)
from collections import defaultdict
groups=defaultdict(list)
for row in valid:
    date=datetime.fromisoformat(row['time'].replace('Z','+00:00'))
    groups[date.strftime('%Y-%m')].append(row['value'])
assert len(groups)>=2
for entry in swot['monthly']:
    values=groups[entry['month']]
    assert entry['count']==len(values)
    assert math.isclose(statistics.mean(values),entry['meanObserved'],abs_tol=1e-10)
    assert math.isclose(min(values),entry['minObserved'],abs_tol=1e-10)
    assert math.isclose(max(values),entry['maxObserved'],abs_tol=1e-10)
aligned=e['caseStudy']['advanced']['harmonization']['pairs']
rain={f"{r['year']}-{r['month']:02d}":r['value'] for r in power['monthly']}
assert len(rain)==12
for pair in aligned:
    assert pair['month'] in groups and pair['month'] in rain
    assert math.isclose(pair['swotMeanObservedM'],statistics.mean(groups[pair['month']]),abs_tol=1e-10)
    assert math.isclose(pair['powerValue'],rain[pair['month']],abs_tol=1e-10)
print('PASS: independent Python real-SWOT/POWER monthly support and numeric aggregation')
print('SWOT observations:',len(valid),'months:',len(groups),'matched:',len(aligned))
print('QA:',swot['qualityCounts'],'excluded:',len(swot['excluded']))
print('Satellite-observed WSE min-max:',min(r['value'] for r in valid),max(r['value'] for r in valid))
print('No continuous gauge, flood stage, long-term trend significance, or causation claimed.')

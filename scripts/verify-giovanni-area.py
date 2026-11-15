#!/usr/bin/env python3
"""Independently parse the original NASA NetCDF and CSV; compare with JS/SciPy."""
import calendar, csv, hashlib, json, subprocess
from pathlib import Path
import numpy as np
from netCDF4 import Dataset, num2date
from scipy.stats import linregress, t
root = Path(__file__).resolve().parents[1]
base = root/'data/source-snapshots/g4.areaAvgTimeSeries.M2TMNXSLV_5_12_4_T2M.20010101-20241231.110E_8S_111E_7S'
csvfile, ncfile = Path(str(base)+'.csv'), Path(str(base)+'.nc')
for path, expected in [(csvfile,'ff7cd37fd010ae16015ce22400c2cb583c975c6d9277e0235cbd674d774e54dc'), (ncfile,'d9a320f77ef79b65ec6dba4454e247c700b420cb4966270cf677f88f75f74668')]:
    assert hashlib.sha256(path.read_bytes()).hexdigest() == expected
rows=list(csv.reader(csvfile.open(newline='')))
header=next(i for i,r in enumerate(rows) if r and r[0]=='time')
monthly={(int(r[0][:4]),int(r[0][5:7])):float(r[1]) for r in rows[header+1:] if r}
assert len(monthly)==288
with Dataset(ncfile) as ds:
    v=ds.variables['M2TMNXSLV_5_12_4_T2M']; times=ds.variables['time']
    assert v.units=='K' and v.product_short_name=='M2TMNXSLV' and v.product_version=='5.12.4'
    assert len(v)==288 and not np.ma.getmaskarray(v[:]).any()
    assert not any('quality' in name.lower() or 'flag' in name.lower() for name in ds.variables)
    dates=num2date(times[:],times.units)
    differences=[abs(float(value)-monthly[(date.year,date.month)]) for date,value in zip(dates,v[:])]
    assert max(differences)<0.00002
annual=[]
for year in range(2001,2025):
    w=[calendar.monthrange(year,m)[1] for m in range(1,13)]
    annual.append(sum(monthly[year,m]*w[m-1] for m in range(1,13))/sum(w))
reg=linregress(range(2001,2025),annual)
critical=t.ppf(.975,22)
js=json.loads(subprocess.check_output(['node','scripts/verify-giovanni-area.mjs'],cwd=root))
assert all(abs(a-b['value'])<1e-9 for a,b in zip(annual,js['annual']))
assert abs(reg.slope*10-js['trend']['slopePerDecade'])<1e-9
assert abs(reg.pvalue-js['trend']['pValue'])<1e-7
assert abs((reg.slope-critical*reg.stderr)*10-js['trend']['ciLowPerDecade'])<1e-6
assert abs((reg.slope+critical*reg.stderr)*10-js['trend']['ciHighPerDecade'])<1e-6
print(f'PASS: 288 CSV/NetCDF months (max rounding difference {max(differences):.9g} K), 24 annual means, slope {reg.slope*10:.9f} K/decade, p={reg.pvalue:.9f}, 95% CI [{(reg.slope-critical*reg.stderr)*10:.9f}, {(reg.slope+critical*reg.stderr)*10:.9f}] agree')

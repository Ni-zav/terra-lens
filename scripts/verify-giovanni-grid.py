#!/usr/bin/env python3
"""Reproduce Giovanni's original area aggregate from two intermediates.

Run from the public Terra-Lens checkout. Inputs are preserved NASA NetCDF
files; this verifies area aggregation, not original native-granule lineage.
Requires netCDF4, NumPy and SciPy.
"""
import calendar, glob, hashlib
from pathlib import Path
import netCDF4, numpy as np
from scipy.stats import linregress, t
root=Path(__file__).resolve().parent.parent/'data'/'source-snapshots'
inputs=[('first',200,'bbc7cb7fd75fd4856e6671380fdeffc76ea3c02f21b3011f36e2f1bba65c5766'),('second',88,'fdf05b71256eca606080f61077c9e2f54af298a2c05a69fb3cc055aa4fe276ee')]
aggregate=glob.glob('data/source-snapshots/g4.areaAvgTimeSeries.M2TMNXSLV_5_12_4_T2M.*.nc')[0]
assert hashlib.sha256(Path(aggregate).read_bytes()).hexdigest()=='d9a320f77ef79b65ec6dba4454e247c700b420cb4966270cf677f88f75f74668'
with netCDF4.Dataset(aggregate) as area:
    offset=0; maximum=0; all_values=[]
    for label,count,expected_hash in inputs:
        path=root/f'giovanni-m2tmnxslv-t2m-{label}-weighted.nc';raw=path.read_bytes()
        assert hashlib.sha256(raw).hexdigest()==expected_hash
        with netCDF4.Dataset(path) as grid:
            name='M2TMNXSLV_5_12_4_T2M';values=grid[name][:].astype('f8');weights=np.asarray(grid['wlat'][:],dtype='f8')
            assert values.shape==(count,3,2) and np.ma.count_masked(values)==0
            assert np.array_equal(grid['lat'][:],[-8,-7.5,-7]) and np.array_equal(grid['lon'][:],[110,110.625])
            assert np.array_equal(grid['time'][:],area['time'][offset:offset+count])
            calculated=np.sum(values*weights[None,:,None],axis=(1,2))/(weights.sum()*values.shape[2])
            difference=np.abs(np.asarray(calculated)-np.asarray(area[name][offset:offset+count],dtype='f8'))
            error=float(difference.max());assert error<0.00002
            all_values.extend(np.asarray(calculated).tolist())
            maximum=max(maximum,error);offset+=count
            print(label,count,'months; max absolute difference K:',error,'SHA-256:',expected_hash)
    assert offset==len(area['time'])==288
    print('PASS all 288 months: six grid cells and latitude weights reproduce the original area aggregate; max difference K:',maximum)
    years=list(range(2001,2025));annual=[]
    for i,year in enumerate(years):
        days=np.array([calendar.monthrange(year,m)[1] for m in range(1,13)])
        annual.append(np.average(all_values[12*i:12*i+12],weights=days))
    fit=linregress(years,annual);margin=t.ppf(.975,22)*fit.stderr
    assert abs(fit.slope*10-0.177171412)<0.00001
    print('Grid-derived OLS K/decade:',fit.slope*10,'95% CI:',(fit.slope-margin)*10,(fit.slope+margin)*10,'p:',fit.pvalue)

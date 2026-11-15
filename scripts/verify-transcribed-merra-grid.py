#!/usr/bin/env python3
"""Compare owner-transcribed NASA subset values with the Giovanni intermediate.

Requires numpy and netCDF4. Transcription is not an original NASA file, and
matching current granules does not prove historical input lineage or quality.
"""
import json
from pathlib import Path
import netCDF4, numpy as np
root=Path(__file__).resolve().parent.parent/'data'/'source-snapshots'
source=json.loads((root/'owner-transcribed-merra-reprocessed-grid-202009-202109.json').read_text())
assert set(source['months'])=={'2020-09','2021-06','2021-07','2021-08','2021-09'}
with netCDF4.Dataset(root/'giovanni-m2tmnxslv-t2m-second-weighted.nc') as data:
    assert np.array_equal(data['lat'][:],source['latitudes'])
    assert np.array_equal(data['lon'][:],source['longitudes'])
    dates=netCDF4.num2date(data['time'][:],data['time'].units)
    for month,record in source['months'].items():
        year,mo=map(int,month.split('-'))
        index=next(i for i,date in enumerate(dates) if date.year==year and date.month==mo)
        actual=np.asarray(data['M2TMNXSLV_5_12_4_T2M'][index,:,:],dtype='f8')
        delta=np.abs(actual-np.asarray(record['values_K'],dtype='f8'))
        assert delta.shape==(3,2) and delta.max()<=0.00051
        print(month,record['granule'],'six cells match owner-transcribed values to 0.001 K; maximum difference K',float(delta.max()))

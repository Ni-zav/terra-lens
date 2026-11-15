#!/usr/bin/env python3
"""Verify byte-preserved NASA OPeNDAP MERRA2_401 subsets and owner-transcribed grid values
against the Giovanni weighted intermediate NetCDF (`giovanni-m2tmnxslv-t2m-second-weighted.nc`).

Requires numpy and netCDF4.
"""
import hashlib
import json
from pathlib import Path
import netCDF4
import numpy as np

root = Path(__file__).resolve().parent.parent / "data" / "source-snapshots"
dap_dir = root / "opendap-merra2-reprocessed-202009-202109"
source = json.loads((root / "owner-transcribed-merra-reprocessed-grid-202009-202109.json").read_text())
assert set(source["months"]) == {"2020-09", "2021-06", "2021-07", "2021-08", "2021-09"}

expected_opendap = {
    "2020-09": {
        "granule": "MERRA2_401.tavgM_2d_slv_Nx.202009.nc4",
        "nc4_sha256": "ba1c75ba6305fa95490ed9a33b339d1ce0686ce2a807cabd51cc0576a48bf78c",
        "csv_sha256": "7af40c8075e1f46cb859deb1aff82cdf60887342c0cf2f6d60f9fedce3331152",
    },
    "2021-06": {
        "granule": "MERRA2_401.tavgM_2d_slv_Nx.202106.nc4",
        "nc4_sha256": "62395054ebf9f41558f60385e1cce3ee1ad93eefab796a31111616985f4f2526",
        "csv_sha256": "0f2d27f019b7c01dff59a8ba0f096a244e1a11e84c365e6053df23cd5f318371",
    },
    "2021-07": {
        "granule": "MERRA2_401.tavgM_2d_slv_Nx.202107.nc4",
        "nc4_sha256": "8c0a811bacdfa5057f8c3f6e0f5319e11650c2485f79750690d7886806658423",
        "csv_sha256": "705fb13dbb9d9edf3cbc15619ac1b0959be99f26e2c0e7bd74515280377d8f44",
    },
    "2021-08": {
        "granule": "MERRA2_401.tavgM_2d_slv_Nx.202108.nc4",
        "nc4_sha256": "7c7e4d6d952414fd9c8d74c24a253fccfe3c07476a60f05a5a58be9dce7db8aa",
        "csv_sha256": "834c5f90512a4ca69a88c08ed3257df3a522a97e9a6f6d207cca78ed597d8aa8",
    },
    "2021-09": {
        "granule": "MERRA2_401.tavgM_2d_slv_Nx.202109.nc4",
        "nc4_sha256": "86c82000352664be8ce42a16de9b82c9fd25b9c172fe6402bbe53a1e7c681c71",
        "csv_sha256": "a770f63fc440c6f830b006da0074a71e107368b08e1444e9b8e3fe5fce5f6c5e",
    },
}

with netCDF4.Dataset(root / "giovanni-m2tmnxslv-t2m-second-weighted.nc") as data:
    assert np.array_equal(data["lat"][:], source["latitudes"])
    assert np.array_equal(data["lon"][:], source["longitudes"])
    dates = netCDF4.num2date(data["time"][:], data["time"].units)
    for month, record in source["months"].items():
        year, mo = map(int, month.split("-"))
        index = next(i for i, date in enumerate(dates) if date.year == year and date.month == mo)
        actual_f32 = np.asarray(data["M2TMNXSLV_5_12_4_T2M"][index, :, :], dtype="f4")
        actual_f64 = actual_f32.astype("f8")

        # 1. Verify byte-preserved NASA OPeNDAP .dap.nc4 and .dap.csv subsets
        exp = expected_opendap[month]
        gran = exp["granule"]
        assert gran == record["granule"]
        nc4_file = dap_dir / f"{gran}.dap.nc4"
        csv_file = dap_dir / f"{gran}.dap.csv"
        assert hashlib.sha256(nc4_file.read_bytes()).hexdigest() == exp["nc4_sha256"]
        assert hashlib.sha256(csv_file.read_bytes()).hexdigest() == exp["csv_sha256"]

        with netCDF4.Dataset(nc4_file) as nds:
            assert str(nds.getncattr("GranuleID")) == gran
            assert str(nds.getncattr("ShortName")) == "M2TMNXSLV"
            assert str(nds.getncattr("VersionID")) == "5.12.4"
            assert str(nds.getncattr("identifier_product_doi")) == "10.5067/AP1B0BA5PD2K"
            prod_dt = str(nds.getncattr("ProductionDateTime"))
            assert prod_dt.startswith("Re-processed file generated:")
            dap_f32 = np.asarray(nds["T2M"][0, :, :], dtype="f4")
            assert np.array_equal(actual_f32, dap_f32), f"Float32 mismatch for {month}"
            dap_diff = float(np.max(np.abs(actual_f64 - dap_f32.astype("f8"))))
            assert dap_diff == 0.0

        # 2. Verify earlier 3-decimal owner transcription matches within rounding
        delta = np.abs(actual_f64 - np.asarray(record["values_K"], dtype="f8"))
        assert delta.shape == (3, 2) and delta.max() <= 0.00051
        print(
            f"{month} {gran}: byte-preserved OPeNDAP .dap.nc4 exact float32 bit-equal (diff={dap_diff:.1f} K, "
            f"{prod_dt}); 3-decimal transcription max diff={float(delta.max()):.6f} K"
        )

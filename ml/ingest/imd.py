"""IMD gridded truth: 0.25 deg daily rainfall and 1.0 deg daily Tmax, via imdlib.

Raw .grd files are mirrored under ml/cache/imd the first time (imdpune.gov.in is sometimes
offline); later runs read the mirror. Values are extracted at each configured point from the
nearest grid cell with data (IMD grids are land-only, so coastal centroids can fall on sea
cells); the chosen cell and its distance are stored for transparency.

    python -m ml.ingest.imd [--years 2024 2025]
"""

from __future__ import annotations

import argparse
import logging

import numpy as np
import pandas as pd
import xarray as xr

from ml.common import path, points

log = logging.getLogger("imd")

VARS = {"rain": "rain", "tmax": "tmax"}   # imdlib name per internal variable
MISSING = -999.0


def load(var: str, years: list[int]) -> xr.DataArray:
    import imdlib as imd

    raw_dir = path("cache_dir", "imd")
    name = VARS[var]
    missing = [y for y in years if not list((raw_dir / name).glob(f"{y}*"))]
    if missing:
        log.info("downloading IMD %s for %s", name, missing)
        imd.get_data(name, min(missing), max(missing), fn_format="yearwise", file_dir=str(raw_dir))
    data = imd.open_data(name, min(years), max(years), "yearwise", str(raw_dir))
    da = data.get_xarray()[name] if name in data.get_xarray() else data.get_xarray().to_array().squeeze()
    return da.where(da != MISSING)


def nearest_valid(da: xr.DataArray, lat: float, lon: float, max_cells: int = 2) -> tuple[pd.Series, float, float]:
    """Series from the nearest cell (within max_cells) that has data on at least 90% of days."""
    step = float(abs(da.lat[1] - da.lat[0]))
    best = None
    for dlat in np.arange(-max_cells, max_cells + 1):
        for dlon in np.arange(-max_cells, max_cells + 1):
            la, lo = lat + dlat * step, lon + dlon * step
            cell = da.sel(lat=la, lon=lo, method="nearest")
            clat, clon = float(cell.lat), float(cell.lon)
            valid = float(cell.notnull().mean())
            dist = np.hypot(clat - lat, clon - lon)
            if valid >= 0.9 and (best is None or dist < best[0]):
                best = (dist, cell, clat, clon)
    if best is None:
        raise ValueError(f"no IMD cell with data near {lat}, {lon}")
    _, cell, clat, clon = best
    return cell.to_series(), clat, clon


def extract(var: str, years: list[int]) -> pd.DataFrame:
    da = load(var, years)
    frames = []
    for p in points():
        s, clat, clon = nearest_valid(da, p.lat, p.lon)
        frames.append(pd.DataFrame({
            "point_id": p.id,
            "date": pd.to_datetime(s.index).date,
            "var": var,
            "value": s.to_numpy("float32"),
            "cell_lat": np.float32(clat),
            "cell_lon": np.float32(clon),
        }))
    return pd.concat(frames, ignore_index=True)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--years", type=int, nargs="+", default=[2024, 2025])
    args = ap.parse_args()
    out = path("data_dir", "truth")
    for var in VARS:
        df = extract(var, args.years)
        df.to_parquet(out / f"imd_{var}.parquet", index=False)
        log.info("IMD %s: %d rows, %.1f%% non-missing -> %s", var, len(df), 100 * df["value"].notna().mean(), out)


if __name__ == "__main__":
    main()

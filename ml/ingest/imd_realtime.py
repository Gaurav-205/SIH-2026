"""IMD real-time daily gridded rainfall (0.25 deg) and Tmax (1.0 deg), from the day after the last
final yearly grid up to yesterday, via imdlib. Incremental: only missing days are downloaded;
raw .grd files are mirrored under ml/cache/imd_realtime.

Real-time grids are preliminary (fewer gauges than the final yearly product), so every row is
tagged `kind = imd_realtime`; the final grids (ml.ingest.imd) are `kind = imd_final`.

    python -m ml.ingest.imd_realtime [--start 2026-01-01]
"""

from __future__ import annotations

import argparse
import datetime as dt
import logging

import numpy as np
import pandas as pd
import xarray as xr

from ml.common import path, points
from ml.ingest.imd import MISSING, nearest_valid

log = logging.getLogger("imd_realtime")

VARS = {"rain": "rain", "tmax": "tmax"}


def _file_date(name: str, var: str) -> dt.date | None:
    """Date of an imdlib real-time file: rain_ind0.25_YY_MM_DD.grd (rain) or maxDDMMYYYY.grd (tmax)."""
    stem = name.rsplit(".", 1)[0]
    try:
        if var == "rain" and stem.startswith("rain_ind0.25_"):
            yy, mm, dd = stem.split("_")[-3:]
            return dt.date(2000 + int(yy), int(mm), int(dd))
        if var == "tmax" and stem.startswith("max"):
            return dt.datetime.strptime(stem[3:], "%d%m%Y").date()
    except ValueError:
        pass
    return None


def raw_dir():
    # imdlib writes real-time files flat into file_dir
    return path("cache_dir", "imd_realtime")


def download(var: str, start: dt.date, end: dt.date) -> None:
    import imdlib as imd

    raw = raw_dir()
    have = {d for f in raw.glob("*.grd") if (d := _file_date(f.name, var))}
    day = start
    while day <= end:
        if day not in have:
            try:
                imd.get_real_data(VARS[var], day.isoformat(), day.isoformat(), file_dir=str(raw))
            except Exception as e:  # IMD's server occasionally has gaps; record and move on
                log.warning("IMD real-time %s %s unavailable: %s", var, day, e)
        day += dt.timedelta(days=1)


def load(var: str, start: dt.date, end: dt.date) -> xr.DataArray:
    import imdlib as imd

    # imdlib's loader fails on any missing day, so open only the days we have (IMD's server has gaps)
    raw = raw_dir()
    days = sorted(d for f in raw.glob("*.grd") if (d := _file_date(f.name, var)) and start <= d <= end)
    if not days:
        raise FileNotFoundError(f"no IMD real-time {var} files between {start} and {end}")
    parts = []
    for d in days:
        ds = imd.open_real_data(VARS[var], d.isoformat(), d.isoformat(), str(raw)).get_xarray()
        parts.append(ds[VARS[var]] if VARS[var] in ds else ds.to_array().squeeze(drop=True))
    da = xr.concat(parts, dim="time")
    return da.where(da != MISSING)


DEFAULT_START = "2026-01-01"  # first day not covered by a final yearly IMD grid


def main_for_cycle() -> None:
    update(dt.date.fromisoformat(DEFAULT_START))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--start", default=DEFAULT_START, help="first day not covered by a final yearly grid")
    update(dt.date.fromisoformat(ap.parse_args().start))


def update(start: dt.date) -> None:
    end = dt.datetime.now(dt.UTC).date() - dt.timedelta(days=1)
    out = path("data_dir", "truth")
    for var in VARS:
        download(var, start, end)
        da = load(var, start, end)
        frames = []
        for p in points():
            s, clat, clon = nearest_valid(da, p.lat, p.lon)
            frames.append(pd.DataFrame({
                "point_id": p.id, "date": pd.to_datetime(s.index).date, "var": var,
                "value": s.to_numpy("float32"), "cell_lat": np.float32(clat), "cell_lon": np.float32(clon),
                "kind": "imd_realtime",
            }))
        df = pd.concat(frames, ignore_index=True)
        df.to_parquet(out / f"imd_realtime_{var}.parquet", index=False)
        log.info("IMD real-time %s %s..%s: %d rows, %.1f%% non-missing", var, start, end, len(df), 100 * df["value"].notna().mean())


if __name__ == "__main__":
    main()

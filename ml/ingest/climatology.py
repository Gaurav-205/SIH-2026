"""IMD 1991-2020 climatology at the truth cells, and a daily monsoon-core-zone rain index.

Uses the same IMD grids as the truth (0.25 deg rain, 1.0 deg Tmax) and exactly the same grid cell per
point as ml/data/truth/imd_*.parquet, so climatological probabilities are directly comparable with the
verification data. Years are processed one at a time (downloaded once and mirrored in ml/cache/imd) and
cached as small per-year Parquet files, so an interrupted run resumes where it stopped.

Outputs (ml/data/static/):
  climatology_rain.parquet   point_id, doy, mean, wet_freq, p90, p95, p99, p_ge_64_5, p_ge_115_6, p_ge_204_5
  climatology_tmax.parquet   point_id, doy, mean, sd
  core_zone_rain.parquet     date, core_mm (area mean over the configured core-zone box, land cells)
  core_zone_clim.parquet     doy, mean, sd

    python -m ml.ingest.climatology            # download what is missing, then aggregate
"""

from __future__ import annotations

import argparse
import logging

import numpy as np
import pandas as pd

from ml.common import config, path

log = logging.getLogger("climatology")


def doy_leap(dates: pd.DatetimeIndex) -> np.ndarray:
    """Day of year on a leap-year calendar (1..366), so 1 March is always day 61."""
    d = pd.DatetimeIndex(dates)
    return pd.to_datetime({"year": 2000, "month": d.month, "day": d.day}).dt.dayofyear.to_numpy()


def circular_window(doy: np.ndarray, center: int, half: int) -> np.ndarray:
    diff = np.abs(doy - center)
    return np.minimum(diff, 366 - diff) <= half


def truth_cells(var: str) -> pd.DataFrame:
    t = pd.read_parquet(path("data_dir", "truth") / f"imd_{var}.parquet", columns=["point_id", "cell_lat", "cell_lon"])
    return t.drop_duplicates("point_id").reset_index(drop=True)


def year_file(var: str, year: int):
    return path("data_dir", "static", "clim_years") / f"{var}_{year}.parquet"


# IMD binary grids have a fixed size: cells x days x 4 bytes (0.25 deg rain 135 x 129, 1 deg Tmax 31 x 31)
GRID_CELLS = {"rain": 135 * 129, "tmax": 31 * 31}
ATTEMPTS = 3


def raw_file_ok(var: str, year: int) -> bool:
    """True if the mirrored yearly file is complete; a truncated file is deleted so it is fetched again."""
    files = list((path("cache_dir", "imd") / var).glob(f"{year}.*"))
    if not files:
        return False
    days = 366 if pd.Timestamp(year=year, month=12, day=31).dayofyear == 366 else 365
    if files[0].stat().st_size != GRID_CELLS[var] * days * 4:
        log.warning("IMD %s %d: incomplete file (%d bytes), re-downloading", var, year, files[0].stat().st_size)
        files[0].unlink()
        return False
    return True


def extract_year(var: str, year: int) -> pd.DataFrame | None:
    """Point series at the truth cells (+ core-zone mean for rain) for one year; None if unavailable."""
    import time

    from ml.ingest.imd import load

    da = None
    for attempt in range(1, ATTEMPTS + 1):
        raw_file_ok(var, year)
        try:
            da = load(var, [year])
            if raw_file_ok(var, year):
                break
            da = None
        except Exception as e:  # imdpune.gov.in times out now and then; retry, then report and continue
            log.warning("IMD %s %d attempt %d/%d failed: %s", var, year, attempt, ATTEMPTS, str(e)[:120])
        time.sleep(10 * attempt)
    if da is None:
        return None
    frames = []
    for _, c in truth_cells(var).iterrows():
        s = da.sel(lat=c.cell_lat, lon=c.cell_lon).to_series()
        frames.append(pd.DataFrame({"point_id": c.point_id, "date": pd.to_datetime(s.index), "value": s.to_numpy("float32")}))
    if var == "rain":
        box = config()["regimes"]["core_zone"]
        core = da.sel(lat=slice(*box["lat"]), lon=slice(*box["lon"])).mean(["lat", "lon"], skipna=True).to_series()
        frames.append(pd.DataFrame({"point_id": "__core_zone__", "date": pd.to_datetime(core.index), "value": core.to_numpy("float32")}))
    return pd.concat(frames, ignore_index=True)


def download(years: list[int]) -> list[int]:
    missing = []
    for var in ("rain", "tmax"):
        for y in years:
            f = year_file(var, y)
            if f.exists():
                continue
            df = extract_year(var, y)
            if df is None:
                missing.append((var, y))
                continue
            df.to_parquet(f, index=False)
            log.info("IMD %s %d: %d rows", var, y, len(df))
    return missing


def _stack(var: str, years: list[int]) -> pd.DataFrame:
    files = [year_file(var, y) for y in years if year_file(var, y).exists()]
    df = pd.concat([pd.read_parquet(f) for f in files], ignore_index=True)
    df["doy"] = doy_leap(df["date"])
    return df


def rain_stats(values: np.ndarray, wet_mm: float, thresholds: list[float]) -> dict[str, float]:
    v = values[~np.isnan(values)]
    out = {"n": float(len(v)), "mean": float(v.mean()), "wet_freq": float((v >= wet_mm).mean()),
           "p90": float(np.quantile(v, 0.90)), "p95": float(np.quantile(v, 0.95)), "p99": float(np.quantile(v, 0.99))}
    for t in thresholds:
        out[f"p_ge_{t:g}".replace(".", "_")] = float((v >= t).mean())
    return out


def aggregate(years: list[int]) -> None:
    cfg = config()["climatology"]
    half = cfg["window_days"]
    out = path("data_dir", "static")
    thresholds = config()["thresholds_mm"]

    rain = _stack("rain", years)
    got = sorted(rain["date"].dt.year.unique().tolist())
    rows, core_rows = [], []
    for pid, g in rain.groupby("point_id"):
        doy, v = g["doy"].to_numpy(), g["value"].to_numpy("float64")
        for d in range(1, 367):
            sel = v[circular_window(doy, d, half)]
            if pid == "__core_zone__":
                s = sel[~np.isnan(sel)]
                core_rows.append({"doy": d, "mean": float(s.mean()), "sd": float(s.std(ddof=1))})
            else:
                rows.append({"point_id": pid, "doy": d, **rain_stats(sel, cfg["wet_day_mm"], thresholds)})
    clim = pd.DataFrame(rows).assign(years=f"{got[0]}-{got[-1]}", n_years=len(got))
    clim.to_parquet(out / "climatology_rain.parquet", index=False)
    pd.DataFrame(core_rows).to_parquet(out / "core_zone_clim.parquet", index=False)

    tmax = _stack("tmax", years)
    trows = []
    for pid, g in tmax.groupby("point_id"):
        doy, v = g["doy"].to_numpy(), g["value"].to_numpy("float64")
        for d in range(1, 367):
            s = v[circular_window(doy, d, half)]
            s = s[~np.isnan(s)]
            trows.append({"point_id": pid, "doy": d, "mean": float(s.mean()), "sd": float(s.std(ddof=1))})
    pd.DataFrame(trows).to_parquet(out / "climatology_tmax.parquet", index=False)
    log.info("climatology from %d years (%s-%s): %d rain rows, %d tmax rows", len(got), got[0], got[-1], len(clim), len(trows))


def core_zone_series() -> pd.DataFrame:
    """Daily core-zone rain for the verification years (final grids, then IMD real-time grids)."""
    from ml.ingest.imd import load

    box = config()["regimes"]["core_zone"]
    frames = []
    truth_dates = pd.read_parquet(path("data_dir", "truth") / "imd_rain.parquet", columns=["date"])["date"]
    years = sorted({int(y) for y in truth_dates.astype(str).str[:4]})
    for y in years:
        da = load("rain", [y])
        s = da.sel(lat=slice(*box["lat"]), lon=slice(*box["lon"])).mean(["lat", "lon"], skipna=True).to_series()
        frames.append(pd.DataFrame({"date": pd.to_datetime(s.index), "core_mm": s.to_numpy("float32"), "kind": "final"}))
    rt = _realtime_core(box)
    if rt is not None:
        frames.append(rt)
    df = pd.concat(frames, ignore_index=True).dropna(subset=["core_mm"])
    df = df.sort_values("kind").drop_duplicates("date", keep="first").sort_values("date")  # final beats real-time
    df.to_parquet(path("data_dir", "static") / "core_zone_rain.parquet", index=False)
    return df


def _realtime_core(box) -> pd.DataFrame | None:
    import datetime as dt

    from ml.ingest.imd_realtime import DEFAULT_START, load

    try:
        da = load("rain", dt.date.fromisoformat(DEFAULT_START), dt.date.today())
    except FileNotFoundError as e:
        log.warning("IMD real-time grids unavailable for the core zone: %s", e)
        return None
    s = da.sel(lat=slice(*box["lat"]), lon=slice(*box["lon"])).mean(["lat", "lon"], skipna=True).to_series()
    return pd.DataFrame({"date": pd.to_datetime(s.index), "core_mm": s.to_numpy("float32"), "kind": "realtime"})


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--aggregate-only", action="store_true")
    args = ap.parse_args()
    y0, y1 = config()["climatology"]["years"]
    years = list(range(y0, y1 + 1))
    if not args.aggregate_only:
        missing = download(years)
        if missing:
            log.warning("missing years (re-run later): %s", missing)
    aggregate(years)
    core_zone_series()


if __name__ == "__main__":
    main()

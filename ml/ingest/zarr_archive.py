"""Backfill forecasts from dynamical.org's anonymous cloud Zarr archives (ECMWF AIFS, NOAA GEFS, IFS ENS).

Why: the Open-Meteo archive of ECMWF AIFS starts 2025-02-17, so the 2024 training year would have no
AI model; dynamical.org holds AIFS from 2024-04-01. It also holds the full GEFS (31 members) and IFS ENS
(51 members) ensembles, which give real ensemble spread and member-counted exceedance probabilities.

Conventions (identical to the Open-Meteo ingest, see ml/ingest/daily.py):
- lead L for IMD rain day D uses the 00 UTC run of D - L; D is the 24 h ending 03 UTC on D, so the
  window is forecast hours [24(L-1)+3, 24L+3] from initialisation.
- `precipitation_surface` is the average rate (mm/s) over the step ending at each lead time. Window
  totals integrate those step rates over their overlap with the window, so 6-hourly steps that straddle
  03 UTC are split in proportion to time (uniform rate within a step). Any missing step -> NaN.

    python -m ml.ingest.zarr_archive --plan
    python -m ml.ingest.zarr_archive --run [--source gefs] [--months 2024-06,2024-07]

Idempotent: one Parquet file per source and month; finished months are skipped.
"""

from __future__ import annotations

import argparse
import datetime as dt
import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from functools import cache

import numpy as np
import pandas as pd

from ml.common import config, path, points, resolve_date

log = logging.getLogger("zarr_archive")

RAIN_VAR = "precipitation_surface"


@dataclass(frozen=True)
class ZarrSource:
    id: str
    store: str
    kind: str                 # deterministic | ensemble
    first_init: dt.date
    last_init: dt.date | None
    vars: tuple[str, ...]
    enabled: bool


def zarr_sources(include_disabled: bool = False) -> list[ZarrSource]:
    out = []
    for s in config()["zarr_sources"]:
        src = ZarrSource(
            id=s["id"], store=s["store"], kind=s["kind"],
            first_init=dt.date.fromisoformat(s["first_init"]),
            last_init=dt.date.fromisoformat(s["last_init"]) if s.get("last_init") else None,
            vars=tuple(s["vars"]), enabled=bool(s.get("enabled", True)),
        )
        if src.enabled or include_disabled:
            out.append(src)
    return out


def rain_window_hours(lead: int, end_hour_utc: int = 3) -> tuple[float, float]:
    """Forecast-hour window (from a 00 UTC init) of IMD rain day init_date + lead."""
    return 24.0 * (lead - 1) + end_hour_utc, 24.0 * lead + end_hour_utc


def integrate_steps(lead_hours: np.ndarray, rate: np.ndarray, window: tuple[float, float]) -> np.ndarray:
    """Total (mm) over `window` from step-average rates (mm/s) stamped at each step's end.

    `rate` has lead on axis 0 (any trailing shape). The step ending at lead_hours[i] covers
    (lead_hours[i-1], lead_hours[i]]; step 0 (lead 0) is empty and ignored.
    """
    a, b = window
    starts, ends = lead_hours[:-1], lead_hours[1:]
    overlap = np.clip(np.minimum(ends, b) - np.maximum(starts, a), 0, None)  # hours per step
    used = overlap > 0
    if not used.any() or ends.max() < b:
        return np.full(rate.shape[1:], np.nan)
    steps = rate[1:][used]
    w = (overlap[used] * 3600.0).reshape((-1,) + (1,) * (rate.ndim - 1))
    total = (steps * w).sum(axis=0)
    total[np.isnan(steps).any(axis=0)] = np.nan
    return np.clip(total, 0, None)


def ensemble_stats(members: np.ndarray, thresholds: list[float]) -> dict[str, np.ndarray]:
    """Per-point statistics over axis 0 (members). NaN members are dropped."""
    n = np.sum(~np.isnan(members), axis=0)
    with np.errstate(invalid="ignore"):
        out = {
            "mean": np.nanmean(members, axis=0),
            "sd": np.nanstd(members, axis=0, ddof=1),
            "p10": np.nanquantile(members, 0.1, axis=0),
            "p50": np.nanquantile(members, 0.5, axis=0),
            "p90": np.nanquantile(members, 0.9, axis=0),
            "n_members": n.astype("float64"),
        }
        for t in thresholds:
            out[f"p_ge_{t:g}".replace(".", "_")] = np.where(n > 0, np.sum(members >= t, axis=0) / np.maximum(n, 1), np.nan)
    return out


@cache
def _open(store: str):
    import xarray as xr

    url = f"{config()['zarr']['base_url']}/{store}/latest.zarr"
    return xr.open_zarr(url, chunks=None)


def read_init(src: ZarrSource, init: dt.date) -> pd.DataFrame:
    """All leads x points for one 00 UTC run, as long rows (plus ensemble statistics)."""
    import xarray as xr

    pts = points()
    leads = config()["leads"]
    end_hour = config()["days"]["rain_window_end_utc_hour"]
    thresholds = config()["thresholds_mm"]
    ds = _open(src.store)
    t0 = np.datetime64(dt.datetime.combine(init, dt.time(config()["zarr"]["init_hour_utc"])))
    if t0 not in ds.indexes["init_time"]:
        return pd.DataFrame()
    max_h = rain_window_hours(max(leads), end_hour)[1]
    lead_h = ds["lead_time"].values.astype("timedelta64[m]").astype("float64") / 60.0
    keep = np.flatnonzero(lead_h <= max_h + 6)
    da = ds[RAIN_VAR].sel(init_time=t0).isel(lead_time=keep).sel(
        latitude=xr.DataArray([p.lat for p in pts], dims="point"),
        longitude=xr.DataArray([p.lon for p in pts], dims="point"),
        method="nearest",
    )
    if "ensemble_member" in da.dims:
        da = da.transpose("lead_time", "ensemble_member", "point")
    else:
        da = da.transpose("lead_time", "point")
    rate = da.load().values.astype("float64")
    hours = lead_h[keep]

    rows = []
    for lead in leads:
        date = init + dt.timedelta(days=lead)
        total = integrate_steps(hours, rate, rain_window_hours(lead, end_hour))
        base = {"point_id": [p.id for p in pts], "date": date, "source": src.id, "lead": np.int8(lead), "var": "rain"}
        if src.kind == "ensemble":
            stats = ensemble_stats(total, thresholds)
            rows.append(pd.DataFrame({**base, "value": stats["mean"], **{k: v for k, v in stats.items() if k != "mean"}}))
        else:
            rows.append(pd.DataFrame({**base, "value": total}))
    return pd.concat(rows, ignore_index=True)


def months(src: ZarrSource, end: dt.date) -> list[pd.Period]:
    start = max(src.first_init, resolve_date(config()["periods"]["backfill"]["start"]))
    stop = min(end, src.last_init or end)
    return list(pd.period_range(start, stop, freq="M")) if start <= stop else []


def out_path(src: ZarrSource, month: pd.Period, complete: bool):
    d = path("data_dir", "forecasts", f"source={src.id}")
    return d / f"zarr_{month.strftime('%Y%m')}{'' if complete else '_partial'}.parquet"


def run_month(src: ZarrSource, month: pd.Period, end: dt.date, workers: int) -> int:
    first = max(month.start_time.date(), src.first_init)
    last = min(month.end_time.date(), end, src.last_init or end)
    complete = month.end_time.date() <= end
    inits = [first + dt.timedelta(days=i) for i in range((last - first).days + 1)]
    with ThreadPoolExecutor(max_workers=workers) as pool:
        frames = [f for f in pool.map(lambda d: read_init(src, d), inits) if len(f)]
    if not frames:
        log.warning("%s %s: no runs found", src.id, month)
        return 0
    df = pd.concat(frames, ignore_index=True)
    df["value"] = df["value"].astype("float32")
    for old in out_path(src, month, True).parent.glob(f"zarr_{month.strftime('%Y%m')}*.parquet"):
        old.unlink()
    df.to_parquet(out_path(src, month, complete), index=False)
    log.info("%s %s: %d runs of %d, %d rows, %.0f%% non-missing", src.id, month, len(frames), len(inits), len(df),
             100 * df["value"].notna().mean())
    return len(frames)


def todo(src: ZarrSource, end: dt.date) -> list[pd.Period]:
    return [m for m in months(src, end) if not out_path(src, m, True).exists()]


def run(only: str | None = None, month_filter: list[str] | None = None) -> None:
    end = resolve_date("today-1")
    workers = config()["zarr"]["workers"]
    for src in zarr_sources():
        if only and src.id != only:
            continue
        for m in todo(src, end):
            if month_filter and str(m) not in month_filter:
                continue
            run_month(src, m, end, workers)


def print_plan() -> None:
    end = resolve_date("today-1")
    seconds = config()["zarr"]["measured_seconds_per_run"]
    workers = config()["zarr"]["workers"]
    for src in zarr_sources(include_disabled=True):
        ms = todo(src, end)
        runs = sum(pd.Period(m).days_in_month for m in ms)
        est = runs * seconds.get(src.id, 10) / workers / 60
        state = "" if src.enabled else "  (disabled in config)"
        print(f"{src.id:24s} {src.kind:13s} months pending {len(ms):3d}  runs ~{runs:5d}  ~{est:5.0f} min{state}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--plan", action="store_true")
    ap.add_argument("--run", action="store_true")
    ap.add_argument("--source")
    ap.add_argument("--months", help="comma-separated YYYY-MM list")
    args = ap.parse_args()
    if args.run:
        run(args.source, args.months.split(",") if args.months else None)
    else:
        print_plan()


if __name__ == "__main__":
    main()

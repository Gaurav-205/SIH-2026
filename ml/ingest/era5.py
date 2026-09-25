"""ERA5 truth at the configured points via Open-Meteo's Historical Weather API.

ERA5 is the truth for wind (and a cross-check for Tmax and rain); it arrives about 5 days
late. Aggregated with the same day conventions as the forecasts (rain 03-03 UTC, Tmax and
wind over the IST day). Shares the Open-Meteo call budget with the forecast backfill, so run
it when the backfill is not running.

    python -m ml.ingest.era5
"""

from __future__ import annotations

import datetime as dt
import logging

import numpy as np
import pandas as pd

from ml.common import config, date_chunks, path, points, resolve_date
from ml.ingest.budget import Budget, DailyLimitReached, call_weight
from ml.ingest.daily import aggregate, mask_implausible, validate_daily
from ml.ingest.openmeteo import _client, log_removed

log = logging.getLogger("era5")

CHUNK_DAYS = 180   # 29 points x 180/14 days ~ 373 weighted calls, below the per-minute limit
LATENCY_DAYS = 6   # ERA5 is ~5 days behind real time


def main() -> None:
    cfg = config()
    start = resolve_date(cfg["periods"]["backfill"]["start"])
    end = resolve_date("today") - dt.timedelta(days=LATENCY_DAYS)
    out_dir = path("data_dir", "truth", "era5")
    budget = Budget(path("cache_dir") / "openmeteo_budget.json", cfg["openmeteo"]["limits"])
    client = _client()
    pts = points()
    names = {v: spec["om"] for v, spec in cfg["variables"].items()}

    for c_start, c_end in date_chunks(start, end, CHUNK_DAYS):
        out = out_dir / f"{c_start}_{c_end}.parquet"
        if out.exists():
            continue
        days = (c_end - c_start).days + 2
        try:
            budget.acquire(call_weight(len(pts), len(names), days))
        except DailyLimitReached as e:
            log.warning("%s — re-run tomorrow to continue", e)
            return
        responses = client.weather_api(cfg["openmeteo"]["archive_url"], params={
            "latitude": [p.lat for p in pts],
            "longitude": [p.lon for p in pts],
            "hourly": list(names.values()),
            "start_date": (c_start - dt.timedelta(days=1)).isoformat(),
            "end_date": c_end.isoformat(),
            "timezone": "GMT",
            "wind_speed_unit": "ms",
            "precipitation_unit": "mm",
            "models": "era5",
        })
        frames = []
        for p, r in zip(pts, responses, strict=True):
            h = r.Hourly()
            times = pd.date_range(pd.to_datetime(h.Time(), unit="s", utc=True), pd.to_datetime(h.TimeEnd(), unit="s", utc=True),
                                  freq=pd.Timedelta(seconds=h.Interval()), inclusive="left")
            for i, var in enumerate(names):
                daily = aggregate(pd.Series(h.Variables(i).ValuesAsNumpy().astype("float64"), index=times), var, cfg["days"])
                daily = daily[(daily.index.date >= c_start) & (daily.index.date <= c_end)]
                frames.append(pd.DataFrame({"point_id": p.id, "date": daily.index.date, "var": var,
                                            "value": daily.to_numpy("float32")}))
        df = pd.concat(frames, ignore_index=True)
        problems = validate_daily(df, ["point_id", "date", "var"])
        if problems:
            raise ValueError("; ".join(problems))
        df, removed = mask_implausible(df)
        if len(removed):
            log_removed(removed, f"era5 {c_start}")
        df.to_parquet(out, index=False)
        log.info("ERA5 %s..%s: %d rows, %.0f%% non-missing", c_start, c_end, len(df), 100 * np.mean(df["value"].notna()))


if __name__ == "__main__":
    main()

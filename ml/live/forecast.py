"""Fetch today's live forecasts for every live source at the configured points (Open-Meteo Forecast
API), aggregated to the same daily conventions as the archive, plus each source's run time.

Lead definition: lead L is the L-th full rain day (03-03 UTC window) that starts after the run's
initialisation, which matches the archive's `previous_dayL` series to within half a day.
"""

from __future__ import annotations

import datetime as dt
import logging

import numpy as np
import pandas as pd
import requests

from ml.common import config, path, points, sources
from ml.ingest.budget import Budget, call_weight
from ml.ingest.daily import aggregate, mask_implausible

log = logging.getLogger("live.forecast")

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
META_URL = "https://api.open-meteo.com/data/{domain}/static/meta.json"


def run_times() -> dict[str, str | None]:
    """Latest run initialisation time per live source (ISO, UTC) from Open-Meteo's metadata."""
    out: dict[str, str | None] = {}
    for s in sources():
        if not s.live:
            continue
        out[s.id] = None
        if not s.meta:
            continue
        try:
            j = requests.get(META_URL.format(domain=s.meta), timeout=20).json()
            if j.get("last_run_initialisation_time"):
                out[s.id] = dt.datetime.fromtimestamp(j["last_run_initialisation_time"], dt.UTC).isoformat()
        except (requests.RequestException, ValueError) as e:
            log.warning("run time for %s unavailable: %s", s.id, e)
    return out


def first_valid_date(init: dt.datetime) -> dt.date:
    """Label of the first 03-03 UTC rain day that starts at or after the run's initialisation."""
    end_hour = config()["days"]["rain_window_end_utc_hour"]
    start = init.replace(minute=0, second=0, microsecond=0)
    # window labelled D covers (D-1 end_hour+1 .. D end_hour]; we need D-1 at end_hour+1 >= init
    d = start.date()
    while dt.datetime(d.year, d.month, d.day, end_hour + 1, tzinfo=dt.UTC) - dt.timedelta(days=1) < start:
        d += dt.timedelta(days=1)
    return d + dt.timedelta(days=int(config()["days"].get("rain_label_offset_days", 0)))


def fetch_live(issue_init: dt.datetime) -> pd.DataFrame:
    """Daily live forecasts for leads 1..5: point_id, date, source, lead, var, value."""
    cfg = config()
    pts = points()
    leads = cfg["leads"]
    d1 = first_valid_date(issue_init)
    valid = {lead: d1 + dt.timedelta(days=lead - 1) for lead in leads}
    names = {v: spec["om"] for v, spec in cfg["variables"].items()}
    budget = Budget(path("cache_dir") / "openmeteo_budget.json", cfg["openmeteo"]["limits"])
    days = (max(valid.values()) - issue_init.date()).days + 2
    frames = []
    for src in (s for s in sources() if s.live):
        budget.acquire(call_weight(len(pts), len(names), days + 1))
        r = requests.get(FORECAST_URL, timeout=60, params={
            "latitude": ",".join(str(p.lat) for p in pts),
            "longitude": ",".join(str(p.lon) for p in pts),
            "hourly": ",".join(names.values()),
            "models": src.id,
            "past_days": 1,
            "forecast_days": days,
            "timezone": "GMT",
            "wind_speed_unit": "ms",
            "precipitation_unit": "mm",
        })
        r.raise_for_status()
        body = r.json()
        body = body if isinstance(body, list) else [body]
        for p, loc in zip(pts, body, strict=True):
            times = pd.to_datetime(loc["hourly"]["time"]).tz_localize("UTC")
            for var, om in names.items():
                series = pd.Series(np.array(loc["hourly"][om], dtype="float64"), index=times)
                daily = aggregate(series, var, cfg["days"])
                for lead, date in valid.items():
                    if lead > src.max_lead:
                        continue
                    v = daily.get(pd.Timestamp(date), np.nan)
                    frames.append((p.id, pd.Timestamp(date), src.id, lead, var, float(v)))
        log.info("live %s: fetched", src.id)
    df = pd.DataFrame(frames, columns=["point_id", "date", "source", "lead", "var", "value"])
    df, removed = mask_implausible(df)
    if len(removed):
        log.warning("masked %d implausible live values", len(removed))
    return df.dropna(subset=["value"])


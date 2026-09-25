"""Backfill archived forecasts from the Open-Meteo Previous Runs API at the configured points.

Each hourly variable `<var>_previous_dayL` is the value predicted about L x 24 h before its valid
time. We aggregate those hourly series to daily values (rain over IMD's 03-03 UTC day, Tmax and
wind over the IST day) and store one row per point x date x source x lead x variable.

    python -m ml.ingest.openmeteo --plan            # print requests, weights, days needed
    python -m ml.ingest.openmeteo --run [--max-requests N]

Idempotent: finished chunks are skipped, HTTP responses are cached forever, and the run stops
cleanly at the daily call budget (re-run tomorrow to continue).
"""

from __future__ import annotations

import argparse
import datetime as dt
import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd

from ml.common import Source, config, path, points, resolve_date, sources
from ml.ingest.budget import Budget, DailyLimitReached, call_weight
from ml.ingest.daily import aggregate, mask_implausible, validate_daily

log = logging.getLogger("openmeteo")

CHUNK_ANCHOR = dt.date(2024, 1, 1)  # chunk grid is fixed so incremental runs reuse finished chunks
REFETCH_DAYS = 2  # when extending a partial chunk, re-fetch its last days in case the archive was still filling


@dataclass(frozen=True)
class Task:
    source: Source
    index: int          # chunk number on the fixed grid
    start: dt.date      # first daily value wanted
    end: dt.date        # last daily value wanted
    complete: bool      # False when the chunk extends past the backfill end (extended later)
    resume: bool = False  # True when `start` continues an existing partial file (rows are merged)

    @property
    def variables(self) -> list[tuple[str, int, str]]:
        """(internal var, lead, Open-Meteo variable) for every requested series."""
        out = []
        for var, spec in config()["variables"].items():
            if var in self.source.skip_vars:
                continue
            for lead in config()["leads"]:
                if lead <= self.source.max_lead:
                    out.append((var, lead, f"{spec['om']}_previous_day{lead}"))
        return out

    @property
    def request_days(self) -> int:
        # one extra day before `start` so the first 03-03 UTC and IST windows are complete
        return (self.end - self.start).days + 2

    @property
    def weight(self) -> float:
        return call_weight(len(points()), len(self.variables), self.request_days)

    @property
    def out_path(self):
        suffix = "" if self.complete else "_partial"
        return path("data_dir", "forecasts", f"source={self.source.id}") / f"chunk{self.index:03d}{suffix}.parquet"


def plan_tasks(end: dt.date | None = None) -> list[Task]:
    cfg = config()
    start = resolve_date(cfg["periods"]["backfill"]["start"])
    end = end or resolve_date(cfg["periods"]["backfill"]["end"])
    span = cfg["openmeteo"]["chunk_days"]
    tasks = []
    k = 0
    while True:
        c_start = CHUNK_ANCHOR + dt.timedelta(days=k * span)
        c_end = c_start + dt.timedelta(days=span - 1)
        if c_start > end:
            break
        for src in sources():
            if src.provider != "openmeteo":
                continue
            s = max(c_start, start, src.first_date)
            e = min(c_end, end, src.last_date or end)
            if s <= e:
                tasks.append(_resume(Task(src, k, s, e, complete=c_end <= end)))
        k += 1
    # The newest chunk comes first (the live skill ledger needs recent verified forecasts), then
    # chunk-major from the oldest, so every source's early periods finish before later ones start.
    newest = max(t.index for t in tasks)
    return sorted(tasks, key=lambda t: (t.index != newest, t.index, t.source.id))


def _partial_path(task: Task):
    return task.out_path.with_name(f"chunk{task.index:03d}_partial.parquet")


def _resume(task: Task) -> Task:
    """Continue an existing partial chunk from its last stored day instead of re-downloading it all.

    Archived day-L forecasts for a past valid date never change, so only new days are needed. This
    keeps the newest chunk from costing a full 91-day request (about 290 weighted calls per source)
    every day.
    """
    partial = _partial_path(task)
    if task.complete and task.out_path.exists():
        return task  # finished; pending() skips it
    if not partial.exists():
        return task
    last = pd.read_parquet(partial, columns=["date"])["date"].max()
    if pd.isna(last):
        return task
    start = max(task.start, last - dt.timedelta(days=REFETCH_DAYS - 1))
    return Task(task.source, task.index, start, task.end, task.complete, resume=start > task.start)


def _stored_until(task: Task) -> dt.date | None:
    partial = _partial_path(task)
    if not partial.exists():
        return None
    return pd.read_parquet(partial, columns=["date"])["date"].max()


def pending(tasks: list[Task]) -> list[Task]:
    out = []
    for t in tasks:
        if t.complete and t.out_path.exists():
            continue
        if not t.complete and (_stored_until(t) or dt.date.min) >= t.end:
            continue  # partial chunk already up to date
        out.append(t)
    return out


def _client():
    import openmeteo_requests
    import requests_cache
    from retry_requests import retry

    session = requests_cache.CachedSession(
        str(path("cache_dir") / "openmeteo_http"), backend="sqlite", expire_after=-1
    )
    return openmeteo_requests.Client(session=retry(session, retries=3, backoff_factor=2))


def fetch(task: Task, client) -> pd.DataFrame:
    pts = points()
    series = task.variables
    params = {
        "latitude": [p.lat for p in pts],
        "longitude": [p.lon for p in pts],
        "hourly": [om for _, _, om in series],
        "models": task.source.id,
        "start_date": (task.start - dt.timedelta(days=1)).isoformat(),
        "end_date": task.end.isoformat(),
        "timezone": "GMT",
        "wind_speed_unit": "ms",
        "precipitation_unit": "mm",
        "temperature_unit": "celsius",
    }
    responses = client.weather_api(config()["openmeteo"]["previous_runs_url"], params=params)
    if len(responses) != len(pts):
        raise RuntimeError(f"expected {len(pts)} locations, got {len(responses)}")

    days_cfg = config()["days"]
    frames = []
    for p, r in zip(pts, responses, strict=True):
        h = r.Hourly()
        times = pd.date_range(
            start=pd.to_datetime(h.Time(), unit="s", utc=True),
            end=pd.to_datetime(h.TimeEnd(), unit="s", utc=True),
            freq=pd.Timedelta(seconds=h.Interval()),
            inclusive="left",
        )
        for i, (var, lead, _om) in enumerate(series):
            values = h.Variables(i).ValuesAsNumpy().astype("float64")
            daily = aggregate(pd.Series(values, index=times, name="value"), var, days_cfg)
            daily = daily[(daily.index.date >= task.start) & (daily.index.date <= task.end)]
            frames.append(
                pd.DataFrame(
                    {
                        "point_id": p.id,
                        "date": daily.index.date,
                        "source": task.source.id,
                        "lead": np.int8(lead),
                        "var": var,
                        "value": daily.to_numpy("float32"),
                    }
                )
            )
    df = pd.concat(frames, ignore_index=True)
    problems = validate_daily(df, ["point_id", "date", "source", "lead", "var"])
    if problems:
        raise ValueError(f"{task.source.id} chunk {task.index}: " + "; ".join(problems))
    df, removed = mask_implausible(df)
    if len(removed):
        log_removed(removed, f"{task.source.id} chunk {task.index}")
    return df


def log_removed(removed: pd.DataFrame, what: str) -> None:
    """Append masked values to the data-quality log (reported in M1)."""
    qdir = path("data_dir", "quality")
    removed = removed.assign(reason="outside physical bounds")
    out = qdir / f"removed_{what.replace(' ', '_')}.parquet"
    removed.to_parquet(out, index=False)
    by = removed.groupby("var").agg(n=("value", "size"), min=("value", "min"), max=("value", "max"),
                                     first=("date", "min"), last=("date", "max"))
    log.warning("%s: masked implausible values -> %s\n%s", what, out.name, by.to_string())


def run(max_requests: int | None = None) -> None:
    tasks = pending(plan_tasks())
    om = config()["openmeteo"]
    limits = {**om["limits"], "day": om.get("backfill_day_limit", om["limits"]["day"])}
    budget = Budget(path("cache_dir") / "openmeteo_budget.json", limits)
    client = _client()
    done = 0
    for t in tasks:
        if max_requests is not None and done >= max_requests:
            break
        try:
            budget.acquire(t.weight)
        except DailyLimitReached as e:
            log.warning("%s — stopping; re-run tomorrow to continue (%d chunks left)", e, len(tasks) - done)
            return
        df = fetch(t, client)
        nonnull = df["value"].notna().mean()
        if nonnull == 0:
            # an empty answer means a wrong model slug or dates outside the archive: fix the config
            raise RuntimeError(f"{t.source.id} chunk {t.index} {t.start}..{t.end}: every value is missing")
        if t.resume:
            old = pd.read_parquet(_partial_path(t))
            df = pd.concat([old[old["date"] < t.start], df], ignore_index=True)
        # replace any older partial file for this chunk
        for old_file in t.out_path.parent.glob(f"chunk{t.index:03d}*.parquet"):
            old_file.unlink()
        df.to_parquet(t.out_path, index=False)
        log.info("%s chunk %d %s..%s: %d rows, %.0f%% non-missing, weight %.0f (day total %.0f)",
                 t.source.id, t.index, t.start, t.end, len(df), 100 * nonnull, t.weight, budget.used("day"))
        done += 1
    log.info("finished %d requests; %d chunks still pending", done, len(pending(plan_tasks())))


def print_plan() -> None:
    all_tasks = plan_tasks()
    todo = pending(all_tasks)
    rows = []
    for src in (s for s in sources() if s.provider == "openmeteo"):
        ts = [t for t in todo if t.source.id == src.id]
        rows.append({
            "source": src.id,
            "family": src.family,
            "from": max(src.first_date, resolve_date(config()["periods"]["backfill"]["start"])),
            "requests": len(ts),
            "weight": round(sum(t.weight for t in ts)),
        })
    table = pd.DataFrame(rows)
    total = table["weight"].sum()
    day_limit = config()["openmeteo"].get("backfill_day_limit", config()["openmeteo"]["limits"]["day"])
    print(table.to_string(index=False))
    print(f"\nPoints: {len(points())}  |  requests pending: {len(todo)} of {len(all_tasks)}  |  "
          f"weighted calls: {total:,.0f}  |  ~{total / day_limit:.1f} days at {day_limit:,}/day")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--plan", action="store_true")
    ap.add_argument("--run", action="store_true")
    ap.add_argument("--max-requests", type=int)
    args = ap.parse_args()
    if args.run:
        run(args.max_requests)
    else:
        print_plan()


if __name__ == "__main__":
    main()

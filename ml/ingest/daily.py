"""Hourly -> daily aggregation with explicit day conventions.

Open-Meteo hourly precipitation at timestamp t is the total over the preceding hour (t-1h, t].
IMD's rain day ends at 03 UTC (08:30 IST), so the daily rain total for a window ending at
03 UTC on date E sums the hourly values stamped E-1 04:00 ... E 03:00 UTC (24 values).
Which calendar date IMD attaches to that window is measured in M1 (see reports.m1).

Temperature and wind are instantaneous hourly values; they are aggregated over the local
(IST) calendar day.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

HOURS = 24


def rain_windows(hourly: pd.Series, end_hour_utc: int = 3) -> pd.Series:
    """Daily sums over 24 h windows ending at `end_hour_utc` UTC, labelled by the end date.

    `hourly` is indexed by tz-aware UTC timestamps (preceding-hour totals). A window with any
    missing hour is NaN, never a partial sum.
    """
    s = hourly.sort_index()
    if s.index.tz is None:
        raise ValueError("hourly index must be timezone-aware UTC")
    # Shift so each window ending at end_hour_utc on date E maps to calendar date E:
    # a value stamped at E 03:00 belongs to window E; E-1 04:00 also belongs to window E.
    shifted = s.index - pd.Timedelta(hours=end_hour_utc + 1) + pd.Timedelta(days=1)
    label = shifted.tz_convert("UTC").normalize().tz_localize(None)
    grouped = s.groupby(label)
    total = grouped.sum(min_count=HOURS)
    complete = grouped.count() == HOURS
    return total.where(complete).rename(s.name)


def local_day(hourly: pd.Series, how: str, tz: str = "Asia/Kolkata") -> pd.Series:
    """Daily max/mean over the local calendar day; NaN unless all 24 hours are present."""
    s = hourly.sort_index()
    label = s.index.tz_convert(tz).normalize().tz_localize(None)
    grouped = s.groupby(label)
    agg = grouped.max() if how == "max" else grouped.mean()
    complete = grouped.count() == HOURS
    return agg.where(complete).rename(s.name)


def aggregate(hourly: pd.Series, var: str, cfg_days: dict) -> pd.Series:
    """Aggregate one hourly series to daily values according to the variable's convention."""
    if var == "rain":
        daily = rain_windows(hourly, cfg_days["rain_window_end_utc_hour"])
        offset = int(cfg_days.get("rain_label_offset_days", 0))
        if offset:
            daily.index = daily.index + pd.Timedelta(days=offset)
        return daily.clip(lower=0)  # tiny negative artefacts from model post-processing
    if var == "tmax":
        return local_day(hourly, "max", cfg_days["other_vars_tz"])
    if var == "wind":
        return local_day(hourly, "mean", cfg_days["other_vars_tz"])
    raise ValueError(f"unknown variable {var}")


# Plausibility bounds used by validation and tests (daily values, SI-like units)
BOUNDS = {"rain": (0.0, 1000.0), "tmax": (-15.0, 55.0), "wind": (0.0, 60.0)}


def validate_daily(df: pd.DataFrame, keys: list[str]) -> list[str]:
    """Structural problems that indicate a bug in our code (duplicates, infinities). Empty if clean."""
    problems = []
    dup = df.duplicated(subset=keys).sum()
    if dup:
        problems.append(f"{dup} duplicate rows on {keys}")
    if np.isinf(df["value"]).any():
        problems.append("infinite values")
    return problems


def mask_implausible(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Set physically impossible values to NaN; return (clean table, removed rows).

    Provider archives occasionally hold the wrong field (e.g. CMA GRAPES 'temperature_2m' of about
    -48 degC over Maharashtra, 18 Apr - 4 May 2024). Those values must not reach training, but the
    rest of the record is kept, and every removal is logged for the data-quality report.
    """
    lo = df["var"].map({k: v[0] for k, v in BOUNDS.items()})
    hi = df["var"].map({k: v[1] for k, v in BOUNDS.items()})
    bad = (df["value"] < lo) | (df["value"] > hi)
    removed = df[bad].copy()
    clean = df.copy()
    clean.loc[bad, "value"] = np.nan
    return clean, removed

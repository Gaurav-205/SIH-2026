"""Monsoon regime labels from observed core-zone rainfall (Rajeevan, Gadgil and Bhate 2010 method).

z(t) = (core-zone rain(t) - climatological mean(doy)) / climatological sd(doy), with the 1991-2020
IMD normal from ml/ingest/climatology.py. In the monsoon months a day is 'active' when z > active_z,
'break' when z < break_z, each only when it closes a run of at least `min_run_days` such days.

The run rule here is causal (the run must end on or before the labelled day), so the label on day t
uses no observation after t. Outside the monsoon months the label is 'off_season'.

As model features these labels are taken as of the issue date (V - L), never the valid date V.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ml.common import config, path
from ml.ingest.climatology import doy_leap

LABELS = ("active", "break", "normal", "off_season")


def core_zone_anomaly() -> pd.DataFrame:
    """date, core_mm, z (standardised anomaly), z3 (3-day mean of z)."""
    sdir = path("data_dir", "static")
    rain = pd.read_parquet(sdir / "core_zone_rain.parquet")
    clim = pd.read_parquet(sdir / "core_zone_clim.parquet").set_index("doy")
    doy = doy_leap(rain["date"])
    rain = rain.assign(z=(rain["core_mm"].to_numpy() - clim.loc[doy, "mean"].to_numpy()) / clim.loc[doy, "sd"].to_numpy())
    rain = rain.sort_values("date").set_index("date").asfreq("D")
    rain["z3"] = rain["z"].rolling(3, min_periods=3).mean()
    return rain.reset_index()


def label(z: pd.Series, months: pd.Series) -> pd.Series:
    """Causal active/break labels for a daily, gap-free z series."""
    cfg = config()["regimes"]
    run = cfg["min_run_days"]
    above = (z > cfg["active_z"]).astype(int)
    below = (z < cfg["break_z"]).astype(int)
    # length of the current run ending at t
    run_above = above.groupby((above == 0).cumsum()).cumsum()
    run_below = below.groupby((below == 0).cumsum()).cumsum()
    out = np.where(run_above >= run, "active", np.where(run_below >= run, "break", "normal"))
    out = np.where(months.isin(cfg["season_months"]), out, "off_season")
    out = np.where(z.isna(), None, out)
    return pd.Series(out, index=z.index)


def regime_calendar() -> pd.DataFrame:
    df = core_zone_anomaly()
    df["regime"] = label(df["z"], df["date"].dt.month).to_numpy()
    df.to_parquet(path("data_dir", "static") / "regimes.parquet", index=False)
    return df


if __name__ == "__main__":
    cal = regime_calendar()
    print(cal[cal["date"] >= "2024-01-01"].groupby([cal["date"].dt.year, "regime"]).size().unstack(fill_value=0))

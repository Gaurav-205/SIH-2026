"""Verification scorecard for daily rain, computed from archived forecasts against IMD truth.

Methods: every source alone, the equal-weight mean of available sources, and AtmosFusion Stage A,
which uses exactly the ledger/blend code and source pool of the live cycle. For each valid date V and lead L, Stage A
weights come from errors of forecasts valid on or before V - L (the plan's leakage rule).

Scores per lead and period: n, MAE, RMSE (95% paired 5-day block-bootstrap interval), bias, and
POD / FAR / ETS at 64.5 mm. Stage A has no fitted parameters (the constants in config.yaml are the
plan's defaults), so scoring the 2025 monsoon test period does not leak.
"""

from __future__ import annotations

import datetime as dt
import logging

import numpy as np
import pandas as pd

from ml.common import config, sources
from ml.live.stage_a import blend_one, ledger, load_archive, load_truth

log = logging.getLogger("scorecard")

MIN_SOURCES_FOR_BLEND = 3


def stage_a_hindcast(fc: pd.DataFrame, truth: pd.DataFrame) -> pd.DataFrame:
    """Leakage-free Stage A blend for every archived point x date x lead (rain)."""
    rain = fc[fc["var"] == "rain"]
    rows = []
    for (lead, date), day in rain.groupby(["lead", "date"]):
        led = ledger(rain[rain["lead"] == lead], truth, date - pd.Timedelta(days=int(lead)))
        led = led[led["lead"] == lead].set_index(["point_id", "source"]) if len(led) else led
        for pid, g in day.groupby("point_id"):
            if len(g) < MIN_SOURCES_FOR_BLEND:
                continue
            values = dict(zip(g["source"], g["value"], strict=True))
            skill = led.xs(pid, level="point_id") if len(led) and pid in led.index.get_level_values(0) else pd.DataFrame()
            b = blend_one("rain", values, skill)
            rows.append((pid, date, lead, b["blend"], b["equal_mean"], b["method"]))
    return pd.DataFrame(rows, columns=["point_id", "date", "lead", "stage_a", "equal_mean", "method"])


def _scores(pairs: pd.DataFrame, rng: np.random.Generator, boot: int = 400) -> dict:
    f, o = pairs["fc"].to_numpy(), pairs["obs"].to_numpy()
    th = 64.5
    hit = ((f >= th) & (o >= th)).sum()
    fa = ((f >= th) & (o < th)).sum()
    miss = ((f < th) & (o >= th)).sum()
    n = len(f)
    rand = (hit + fa) * (hit + miss) / n if n else 0
    denom = hit + fa + miss - rand
    # 5-day block bootstrap over dates for the RMSE interval
    days = pairs["date"].to_numpy()
    uniq = np.unique(days)
    blocks = [uniq[i:i + 5] for i in range(0, len(uniq), 5)]
    se_by_block = [((pairs.loc[np.isin(days, b), "fc"] - pairs.loc[np.isin(days, b), "obs"]) ** 2) for b in blocks]
    sums = np.array([s.sum() for s in se_by_block])
    counts = np.array([len(s) for s in se_by_block])
    lo = hi = np.nan
    if len(blocks) >= 5:
        idx = rng.integers(0, len(blocks), size=(boot, len(blocks)))
        rmse_b = np.sqrt(sums[idx].sum(1) / counts[idx].sum(1))
        lo, hi = np.percentile(rmse_b, [2.5, 97.5])
    return {
        "n": int(n),
        "mae": float(np.mean(np.abs(f - o))),
        "rmse": float(np.sqrt(np.mean((f - o) ** 2))),
        "rmse_lo": float(lo), "rmse_hi": float(hi),
        "bias": float(np.mean(f - o)),
        "pod_64_5": float(hit / (hit + miss)) if hit + miss else None,
        "far_64_5": float(fa / (hit + fa)) if hit + fa else None,
        "ets_64_5": float((hit - rand) / denom) if denom else None,
        "observed_heavy_days": int(hit + miss),
    }


def build() -> dict:
    cfg = config()
    fc = load_archive()
    truth = load_truth()
    rain_truth = truth[truth["var"] == "rain"]
    if fc.empty or rain_truth.empty:
        return {"generated_at": dt.datetime.now(dt.UTC).isoformat(), "rows": [], "note": "no archived forecasts or truth yet"}

    # The blends use the live cycle's source pool (Open-Meteo models; BOM was live until mid-2025).
    # Zarr-only ensembles (GEFS, IFS ENS) are not fetched live, so they are scored alone but not blended.
    blend_pool = {x.id for x in sources() if x.provider == "openmeteo"}
    hind = stage_a_hindcast(fc[fc["source"].isin(blend_pool)], rain_truth)
    per_source = (fc[fc["var"] == "rain"][["point_id", "date", "lead", "source", "value"]]
                  .rename(columns={"source": "method", "value": "fc"}))
    combined = pd.concat([
        per_source,
        hind[["point_id", "date", "lead", "stage_a"]].rename(columns={"stage_a": "fc"}).assign(method="AtmosFusion (Stage A)"),
        hind[["point_id", "date", "lead", "equal_mean"]].rename(columns={"equal_mean": "fc"}).assign(method="Equal-weight mean"),
    ], ignore_index=True)
    pairs = combined.merge(rain_truth[["point_id", "date", "obs", "truth"]], on=["point_id", "date"]).dropna(subset=["fc", "obs"])

    test = cfg["periods"]["test"]
    periods = {
        "test_monsoon_2025": (pd.Timestamp(test["start"]), pd.Timestamp(test["end"])),
        "all_verified": (pairs["date"].min(), pairs["date"].max()),
    }
    family = {s.id: s.family for s in sources()} | {"AtmosFusion (Stage A)": "blend", "Equal-weight mean": "blend"}
    label = {s.id: s.label for s in sources()}
    rng = np.random.default_rng(26081)
    rows = []
    for pname, (start, end) in periods.items():
        sub = pairs[(pairs["date"] >= start) & (pairs["date"] <= end)]
        for (lead, method), g in sub.groupby(["lead", "method"]):
            if len(g) < 30:
                continue
            rows.append({"period": pname, "lead": int(lead), "method": method, "label": label.get(method, method),
                         "family": family.get(method, "other"), **_scores(g, rng)})
    return {
        "generated_at": dt.datetime.now(dt.UTC).isoformat(),
        "variable": "rain",
        "unit": "mm/day",
        "truth": "IMD 0.25° gridded rainfall (final grids for 2024-2025; real-time grids from 2026)",
        "points": int(pairs["point_id"].nunique()),
        "periods": {k: {"start": str(v[0].date()), "end": str(v[1].date())} for k, v in periods.items()},
        "truth_days": {k: int(v) for k, v in pairs.drop_duplicates(["point_id", "date"]).groupby("truth").size().items()},
        "stage_a_fallback_share": float((hind["method"] != "stage_a").mean()) if len(hind) else None,
        "rows": rows,
    }

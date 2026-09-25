"""Vectorised, leakage-free skill-ledger statistics for every archived forecast.

For a forecast of lead L valid on V the ledger may only use forecasts valid on or before V - L (as_of).
`ml.live.stage_a.ledger` computes this for one as_of date; this module computes the same numbers for
all dates at once with causal convolutions over dense daily series, so training features and the live
cycle share one definition (a unit test checks the two agree to 1e-9).

Output columns per (source, point_id, lead, var, date=V):
  n, mae, bias, sum_fc, sum_obs, scope ('point' | 'region' | NaN when neither has min_pairs)
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ml.common import config, points

KEYS = ["source", "point_id", "lead", "var"]


def _causal(x: np.ndarray, kernel: np.ndarray) -> np.ndarray:
    """y[t] = sum_{a=0..K-1} kernel[a] * x[t - a] (zeros before the start)."""
    return np.convolve(x, kernel)[: len(x)]


def _decayed(pairs: pd.DataFrame, group_cols: list[str], days: pd.DatetimeIndex) -> pd.DataFrame:
    """Decayed sums over the window ending at each day (as_of) for every group."""
    cfg = config()["blend"]
    kernel = np.power(0.5, np.arange(cfg["window_days"]) / cfg["half_life_days"])
    ones = np.ones(cfg["window_days"])
    index = {d: i for i, d in enumerate(days)}
    out = []
    for key, g in pairs.groupby(group_cols, sort=False):
        pos = g["date"].map(index).to_numpy()
        dense = {}
        for col in ("abs_err", "err", "value", "obs", "one"):
            arr = np.zeros(len(days))
            np.add.at(arr, pos, g[col].to_numpy("float64"))
            dense[col] = arr
        w = _causal(dense["one"], kernel)
        n = _causal(dense["one"], ones)
        frame = pd.DataFrame({
            "as_of": days, "n": n, "w": w,
            "aw": _causal(dense["abs_err"], kernel), "ew": _causal(dense["err"], kernel),
            "fw": _causal(dense["value"], kernel), "ow": _causal(dense["obs"], kernel),
        })
        frame = frame[frame["n"] > 0]
        for c, v in zip(group_cols, key if isinstance(key, tuple) else (key,), strict=True):
            frame[c] = v
        out.append(frame)
    return pd.concat(out, ignore_index=True) if out else pd.DataFrame()


def ledger_features(forecasts: pd.DataFrame, truth: pd.DataFrame) -> pd.DataFrame:
    """Leakage-free ledger statistics attached to each forecast row (point-level, region fallback)."""
    cfg = config()["blend"]
    m = forecasts.merge(truth[["point_id", "date", "var", "obs"]], on=["point_id", "date", "var"])
    m = m.assign(err=m["value"] - m["obs"], one=1.0)
    m["abs_err"] = m["err"].abs()
    days = pd.date_range(min(forecasts["date"].min(), m["date"].min()), forecasts["date"].max(), freq="D")

    point = _decayed(m, KEYS, days)
    region_of = {p.id: p.region for p in points()}
    region = _decayed(m.assign(region=m["point_id"].map(region_of)), ["source", "region", "lead", "var"], days)

    def finish(s: pd.DataFrame) -> pd.DataFrame:
        return s.assign(mae=s["aw"] / s["w"], bias=s["ew"] / s["w"], sum_fc=s["fw"], sum_obs=s["ow"])

    point, region = finish(point), finish(region)
    stats = ["n", "mae", "bias", "sum_fc", "sum_obs"]

    rows = forecasts[KEYS + ["date"]].copy()
    rows["as_of"] = rows["date"] - pd.to_timedelta(rows["lead"].astype(int), unit="D")
    rows["region"] = rows["point_id"].map(region_of)
    p = rows.merge(point[KEYS + ["as_of"] + stats], on=KEYS + ["as_of"], how="left")
    r = rows.merge(region[["source", "region", "lead", "var", "as_of"] + stats],
                   on=["source", "region", "lead", "var", "as_of"], how="left")
    use_point = p["n"].to_numpy() >= cfg["min_pairs"]
    use_region = ~use_point & (r["n"].to_numpy() >= cfg["min_pairs"])
    out = rows[KEYS + ["date"]].copy()
    for c in stats:
        out[c] = np.where(use_point, p[c].to_numpy(), np.where(use_region, r[c].to_numpy(), np.nan))
    out["scope"] = np.where(use_point, "point", np.where(use_region, "region", None))
    return out

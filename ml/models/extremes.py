"""Calibrated exceedance probabilities (plan milestone M6).

Per source and lead, isotonic regression maps the bias-corrected forecast to P(obs >= t) for each IMD
threshold; the blended probability is the weight-average of the sources' calibrated probabilities.
204.5 mm events are rare, so that threshold pools all leads (lead is then not a separate fit).
Cross-validated with the same blocked monthly folds as Stage B.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ml.common import config
from ml.features.build_table import GROUP

POOL_LEADS_FROM_MM = 200.0


def _fit_predict(train: pd.DataFrame, test: pd.DataFrame, t: float) -> np.ndarray:
    from sklearn.isotonic import IsotonicRegression

    out = np.full(len(test), np.nan)
    by = ["source"] if t >= POOL_LEADS_FROM_MM else ["source", "lead"]
    for key, g in test.groupby(by):
        key = key if isinstance(key, tuple) else (key,)
        mask = np.ones(len(train), bool)
        for c, v in zip(by, key, strict=True):
            mask &= (train[c] == v).to_numpy()
        tr = train[mask]
        if len(tr) < 200:
            continue
        iso = IsotonicRegression(y_min=0, y_max=1, out_of_bounds="clip", increasing=True)
        iso.fit(tr["corrected"], (tr["obs"] >= t).astype(float))
        out[test.index.get_indexer(g.index)] = iso.predict(g["corrected"])
    return out


def calibrated_cv(df: pd.DataFrame) -> pd.DataFrame:
    """Out-of-fold per-row calibrated probabilities, columns cal_<t>."""
    gap = pd.Timedelta(days=config()["periods"]["gap_days"])
    months = sorted(df["date"].dt.to_period("M").unique())
    cols = {t: f"cal_{t:g}".replace(".", "_") for t in config()["thresholds_mm"]}
    out = pd.DataFrame(np.nan, index=df.index, columns=list(cols.values()))
    for m in months:
        test = df["date"].dt.to_period("M") == m
        usable = (df["date"] < m.start_time - gap) | (df["date"] > m.end_time + gap)
        for t, c in cols.items():
            out.loc[test, c] = _fit_predict(df[usable], df[test], t)
    return out


def blend_probs(df: pd.DataFrame, cal: pd.DataFrame, w: pd.Series) -> pd.DataFrame:
    """Weighted average of calibrated source probabilities (weights renormalised over sources with a value)."""
    t = pd.concat([df[GROUP], cal], axis=1).assign(w=w)
    res = []
    for c in cal.columns:
        ok = t[c].notna()
        s = t[ok].assign(wp=t.loc[ok, "w"] * t.loc[ok, c]).groupby(GROUP).agg(wp=("wp", "sum"), w=("w", "sum"))
        res.append((s["wp"] / s["w"]).rename(c))
    return pd.concat(res, axis=1).reset_index()

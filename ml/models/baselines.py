"""Baselines and the alternative model, all cross-validated with the same blocked monthly folds.

E2 static MME  per-point, per-lead ridge regression of IMD rain on the raw source forecasts, fitted once
               per fold (Krishnamurti et al. 1999 superensemble / IMD grid-point MME style). Missing
               sources are filled with the row's median of available sources.
B-alt          LightGBM stacking: predicts the observation directly from every source's corrected value
               plus the context features; an L2 model for the mean and quantile models for p10/p50/p90.
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from ml.common import config
from ml.features.build_table import FEATURE_GROUPS, GROUP

log = logging.getLogger("baselines")

CONTEXT = ["ensemble", "place", "season", "regime", "lead"]


def wide(df: pd.DataFrame, col: str) -> pd.DataFrame:
    """point/date/lead x source matrix of `col`."""
    return df.pivot_table(index=GROUP, columns="source", values=col, aggfunc="first")


def _folds(dates: pd.Series):
    gap = pd.Timedelta(days=config()["periods"]["gap_days"])
    months = sorted(dates.dt.to_period("M").unique())
    for k, m in enumerate(months):
        test = dates.dt.to_period("M") == m
        usable = (dates < m.start_time - gap) | (dates > m.end_time + gap)
        yield k, m, months, test.to_numpy(), usable.to_numpy()


def static_mme_cv(df: pd.DataFrame, alpha: float = 1.0) -> pd.Series:
    from sklearn.linear_model import Ridge

    X = wide(df, "value")
    X = X.apply(lambda r: r.fillna(r.median()), axis=1)
    y = df.drop_duplicates(GROUP).set_index(GROUP)["obs"].loc[X.index]
    idx = X.index.to_frame(index=False)
    pred = pd.Series(np.nan, index=X.index)
    for _, _, _, test, usable in _folds(idx["date"]):
        for _key, g in idx.groupby(["point_id", "lead"]):
            rows = g.index.to_numpy()
            tr, te = rows[usable[rows]], rows[test[rows]]
            if len(te) == 0 or len(tr) < 30:
                continue
            m = Ridge(alpha=alpha).fit(X.iloc[tr], y.iloc[tr])
            pred.iloc[te] = m.predict(X.iloc[te])
    return pred.clip(lower=0).rename("e2_static_mme")


def stacking_frame(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series, list[str]]:
    Xs = np.log1p(wide(df, "corrected").clip(lower=0)).add_prefix("fc_")
    # lead is part of the row index (GROUP), so it is added back as a column rather than selected
    ctx_cols = [c for g in CONTEXT for c in FEATURE_GROUPS[g] if c not in GROUP] + ["cons_median_log", "cons_sd_log", "n_sources"]
    ctx = df.drop_duplicates(GROUP).set_index(GROUP)[ctx_cols].loc[Xs.index]
    X = pd.concat([Xs, ctx], axis=1)
    X["lead"] = X.index.get_level_values("lead").astype(int)
    y = df.drop_duplicates(GROUP).set_index(GROUP)["obs"].loc[X.index]
    return X, y, list(X.columns)


def stacking_cv(df: pd.DataFrame, quantiles=(0.1, 0.5, 0.9)) -> pd.DataFrame:
    """Out-of-fold B-alt predictions: mean and the requested quantiles."""
    import lightgbm as lgb

    X, y, feats = stacking_frame(df)
    idx = X.index.to_frame(index=False)
    sb = config()["stage_b"]
    base = dict(sb["lightgbm"]) | {"verbosity": -1, "seed": 26081, "deterministic": True, "force_row_wise": True}
    out = pd.DataFrame(index=X.index, columns=["mean"] + [f"q{int(q * 100)}" for q in quantiles], dtype=float)
    cat = [c for c in ("terrain_code", "regime_code_issue") if c in feats]
    for k, m, months, test, usable in _folds(idx["date"]):
        stop_m = months[(k + len(months) // 2) % len(months)]
        stop = usable & (idx["date"].dt.to_period("M") == stop_m).to_numpy()
        train = usable & ~stop
        for name, obj in [("mean", {"objective": "regression"})] + [
                (f"q{int(q * 100)}", {"objective": "quantile", "alpha": q}) for q in quantiles]:
            dtr = lgb.Dataset(X[train], y[train], categorical_feature=cat, free_raw_data=False)
            dst = lgb.Dataset(X[stop], y[stop], categorical_feature=cat, reference=dtr)
            model = lgb.train(base | obj, dtr, num_boost_round=sb["max_trees"], valid_sets=[dst],
                              callbacks=[lgb.early_stopping(sb["early_stopping"], verbose=False)])
            out.loc[out.index[test], name] = model.predict(X[test], num_iteration=model.best_iteration)
        log.info("B-alt fold %s done", m)
    out = out.clip(lower=0)
    q = out[[c for c in out.columns if c.startswith("q")]].to_numpy()
    out[[c for c in out.columns if c.startswith("q")]] = np.sort(q, axis=1)  # no quantile crossing
    return out

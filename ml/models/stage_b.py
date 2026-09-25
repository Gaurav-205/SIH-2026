"""Stage B: LightGBM gating (plan section 6, milestone M5).

One pooled LightGBM predicts every source's log squared bias-corrected error from the features in
ml/features/build_table.py (the source is a categorical feature, so sources share structure; with two
years of data per-source models would each see ~10k rows). Weights per point/date/lead are

    w_B = softmax(-pred / tau) over the sources present,
    w   = lam * w_B + (1 - lam) * w_A      (w_A = Stage A inverse-error weights)
    w   = max(w, floor), renormalised.

The blend is sum(w * corrected value). tau and lam are chosen on validation predictions only.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from ml.common import config
from ml.features.build_table import FEATURE_GROUPS, GROUP

log = logging.getLogger("stage_b")


@dataclass
class StageBConfig:
    groups: list[str] = field(default_factory=lambda: list(FEATURE_GROUPS))
    row_weights: bool = False           # 1 + log1p(obs): heavy-rain emphasis (compared in validation)
    sources: list[str] | None = None    # restrict the source pool (ablations E9/E10)

    @property
    def features(self) -> list[str]:
        return [f for g in self.groups for f in FEATURE_GROUPS[g]]


def lgb_params(feature_names: list[str]) -> dict:
    p = dict(config()["stage_b"]["lightgbm"])
    # predicted error must not decrease with lead day (plan: monotone constraint)
    p["monotone_constraints"] = [1 if f == "lead" else 0 for f in feature_names]
    p["monotone_constraints_method"] = "advanced"
    p.update({"objective": "regression", "verbosity": -1, "seed": 26081, "deterministic": True, "force_row_wise": True})
    return p


def fit(train: pd.DataFrame, stop: pd.DataFrame, cfg: StageBConfig):
    """Fit on `train`, early-stopping on `stop` (a different, non-adjacent block)."""
    import lightgbm as lgb

    feats = cfg.features
    cat = [f for f in ("source_code", "terrain_code", "regime_code_issue") if f in feats]
    w = (1 + np.log1p(train["obs"].clip(lower=0))) if cfg.row_weights else None
    dtrain = lgb.Dataset(train[feats], train["target"], weight=w, categorical_feature=cat, free_raw_data=False)
    dstop = lgb.Dataset(stop[feats], stop["target"], categorical_feature=cat, reference=dtrain)
    sb = config()["stage_b"]
    return lgb.train(
        lgb_params(feats), dtrain, num_boost_round=sb["max_trees"], valid_sets=[dstop],
        callbacks=[lgb.early_stopping(sb["early_stopping"], verbose=False)],
    )


def month_folds(df: pd.DataFrame) -> list[pd.Period]:
    return sorted(df["date"].dt.to_period("M").unique())


def cv_predict(df: pd.DataFrame, cfg: StageBConfig) -> tuple[pd.Series, list[dict]]:
    """Blocked leave-one-month-out predictions with a gap on both sides of the held-out month."""
    gap = pd.Timedelta(days=config()["periods"]["gap_days"])
    months = month_folds(df)
    pred = pd.Series(np.nan, index=df.index)
    info = []
    for k, m in enumerate(months):
        lo, hi = m.start_time - gap, m.end_time + gap
        test = df["date"].dt.to_period("M") == m
        usable = (df["date"] < lo) | (df["date"] > hi)
        # early-stopping block: the month half a year away (never adjacent to the held-out month)
        stop_m = months[(k + len(months) // 2) % len(months)]
        stop = usable & (df["date"].dt.to_period("M") == stop_m)
        train = usable & ~stop
        model = fit(df[train], df[stop], cfg)
        pred[test] = model.predict(df.loc[test, cfg.features], num_iteration=model.best_iteration)
        info.append({"month": str(m), "trees": int(model.best_iteration), "train_rows": int(train.sum())})
        log.info("fold %s: %d trees, %d train rows", m, model.best_iteration, int(train.sum()))
    return pred, info


def weights(df: pd.DataFrame, pred: pd.Series, tau: float, lam: float) -> pd.Series:
    """Blend weights per row (sum to 1 within each point/date/lead)."""
    floor = config()["stage_b"]["weight_floor"]
    keys = [df[c] for c in GROUP]
    z = -pred / tau
    z = z - z.groupby(keys).transform("max")
    wb = np.exp(z)
    wb = wb / wb.groupby(keys).transform("sum")
    w = lam * wb + (1 - lam) * df["w_a"]
    w = np.maximum(w, floor)
    return w / w.groupby(keys).transform("sum")


def blend(df: pd.DataFrame, w: pd.Series) -> pd.DataFrame:
    """Blend and a normal-error sigma per point/date/lead from the weighted predicted errors."""
    t = df.assign(wc=w * df["corrected"], w=w)
    out = t.groupby(GROUP).agg(blend=("wc", "sum")).reset_index()
    t = t.merge(out, on=GROUP)
    t["spread2"] = t["w"] * (t["corrected"] - t["blend"]) ** 2
    t["err2"] = t["w"] * np.exp(t["pred"]) if "pred" in t else np.nan
    agg = t.groupby(GROUP).agg(spread2=("spread2", "sum"), err2=("err2", "sum")).reset_index()
    out = out.merge(agg, on=GROUP)
    out["blend"] = out["blend"].clip(lower=0)
    return out


def tune(df: pd.DataFrame, pred: pd.Series, months: list[pd.Period] | None = None) -> tuple[float, float, pd.DataFrame]:
    """Grid-search tau, lam minimising RMSE of the blend on the given months."""
    sb = config()["stage_b"]
    sub = df if months is None else df[df["date"].dt.to_period("M").isin(months)]
    p = pred.loc[sub.index]
    truth = sub.drop_duplicates(GROUP).set_index(GROUP)["obs"]
    grid = []
    for tau in sb["tau_grid"]:
        for lam in sb["lambda_grid"]:
            b = blend(sub.assign(pred=p), weights(sub, p, tau, lam)).set_index(GROUP)["blend"]
            grid.append({"tau": tau, "lam": lam, "rmse": float(np.sqrt(((b - truth.loc[b.index]) ** 2).mean()))})
    g = pd.DataFrame(grid)
    best = g.loc[g["rmse"].idxmin()]
    return float(best["tau"]), float(best["lam"]), g


def crossfit_blend(df: pd.DataFrame, pred: pd.Series) -> tuple[pd.DataFrame, dict]:
    """Blend every month with tau/lam tuned on the other half of the months (alternating split),
    so reported validation scores never use tau/lam fitted on the same data."""
    months = month_folds(df)
    halves = [months[0::2], months[1::2]]
    parts, chosen = [], {}
    for i, target in enumerate(halves):
        tau, lam, _ = tune(df, pred, halves[1 - i])
        sub = df[df["date"].dt.to_period("M").isin(target)]
        parts.append(blend(sub.assign(pred=pred.loc[sub.index]), weights(sub, pred.loc[sub.index], tau, lam)))
        chosen[f"half_{i}"] = {"tau": tau, "lam": lam, "months": [str(m) for m in target]}
    return pd.concat(parts, ignore_index=True), chosen

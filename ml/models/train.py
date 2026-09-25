"""Freeze Stage B on the whole training period (plan milestone M8, step 1).

Uses the variant chosen by ml.evaluate.validation (reports/validation.json) and its out-of-fold
predictions to set tau, lambda and the sigma scale on all training months, then fits:
  - the final LightGBM on all training rows (tree count = median of the cross-validation folds),
  - isotonic exceedance calibrators per threshold x source x lead (204.5 mm pooled over leads).
Writes an immutable artifact (ml/models/artifact.py). Run the test scorecard only after this.

    python -m ml.models.train
"""

from __future__ import annotations

import datetime as dt
import json
import logging

import numpy as np
import pandas as pd

from ml.common import config, path
from ml.evaluate import scores
from ml.evaluate.validation import train_rows
from ml.features import build_table
from ml.features.build_table import GROUP
from ml.models import artifact, stage_b
from ml.models.extremes import POOL_LEADS_FROM_MM

log = logging.getLogger("train")


def fit_calibrators(df: pd.DataFrame) -> dict:
    from sklearn.isotonic import IsotonicRegression

    out = {}
    for t in config()["thresholds_mm"]:
        by = ["source"] if t >= POOL_LEADS_FROM_MM else ["source", "lead"]
        for key, g in df.groupby(by):
            key = key if isinstance(key, tuple) else (key,)
            if len(g) < 200:
                continue
            iso = IsotonicRegression(y_min=0, y_max=1, out_of_bounds="clip").fit(g["corrected"], (g["obs"] >= t).astype(float))
            lead = str(key[1]) if len(key) > 1 else "all"
            out[f"{t:g}|{key[0]}|{lead}"] = {"x": iso.X_thresholds_.tolist(), "y": iso.y_thresholds_.tolist()}
    return out


def main() -> None:
    val = json.loads((path("reports_dir") / "validation.json").read_text(encoding="utf-8"))
    row_weights = "row weights" in val["chosen_stage_b"]
    cfg = stage_b.StageBConfig(row_weights=row_weights)
    df = train_rows(build_table.build())
    oof = pd.read_parquet(path("data_dir", "features") / "stage_b_oof.parquet")
    pred = df[GROUP + ["source"]].merge(oof, on=GROUP + ["source"], how="left")["pred"]
    pred.index = df.index
    if pred.isna().mean() > 0.01:
        raise RuntimeError("out-of-fold predictions do not match the current table: re-run ml.evaluate.validation")

    tau, lam, grid = stage_b.tune(df, pred)
    bl = stage_b.blend(df.assign(pred=pred), stage_b.weights(df, pred, tau, lam))
    obs = df.drop_duplicates(GROUP).set_index(GROUP)["obs"].loc[bl.set_index(GROUP).index].to_numpy()
    raw_sigma = np.sqrt(bl["spread2"] + bl["err2"]).to_numpy()
    ks = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0]
    k = min(ks, key=lambda s: scores.crps_normal(bl["blend"].to_numpy(), s * raw_sigma, obs))

    trees = int(np.median([f["trees"] for f in val["stage_b_info"]["folds"]]))
    import lightgbm as lgb

    feats = cfg.features
    cat = [f for f in ("source_code", "terrain_code", "regime_code_issue") if f in feats]
    w = (1 + np.log1p(df["obs"].clip(lower=0))) if row_weights else None
    booster = lgb.train(stage_b.lgb_params(feats), lgb.Dataset(df[feats], df["target"], weight=w, categorical_feature=cat),
                        num_boost_round=max(trees, 1))

    manifest = {
        "rows": int(len(df)), "point_days_x_leads": int(df.groupby(GROUP).ngroups),
        "start": str(df["date"].min().date()), "end": str(df["date"].max().date()),
        "sources": {s: int(n) for s, n in df["source"].value_counts().items()},
    }
    stamp = dt.datetime.now(dt.UTC).strftime("%Y%m%dT%H%M%SZ")
    d = artifact.save(
        f"stage_b_{stamp}", booster, fit_calibrators(df),
        {"created_at": dt.datetime.now(dt.UTC).isoformat(), "variant": val["chosen_stage_b"], "features": feats,
         "groups": cfg.groups, "row_weights": row_weights, "trees": trees, "tau": tau, "lam": lam, "sigma_scale": k,
         "tuning_grid": grid.to_dict("records"), "training_data": manifest,
         "validation": {"generated_at": val["generated_at"], "git_commit": val.get("git_commit")}},
    )
    log.info("frozen Stage B -> %s (tau=%s, lam=%s, sigma x%s, %d trees)", d, tau, lam, k, trees)


if __name__ == "__main__":
    main()

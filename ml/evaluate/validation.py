"""Validation experiments E0-E10 on the training period (plan milestones M3-M7).

Every model is fitted and scored with blocked leave-one-month-out cross-validation (10-day gaps) inside
the training period; Stage B's tau/lambda and the sigma scale are cross-fitted (tuned on one half of the
months, applied to the other). The frozen test season is never read here.

    python -m ml.evaluate.validation            # writes ml/reports/validation.{json,md} and figures
    python -m ml.evaluate.validation --smoke    # 3 months end to end in minutes (ml/reports/smoke/), run first
    python -m ml.evaluate.validation --fresh    # ignore cached experiment results

Each experiment's out-of-fold result is cached (ml/data/features/validation_cache/<key>/), keyed by the
config hash and the table's size and dates, so a crash late in the run never loses finished experiments.

Experiments
  E0  each source alone (raw)                 E5  E4 without regime features
  E1  equal-weight mean (raw)                 E6  E4 without lead
  E2  static MME (per-point ridge)            E7  E4 without place features
  E3  Stage A                                 E8  E4 without season features
  E4  Stage B (all features)                  E9  E4 without AI sources
  B-alt LightGBM stacking (mean, p10/p50/p90) E10 E4 without ensemble sources
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import logging
import math
import pickle
import subprocess

import numpy as np
import pandas as pd

from ml.common import config, path, write_json
from ml.evaluate import scores
from ml.features import build_table
from ml.features.build_table import GROUP
from ml.models import baselines, extremes, stage_b

log = logging.getLogger("validation")

THRESHOLDS = [64.5, 115.6, 204.5]
Z90 = 1.2815515655446004


def train_rows(df: pd.DataFrame) -> pd.DataFrame:
    tr = config()["periods"]["train"]
    keep = (df["date"] >= tr["start"]) & (df["date"] <= tr["end"]) & df["obs"].notna()
    df = df[keep]
    df = df[df.groupby(GROUP)["value"].transform("size") >= config()["stage_b"]["min_sources"]]
    return df.reset_index(drop=True)


def stage_a_frame(df: pd.DataFrame) -> pd.DataFrame:
    b = config()["blend"]
    t = df.assign(wc=df["w_a"] * df["corrected"])
    out = t.groupby(GROUP).agg(blend=("wc", "sum")).reset_index()
    t = t.merge(out, on=GROUP)
    t["s2"] = t["w_a"] * (t["corrected"] - t["blend"]) ** 2
    t["e2"] = t["w_a"] * (b["mae_to_sigma"] * t["mae"].fillna(t["mae"].median())) ** 2
    agg = t.groupby(GROUP).agg(s2=("s2", "sum"), e2=("e2", "sum")).reset_index()
    out = out.merge(agg, on=GROUP)
    out["sigma"] = np.sqrt(out["s2"] + out["e2"])
    out["blend"] = out["blend"].clip(lower=0)
    return out[GROUP + ["blend", "sigma"]]


def normal_prob(mu, sigma, t):
    from scipy.stats import norm

    return norm.sf((t - mu) / np.maximum(sigma, 1e-6))


def crossfit_sigma_scale(frame: pd.DataFrame, raw_sigma: np.ndarray, grid=(0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0)) -> np.ndarray:
    """Scale sigma by k chosen to minimise CRPS on the other half of the months (cross-fitted)."""
    months = frame["date"].dt.to_period("M")
    uniq = sorted(months.unique())
    halves = [set(uniq[0::2]), set(uniq[1::2])]
    out = np.empty(len(frame))
    for i in (0, 1):
        fit = months.isin(halves[1 - i]).to_numpy()
        app = months.isin(halves[i]).to_numpy()
        best = min(grid, key=lambda k: scores.crps_normal(frame["blend"].to_numpy()[fit], k * raw_sigma[fit],
                                                          frame["obs"].to_numpy()[fit]))
        out[app] = best * raw_sigma[app]
    return out


def run_stage_b(df: pd.DataFrame, cfg: stage_b.StageBConfig) -> tuple[pd.DataFrame, pd.Series, dict]:
    pred, info = stage_b.cv_predict(df, cfg)
    bl, chosen = stage_b.crossfit_blend(df, pred)
    return bl, pred, {"folds": info, "crossfit": chosen}


def score_block(frame: pd.DataFrame, fc_col: str, extra: dict | None = None) -> dict:
    f, o = frame[fc_col].to_numpy(), frame["obs"].to_numpy()
    out = scores.continuous(f, o)
    for t in (64.5, 115.6):
        c = scores.categorical(f, o, t)
        out |= {f"{k}_{t:g}".replace(".", "_"): v for k, v in c.items() if k in ("ets", "pod", "far", "csi", "sedi", "freq_bias", "events")}
    if extra:
        out |= extra
    return out


def git_commit() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], text=True, stderr=subprocess.DEVNULL).strip()
    except (OSError, subprocess.CalledProcessError):
        return None


SMOKE_MONTHS = (6, 7, 12)


class ExperimentCache:
    """Pickled experiment results under a key that changes whenever config or data change."""

    def __init__(self, df: pd.DataFrame, smoke: bool, fresh: bool):
        from ml.models.artifact import config_sha256

        raw = f"{config_sha256()}|{len(df)}|{df['date'].min()}|{df['date'].max()}|{df['source'].nunique()}|{smoke}"
        self.dir = path("data_dir", "features", "validation_cache", hashlib.sha1(raw.encode()).hexdigest()[:12])
        self.fresh = fresh

    def get(self, name: str, fn):
        f = self.dir / (hashlib.sha1(name.encode()).hexdigest()[:10] + ".pkl")
        if f.exists() and not self.fresh:
            log.info("cached: %s", name)
            return pickle.loads(f.read_bytes())
        value = fn()
        f.write_bytes(pickle.dumps(value))
        return value


def main() -> None:  # noqa: C901 - one linear experiment script, kept in one place on purpose
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--smoke", action="store_true", help="3 months only; outputs to ml/reports/smoke/")
    ap.add_argument("--fresh", action="store_true", help="recompute every experiment")
    args = ap.parse_args()
    rng_seed = 26081

    def subset(d: pd.DataFrame) -> pd.DataFrame:
        return d[d["date"].dt.month.isin(SMOKE_MONTHS)].reset_index(drop=True) if args.smoke else d

    full = build_table.build()
    df = subset(train_rows(full))
    cache = ExperimentCache(df, args.smoke, args.fresh)
    log.info("validation rows: %d forecasts, %d point-days x leads, %s..%s", len(df), df.groupby(GROUP).ngroups,
             df["date"].min().date(), df["date"].max().date())
    truth = df.drop_duplicates(GROUP).set_index(GROUP)["obs"]
    meta = df.drop_duplicates(GROUP).set_index(GROUP)[["region", "terrain_class", "clim_p_ge_64_5"]]

    preds: dict[str, pd.Series] = {}
    probs: dict[str, pd.DataFrame] = {}

    # E0 sources (raw), E1 equal mean
    src_wide = baselines.wide(df, "value")
    preds["E1 equal mean"] = src_wide.mean(axis=1)
    # E2 static MME
    preds["E2 static MME"] = cache.get("E2", lambda: baselines.static_mme_cv(df))
    # E3 Stage A
    sa = stage_a_frame(df).set_index(GROUP)
    preds["E3 Stage A"] = sa["blend"]
    # E4 Stage B, with and without heavy-rain row weights
    runs = {}
    for name, cfg in [("E4 Stage B", stage_b.StageBConfig()), ("E4w Stage B (row weights)", stage_b.StageBConfig(row_weights=True))]:
        bl, pred, info = cache.get(name, lambda cfg=cfg: run_stage_b(df, cfg))
        runs[name] = (bl.set_index(GROUP), pred, info)
        preds[name] = runs[name][0]["blend"]
    # ablations E5-E8 (feature groups)
    all_groups = list(build_table.FEATURE_GROUPS)
    for code, drop in [("E5", "regime"), ("E6", "lead"), ("E7", "place"), ("E8", "season")]:
        cfg = stage_b.StageBConfig(groups=[g for g in all_groups if g != drop])
        bl, _, info = cache.get(code, lambda cfg=cfg: run_stage_b(df, cfg))
        preds[f"{code} Stage B without {drop}"] = bl.set_index(GROUP)["blend"]
    # ablations E9/E10 (source pools): rebuilt tables so no feature sees the removed sources
    for code, fam in [("E9", "ai"), ("E10", "ensemble")]:
        bl, _, _ = cache.get(code, lambda fam=fam: run_stage_b(subset(train_rows(build_table.build(exclude_families=(fam,)))),
                                                                 stage_b.StageBConfig()))
        preds[f"{code} Stage B without {fam} sources"] = bl.set_index(GROUP)["blend"]
    # B-alt stacking
    balt = cache.get("B-alt", lambda: baselines.stacking_cv(df))
    preds["B-alt stacking (mean)"] = balt["mean"]

    # choose the Stage B variant on validation RMSE (cross-fitted numbers)
    def rmse(s):
        o = truth.loc[s.dropna().index]
        return float(np.sqrt(((s.dropna() - o) ** 2).mean()))

    b_name = min(("E4 Stage B", "E4w Stage B (row weights)"), key=lambda k: rmse(preds[k]))
    b_frame, b_pred, b_info = runs[b_name]
    # out-of-fold predictions of the chosen variant: the freeze step tunes tau/lam/sigma on all of them
    if not args.smoke:
        df[GROUP + ["source"]].assign(pred=b_pred).to_parquet(path("data_dir", "features") / "stage_b_oof.parquet", index=False)

    # probabilities
    a_frame = sa.join(truth.rename("obs")).reset_index()
    a_sigma = crossfit_sigma_scale(a_frame, a_frame["sigma"].to_numpy())
    b_frame2 = b_frame.join(truth.rename("obs")).reset_index()
    b_sigma = crossfit_sigma_scale(b_frame2, np.sqrt(b_frame2["spread2"] + b_frame2["err2"]).to_numpy())
    cal = cache.get("isotonic", lambda: extremes.calibrated_cv(df))
    w_b_rows = _crossfit_weights(df, b_pred, b_info)
    p_iso = extremes.blend_probs(df, cal, w_b_rows).set_index(GROUP)
    p_iso_a = extremes.blend_probs(df, cal, df["w_a"]).set_index(GROUP)
    ens = df.drop_duplicates(GROUP).set_index(GROUP)[["ens_p_ge_64_5", "ens_p_ge_115_6"]]
    clim = pd.read_parquet(path("data_dir", "static") / "climatology_rain.parquet")
    clim_p = df.drop_duplicates(GROUP)[GROUP + ["doy"]].merge(clim, on=["point_id", "doy"], how="left").set_index(GROUP)

    for t in THRESHOLDS:
        c = f"{t:g}".replace(".", "_")
        probs.setdefault(c, pd.DataFrame(index=truth.index))
        P = probs[c]
        P["Stage A (normal)"] = pd.Series(normal_prob(a_frame["blend"].to_numpy(), a_sigma, t), index=a_frame.set_index(GROUP).index)
        P["Stage B (normal)"] = pd.Series(normal_prob(b_frame2["blend"].to_numpy(), b_sigma, t), index=b_frame2.set_index(GROUP).index)
        P["Stage A weights + isotonic"] = p_iso_a[f"cal_{c}"]
        P["Stage B weights + isotonic"] = p_iso[f"cal_{c}"]
        if f"ens_p_ge_{c}" in ens:
            P["GEFS members (raw)"] = ens[f"ens_p_ge_{c}"]
        P["IMD climatology 1991-2020"] = clim_p[f"p_ge_{c}"]

    # ── scoring on the common rows ─────────────────────────────
    blends = pd.DataFrame(preds)
    common = blends.dropna().index
    log.info("common scored rows: %d", len(common))
    frame = blends.loc[common].join(truth.rename("obs")).join(meta).reset_index()
    frame["date"] = pd.to_datetime(frame["date"])
    source_frame = df[["point_id", "date", "lead", "source", "value", "obs"]]

    rows = []
    for lead in sorted(frame["lead"].unique()):
        fl = frame[frame["lead"] == lead]
        for m in blends.columns:
            rows.append({"lead": int(lead), "method": m, "kind": "blend", **score_block(fl, m)})
        for s, g in source_frame[source_frame["lead"] == lead].groupby("source"):
            g = g.set_index(GROUP).loc[lambda x: x.index.isin(common)].reset_index()
            if len(g) > 200:
                rows.append({"lead": int(lead), "method": s, "kind": "source", **score_block(g, "value")})
    table = pd.DataFrame(rows)

    # CRPS / quantile scores for the probabilistic outputs (common rows)
    prob_rows = []
    ab = a_frame.set_index(GROUP).assign(sigma_cal=a_sigma)
    bb = b_frame2.set_index(GROUP).assign(sigma_cal=b_sigma)
    for lead in sorted(frame["lead"].unique()):
        idx = [i for i in common if i[2] == lead]
        o = truth.loc[idx].to_numpy()
        for name, fr in (("Stage A", ab), ("Stage B", bb)):
            mu, sg = fr.loc[idx, "blend"].to_numpy(), fr.loc[idx, "sigma_cal"].to_numpy()
            q = {0.1: np.clip(mu - Z90 * sg, 0, None), 0.5: mu, 0.9: mu + Z90 * sg}
            prob_rows.append({"lead": int(lead), "method": name, "crps_normal": scores.crps_normal(mu, sg, o),
                              "quantile_score": scores.quantile_score(q, o),
                              "coverage_10_90": float(np.mean((o >= q[0.1]) & (o <= q[0.9])))})
        bq = balt.loc[idx]
        q = {0.1: bq["q10"].to_numpy(), 0.5: bq["q50"].to_numpy(), 0.9: bq["q90"].to_numpy()}
        prob_rows.append({"lead": int(lead), "method": "B-alt quantiles", "crps_normal": None,
                          "quantile_score": scores.quantile_score(q, o),
                          "coverage_10_90": float(np.mean((o >= q[0.1]) & (o <= q[0.9])))})
    prob_table = pd.DataFrame(prob_rows)

    # Brier / BSS / reliability
    brier_rows, reliability = [], {}
    for c, P in probs.items():
        t = float(c.replace("_", "."))
        Pc = P.loc[P.index.isin(common)].dropna()
        y = (truth.loc[Pc.index] >= t).astype(float).to_numpy()
        ref = Pc["IMD climatology 1991-2020"].to_numpy()
        for m in Pc.columns:
            p = Pc[m].to_numpy()
            rel = scores.reliability(p, y)
            brier_rows.append({"threshold": t, "method": m, "n": int(len(p)), "events": int(y.sum()),
                               "brier": scores.brier(p, y), "bss_vs_climatology": scores.brier_skill(p, ref, y),
                               "reliability": rel["reliability"], "resolution": rel["resolution"]})
            reliability[f"{c}|{m}"] = rel["table"]
    brier_table = pd.DataFrame(brier_rows)

    # paired block-bootstrap intervals: chosen Stage B vs Stage A, E2, E1, B-alt, and every single source on
    # that source's own days. "Best source" is the least favourable of those paired comparisons, so the
    # choice never depends on sources being scored on different samples.
    boot = []
    for lead in sorted(frame["lead"].unique()):
        fl = frame[frame["lead"] == lead]
        d = fl["date"].to_numpy()
        se = {m: (fl[m] - fl["obs"]).to_numpy() ** 2 for m in blends.columns}
        for ref in ("E3 Stage A", "E2 static MME", "E1 equal mean", "B-alt stacking (mean)"):
            r = scores.block_bootstrap_diff(d, se[b_name], se[ref], stat="rmse", seed=rng_seed)
            boot.append({"lead": int(lead), "a": b_name, "b": ref, "metric": "rmse", **r})
        per_source = []
        for src, g in source_frame[source_frame["lead"] == lead].groupby("source"):
            j = fl.set_index(GROUP).join(g.set_index(GROUP)["value"].rename("src"), how="inner")
            if len(j) < 500:
                continue
            r = scores.block_bootstrap_diff(j.index.get_level_values("date").to_numpy(), ((j[b_name] - j["obs"]) ** 2).to_numpy(),
                                            ((j["src"] - j["obs"]) ** 2).to_numpy(), stat="rmse", seed=rng_seed)
            per_source.append({"lead": int(lead), "a": b_name, "b": f"source {src}", "metric": "rmse", "n": len(j), **r})
        boot += per_source
        if per_source:
            worst = max(per_source, key=lambda x: x["diff"])
            boot.append({**worst, "b": f"best source ({worst['b'][7:]})"})
        # probabilistic: CRPS of Stage B vs Stage A (normal predictive distributions, cross-fitted sigma)
        idx = pd.MultiIndex.from_frame(fl[GROUP])
        o = fl["obs"].to_numpy()
        crps_b = scores.crps_normal_rows(bb.loc[idx, "blend"].to_numpy(), bb.loc[idx, "sigma_cal"].to_numpy(), o)
        crps_a = scores.crps_normal_rows(ab.loc[idx, "blend"].to_numpy(), ab.loc[idx, "sigma_cal"].to_numpy(), o)
        boot.append({"lead": int(lead), "a": b_name, "b": "E3 Stage A (CRPS)", "metric": "crps",
                     **scores.block_bootstrap_diff(d, crps_b, crps_a, seed=rng_seed)})
    boot_table = pd.DataFrame(boot)

    # stratified RMSE (Stage A vs chosen Stage B vs E2)
    regimes = pd.read_parquet(path("data_dir", "static") / "regimes.parquet")[["date", "regime"]]
    frame = frame.merge(regimes, on="date", how="left")
    frame["intensity"] = pd.cut(frame["obs"], [-0.1, 2.5, 15.5, 64.5, 115.6, 1e4],
                                labels=["dry <2.5", "light-moderate", "rather heavy", "heavy", "very heavy+"])
    strata = []
    for by in ("region", "terrain_class", "regime", "intensity"):
        for key, g in frame.groupby(by, observed=True):
            if len(g) < 100:
                continue
            methods = ("E3 Stage A", b_name, "E2 static MME", "E1 equal mean")
            strata.append({"by": by, "group": str(key), "n": len(g),
                           **{m: float(np.sqrt(((g[m] - g["obs"]) ** 2).mean())) for m in methods}})
    strata_table = pd.DataFrame(strata)

    importance = _importance(df, stage_b.StageBConfig(row_weights="row weights" in b_name))

    result = {
        "generated_at": dt.datetime.now(dt.UTC).isoformat(),
        "git_commit": git_commit(),
        "period": {"start": str(df["date"].min().date()), "end": str(df["date"].max().date())},
        "truth": "IMD 0.25° gridded rainfall (final)",
        "points": int(df["point_id"].nunique()),
        "sources": sorted(df["source"].unique().tolist()),
        "scored_rows": int(len(common)),
        "chosen_stage_b": b_name,
        "stage_b_info": b_info,
        "scores": table.to_dict("records"),
        "probabilistic": prob_table.to_dict("records"),
        "brier": brier_table.to_dict("records"),
        "reliability": reliability,
        "bootstrap": boot_table.to_dict("records"),
        "strata": strata_table.to_dict("records"),
        "importance": importance,
    }
    out = path("reports_dir", "smoke") if args.smoke else path("reports_dir")
    write_json(out / "validation.json", result, indent=1)
    from ml.evaluate import report

    report.write_validation(result, out)
    if not args.smoke:
        exports = path("data_dir").parent / "exports"
        exports.mkdir(parents=True, exist_ok=True)
        write_json(exports / "validation.json", report.export_for_web(result))
    log.info("validation written to %s", out)


def _crossfit_weights(df: pd.DataFrame, pred: pd.Series, info: dict) -> pd.Series:
    """Per-row Stage B weights where each month uses the tau/lam tuned on the other half of the months."""
    w = pd.Series(np.nan, index=df.index)
    months = df["date"].dt.to_period("M").astype(str)
    for half in info["crossfit"].values():
        rows = months.isin(half["months"])
        sub = df[rows]
        w[rows] = stage_b.weights(sub, pred[rows], half["tau"], half["lam"])
    return w


def _importance(df: pd.DataFrame, cfg: stage_b.StageBConfig) -> list[dict]:
    """Gain importance of a model fitted on all validation data (description only, not a score)."""
    months = stage_b.month_folds(df)
    stop = df["date"].dt.to_period("M") == months[len(months) // 2]
    model = stage_b.fit(df[~stop], df[stop], cfg)
    gain = model.feature_importance("gain")
    total = gain.sum() or 1.0
    return sorted(({"feature": f, "gain_share": float(g / total)} for f, g in zip(cfg.features, gain, strict=True)),
                  key=lambda r: -r["gain_share"])


def _json_default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return None if math.isnan(o) else float(o)
    if isinstance(o, (pd.Timestamp, dt.date)):
        return str(o)
    raise TypeError(type(o))


if __name__ == "__main__":
    main()

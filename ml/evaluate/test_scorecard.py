"""Frozen test scorecard: the 2025 monsoon (config periods.test), scored once (plan milestone M8).

Preconditions, all checked before anything is scored:
  1. a frozen Stage B artifact exists (python -m ml.models.train) and the config is unchanged since;
  2. the test season is covered: IMD truth and at least `min_sources` sources on >= 90% of point-days;
  3. the test has not been scored before. A re-score needs --rescore "<reason>", which is appended to
     ml/reports/test_runs.log together with the commit, so every look at the test set is on record.

Scored: sources alone, E1 equal mean, E2 static MME (fitted once on the training period), E3 Stage A,
the frozen Stage B, with bootstrap intervals, Brier skill vs IMD climatology, reliability, CRPS,
relative economic value, strata, and case studies chosen from the observations (the three wettest
IMD days per region). Fractions Skill Score needs gridded fields and is not computed at district points.

    python -m ml.evaluate.test_scorecard
"""

from __future__ import annotations

import argparse
import datetime as dt
import logging

import numpy as np
import pandas as pd

from ml.common import config, path, write_json
from ml.evaluate import scores
from ml.evaluate.validation import normal_prob, score_block, stage_a_frame
from ml.features import build_table
from ml.features.build_table import GROUP
from ml.models import artifact

log = logging.getLogger("test_scorecard")

COVERAGE = 0.9


class NotReady(RuntimeError):
    pass


def check_guard(out_json, log_file, rescore: str | None) -> None:
    """Refuse a second look at the test set unless a reason is given (and recorded)."""
    if out_json.exists() and not rescore:
        raise NotReady(f"the test season was already scored ({out_json}); pass --rescore \"<reason>\" to score it again")


def record_run(log_file, frozen_id: str, rescore: str | None) -> None:
    g = artifact.git_state()
    stamp, reason = dt.datetime.now(dt.UTC).isoformat(), rescore or "first scoring"
    line = f"{stamp}\tartifact={frozen_id}\tcommit={g['commit']}\tdirty={g['dirty']}\treason={reason}\n"
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(line)


def coverage(df: pd.DataFrame, start, end) -> dict:
    days = pd.date_range(start, end, freq="D")
    from ml.common import points

    n_points = len(points())
    want = len(days) * n_points
    lead1 = df[df["lead"] == 1]
    days_per_source = lead1.drop_duplicates(["source", "point_id", "date"])["source"].value_counts()
    truth = df.drop_duplicates(["point_id", "date"])["obs"].notna().sum() / want
    return {"truth": float(truth), "sources": {str(k): int(v) / want for k, v in days_per_source.items()}}


def static_mme_fit_predict(train: pd.DataFrame, test: pd.DataFrame) -> pd.Series:
    """E2 fitted once on the whole training period, per point and lead, applied to the test season."""
    from sklearn.linear_model import Ridge

    from ml.models.baselines import wide

    Xtr, Xte = wide(train, "value"), wide(test, "value")
    cols = Xtr.columns.intersection(Xte.columns)
    Xtr = Xtr[cols].apply(lambda r: r.fillna(r.median()), axis=1)
    Xte = Xte[cols].apply(lambda r: r.fillna(r.median()), axis=1)
    ytr = train.drop_duplicates(GROUP).set_index(GROUP)["obs"].loc[Xtr.index]
    pred = pd.Series(np.nan, index=Xte.index)
    for (pid, lead), g in Xte.groupby(level=["point_id", "lead"]):
        tr = Xtr.xs((pid, lead), level=["point_id", "lead"], drop_level=False)
        tr = tr.dropna()
        if len(tr) < 30:
            continue
        m = Ridge(alpha=1.0).fit(tr, ytr.loc[tr.index])
        pred.loc[g.index] = m.predict(g.fillna(0))
    return pred.clip(lower=0)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--rescore", help="reason for scoring the test season again (recorded)")
    args = ap.parse_args()
    cfg = config()
    reports = path("reports_dir")
    out_json, log_file = reports / "test_scorecard.json", reports / "test_runs.log"
    check_guard(out_json, log_file, args.rescore)

    frozen = artifact.FrozenStageB.load()
    if frozen.meta["config_sha256"] != artifact.config_sha256():
        raise NotReady("config.yaml changed after the model was frozen: re-run validation and ml.models.train first")

    test = cfg["periods"]["test"]
    start, end = pd.Timestamp(test["start"]), pd.Timestamp(test["end"])
    full = build_table.build()
    full = full[full.groupby(GROUP)["value"].transform("size") >= cfg["stage_b"]["min_sources"]]
    df = full[(full["date"] >= start) & (full["date"] <= end)].reset_index(drop=True)
    cov = coverage(df, start, end)
    ready = sum(v >= COVERAGE for v in cov["sources"].values())
    if cov["truth"] < COVERAGE or ready < cfg["stage_b"]["min_sources"]:
        raise NotReady(f"test season not yet covered (truth {cov['truth']:.0%}, {ready} sources >= {COVERAGE:.0%}); "
                       "finish the archive backfill first")
    df = df[df["obs"].notna()].reset_index(drop=True)
    record_run(log_file, frozen.meta["id"], args.rescore)

    truth = df.drop_duplicates(GROUP).set_index(GROUP)["obs"]
    tr = cfg["periods"]["train"]
    train = full[(full["date"] >= tr["start"]) & (full["date"] <= tr["end"]) & full["obs"].notna()]

    b_frame, w = frozen.blend(df)
    b_frame = b_frame.set_index(GROUP)
    sa = stage_a_frame(df).set_index(GROUP)
    preds = pd.DataFrame({
        "E1 equal mean": df.pivot_table(index=GROUP, columns="source", values="value").mean(axis=1),
        "E2 static MME": static_mme_fit_predict(train, df),
        "E3 Stage A": sa["blend"],
        "Bharosa Stage B (frozen)": b_frame["blend"],
    })
    common = preds.dropna().index
    frame = preds.loc[common].join(truth.rename("obs")).reset_index()

    rows = []
    for lead, fl in frame.groupby("lead"):
        for m in preds.columns:
            rows.append({"lead": int(lead), "method": m, "kind": "blend", **score_block(fl, m)})
        for s, g in df[df["lead"] == lead].groupby("source"):
            g = g.set_index(GROUP).loc[lambda x: x.index.isin(common)].reset_index()
            if len(g) > 100:
                rows.append({"lead": int(lead), "method": s, "kind": "source", **score_block(g, "value")})
    table = pd.DataFrame(rows)

    boot = []
    for lead, fl in frame.groupby("lead"):
        d = fl["date"].to_numpy()
        se = {m: ((fl[m] - fl["obs"]) ** 2).to_numpy() for m in preds.columns}
        for ref in ("E3 Stage A", "E2 static MME", "E1 equal mean"):
            diff = scores.block_bootstrap_diff(d, se["Bharosa Stage B (frozen)"], se[ref], stat="rmse")
            boot.append({"lead": int(lead), "b": ref, **diff})
        src = table[(table["lead"] == lead) & (table["kind"] == "source")]
        best = src.loc[src["rmse"].idxmin(), "method"]
        g = df[(df["lead"] == lead) & (df["source"] == best)].set_index(GROUP)["value"]
        j = fl.set_index(GROUP).join(g.rename("best"), how="inner")
        boot.append({"lead": int(lead), "b": f"best source ({best})", **scores.block_bootstrap_diff(
            j.index.get_level_values("date").to_numpy(), ((j["Bharosa Stage B (frozen)"] - j["obs"]) ** 2).to_numpy(),
            ((j["best"] - j["obs"]) ** 2).to_numpy(), stat="rmse")})

    probs = frozen.probabilities(df, w).set_index(GROUP)
    clim = pd.read_parquet(path("data_dir", "static") / "climatology_rain.parquet")
    clim_p = df.drop_duplicates(GROUP)[GROUP + ["doy"]].merge(clim, on=["point_id", "doy"]).set_index(GROUP)
    brier, rel, rev = [], {}, {}
    cost_loss = np.round(np.linspace(0.02, 0.6, 30), 3)
    for t in cfg["thresholds_mm"]:
        c = f"{t:g}"
        cc = c.replace(".", "_")
        cand = {"Stage B + isotonic (frozen)": probs.get(f"p_ge_{c}"),
                "Stage A (normal)": pd.Series(normal_prob(sa["blend"].to_numpy(), sa["sigma"].to_numpy(), t), index=sa.index)}
        ref = clim_p[f"p_ge_{cc}"]
        for m, p in cand.items():
            if p is None:
                continue
            idx = p.dropna().index.intersection(common).intersection(ref.index)
            y = (truth.loc[idx] >= t).astype(float).to_numpy()
            pv = p.loc[idx].to_numpy()
            r = scores.reliability(pv, y)
            brier.append({"threshold": t, "method": m, "n": len(idx), "events": int(y.sum()), "brier": scores.brier(pv, y),
                          "bss_vs_climatology": scores.brier_skill(pv, ref.loc[idx].to_numpy(), y),
                          "reliability": r["reliability"], "resolution": r["resolution"]})
            rel[f"{cc}|{m}"] = r["table"]
            rev[f"{cc}|{m}"] = {"cost_loss": cost_loss.tolist(), "value": scores.relative_economic_value(pv, y, cost_loss).tolist()}

    crps = []
    for lead, fl in frame.groupby("lead"):
        idx = pd.MultiIndex.from_frame(fl[GROUP])
        o = fl["obs"].to_numpy()
        crps.append({"lead": int(lead), "method": "Stage B (frozen)",
                     "crps_normal": scores.crps_normal(b_frame.loc[idx, "blend"].to_numpy(), b_frame.loc[idx, "sigma"].to_numpy(), o)})
        crps.append({"lead": int(lead), "method": "Stage A",
                     "crps_normal": scores.crps_normal(sa.loc[idx, "blend"].to_numpy(), sa.loc[idx, "sigma"].to_numpy(), o)})

    # case studies: three wettest IMD days per region (chosen from the observations only)
    cases = []
    day = frame[frame["lead"] == 1].merge(df.drop_duplicates("point_id")[["point_id", "region"]], on="point_id")
    for region, g in day.groupby("region"):
        top = g.groupby("date")["obs"].mean().nlargest(3).index
        for d in top:
            gd = g[g["date"] == d]
            cases.append({"region": region, "date": str(d.date()), "obs_mean": float(gd["obs"].mean()),
                          **{m: float(gd[m].mean()) for m in preds.columns}})

    result = {
        "generated_at": dt.datetime.now(dt.UTC).isoformat(), "artifact": frozen.meta["id"], "git": artifact.git_state(),
        "period": {"start": str(start.date()), "end": str(end.date())}, "coverage": cov,
        "truth": "IMD 0.25° gridded rainfall", "scores": table.to_dict("records"), "bootstrap": boot,
        "brier": brier, "reliability": rel, "economic_value": rev, "crps": crps, "case_studies": cases,
        "not_computed": {"fractions_skill_score": "needs gridded fields; district points only"},
    }
    write_json(out_json, result, indent=1)
    log.info("test scorecard written: %s", out_json)


if __name__ == "__main__":
    main()

"""Frozen Stage B artifact: everything needed to reproduce a blend, with provenance.

Layout (ml/artifacts/stage_b/<id>/):
  model.txt          LightGBM booster (text format, diff-able, no pickle)
  calibrators.json   isotonic exceedance calibrators as (x, y) knots per threshold/source/lead
  metadata.json      id, created_at, git commit + dirty flag, config SHA-256, feature list, tau, lam,
                     sigma scale, training data manifest, validation summary
ml/artifacts/stage_b/CURRENT names the artifact the test scorecard and the live cycle use.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from ml.common import CONFIG_PATH, ROOT, config
from ml.features.build_table import GROUP

ARTIFACT_ROOT = ROOT / "ml" / "artifacts" / "stage_b"


def config_sha256() -> str:
    return hashlib.sha256(CONFIG_PATH.read_bytes()).hexdigest()


def git_state() -> dict:
    def run(*args):
        return subprocess.check_output(["git", *args], cwd=ROOT, text=True, stderr=subprocess.DEVNULL).strip()

    try:
        return {"commit": run("rev-parse", "HEAD"), "dirty": bool(run("status", "--porcelain"))}
    except (OSError, subprocess.CalledProcessError):
        return {"commit": None, "dirty": None}


@dataclass
class FrozenStageB:
    path: Path
    meta: dict
    booster: object
    calibrators: dict

    @classmethod
    def load(cls, artifact_id: str | None = None) -> FrozenStageB:
        import lightgbm as lgb

        if artifact_id is None:
            artifact_id = (ARTIFACT_ROOT / "CURRENT").read_text().strip()
        d = ARTIFACT_ROOT / artifact_id
        meta = json.loads((d / "metadata.json").read_text(encoding="utf-8"))
        cal = json.loads((d / "calibrators.json").read_text(encoding="utf-8"))
        return cls(d, meta, lgb.Booster(model_file=str(d / "model.txt")), cal)

    @property
    def features(self) -> list[str]:
        return self.meta["features"]

    def predict_error(self, df: pd.DataFrame) -> pd.Series:
        return pd.Series(self.booster.predict(df[self.features]), index=df.index)

    def weights(self, df: pd.DataFrame, pred: pd.Series) -> pd.Series:
        from ml.models.stage_b import weights

        return weights(df, pred, self.meta["tau"], self.meta["lam"])

    def blend(self, df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
        from ml.models.stage_b import blend

        pred = self.predict_error(df)
        w = self.weights(df, pred)
        out = blend(df.assign(pred=pred), w)
        out["sigma"] = self.meta["sigma_scale"] * np.sqrt(out["spread2"] + out["err2"])
        return out, w

    def probabilities(self, df: pd.DataFrame, w: pd.Series) -> pd.DataFrame:
        """Weight-averaged calibrated P(obs >= t) per point/date/lead."""
        cols = {}
        for key, knots in self.calibrators.items():
            t, source, lead = key.split("|")
            rows = (df["source"] == source) & ((df["lead"].astype(str) == lead) | (lead == "all"))
            if not rows.any():
                continue
            c = cols.setdefault(t, pd.Series(np.nan, index=df.index))
            c[rows] = np.interp(df.loc[rows, "corrected"], knots["x"], knots["y"])
        t = df[GROUP].assign(w=w)
        out = []
        for thr, p in cols.items():
            ok = p.notna()
            s = t[ok].assign(wp=t.loc[ok, "w"] * p[ok]).groupby(GROUP).agg(wp=("wp", "sum"), w=("w", "sum"))
            out.append((s["wp"] / s["w"]).rename(f"p_ge_{thr}"))
        return pd.concat(out, axis=1).reset_index() if out else df[GROUP].drop_duplicates()


def save(artifact_id: str, booster, calibrators: dict, meta: dict) -> Path:
    d = ARTIFACT_ROOT / artifact_id
    d.mkdir(parents=True, exist_ok=False)  # never overwrite a frozen artifact
    booster.save_model(str(d / "model.txt"))
    (d / "calibrators.json").write_text(json.dumps(calibrators), encoding="utf-8")
    meta = {"id": artifact_id, "config_sha256": config_sha256(), "git": git_state(),
            "thresholds_mm": config()["thresholds_mm"], **meta}
    (d / "metadata.json").write_text(json.dumps(meta, indent=1, default=str), encoding="utf-8")
    (ARTIFACT_ROOT / "CURRENT").write_text(artifact_id)
    return d

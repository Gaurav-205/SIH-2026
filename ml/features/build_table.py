"""Training table for Stage B: one row per point x valid date x lead x source (rain).

Every feature is available at issue time (valid date V minus lead L):
  forecast  value, Stage A bias-corrected value, consensus (median/mean/sd over sources), deviation
  ledger    decayed MAE, bias, rain ratio and pair count as of V - L (ml/features/ledger.py), MAE rank
  ensemble  GEFS member spread and member-counted P(>= 64.5 / 115.6 mm) for (point, V, L)
  place     elevation, slope, windward index, distance to coast, terrain class, lat, lon
  season    day-of-year (sin, cos) of V, IMD 1991-2020 climatology of V (mean, p95, P>=64.5)
  regime    core-zone anomaly and label observed on V - L, and the region's forecast consensus
  lead      lead day
Targets: obs (IMD), err = corrected - obs, target = log(err^2 + 0.1).
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from ml.common import config, path, points, sources
from ml.features.ledger import ledger_features
from ml.ingest.climatology import doy_leap
from ml.live.stage_a import load_archive, load_ensemble_stats, load_truth

log = logging.getLogger("build_table")

GROUP = ["point_id", "date", "lead"]

FEATURE_GROUPS: dict[str, list[str]] = {
    "forecast": ["value_log", "corr_log", "cons_median_log", "cons_mean_log", "cons_sd_log", "dev_log", "n_sources"],
    "ledger": ["led_mae", "led_bias", "led_ratio_log", "led_n", "led_mae_rank", "led_region_scope"],
    "ensemble": ["ens_sd_log", "ens_p_ge_64_5", "ens_p_ge_115_6"],
    "place": ["lat", "lon", "elev_mean", "slope_mean_deg", "windward_index", "dist_coast_km", "terrain_code"],
    "season": ["doy_sin", "doy_cos", "clim_mean", "clim_p95", "clim_p_ge_64_5"],
    "regime": ["core_z_issue", "core_z3_issue", "regime_code_issue", "region_cons_log", "region_cons_anom"],
    "lead": ["lead"],
    "source": ["source_code"],
}
TERRAIN_CODES = {"coast": 0, "lowland": 1, "plateau": 2, "windward_slope": 3, "crest": 4}
REGIME_CODES = {"off_season": 0, "normal": 1, "active": 2, "break": 3}


def source_codes() -> dict[str, int]:
    return {s.id: i for i, s in enumerate(sources())}


def _log(x):
    return np.log1p(np.clip(x, 0, None))


def stage_a_correct(value: pd.Series, led: pd.DataFrame) -> np.ndarray:
    lo, hi = config()["blend"]["rain_ratio_clip"]
    ratio = ((led["sum_fc"] + 1.0) / (led["sum_obs"] + 1.0)).clip(lo, hi)
    return np.where(led["mae"].notna(), value / ratio, value)


def build(var: str = "rain", exclude_families: tuple[str, ...] = ()) -> pd.DataFrame:
    """Feature table. `exclude_families` drops whole source families before any feature is computed
    (ablations E9/E10), so consensus and Stage A weights never see the removed sources."""
    cfg = config()
    fc = load_archive()
    fc = fc[fc["var"] == var].copy()
    if exclude_families:
        fam = {s.id: s.family for s in sources()}
        fc = fc[~fc["source"].map(fam).isin(exclude_families)]
    truth = load_truth()
    truth = truth[truth["var"] == var]
    log.info("forecast rows %d, truth rows %d", len(fc), len(truth))

    led = ledger_features(fc, truth)
    df = fc.merge(led, on=["source", "point_id", "lead", "var", "date"], how="left")
    df["corrected"] = stage_a_correct(df["value"], df)
    df["value_log"], df["corr_log"] = _log(df["value"]), _log(df["corrected"])

    g = df.groupby(GROUP)
    df["n_sources"] = g["value"].transform("size")
    df["cons_median_log"] = _log(g["corrected"].transform("median"))
    df["cons_mean_log"] = _log(g["corrected"].transform("mean"))
    df["cons_sd_log"] = _log(g["corrected"].transform("std").fillna(0))
    df["dev_log"] = df["corr_log"] - df["cons_median_log"]
    df["led_mae"], df["led_bias"], df["led_n"] = df["mae"], df["bias"], df["n"]
    df["led_ratio_log"] = np.log((df["sum_fc"] + 1) / (df["sum_obs"] + 1))
    df["led_mae_rank"] = g["mae"].rank(pct=True)
    df["led_region_scope"] = (df["scope"] == "region").astype(float).where(df["scope"].notna())

    # Stage A weights (same formula as the live blend); rows without a record get weight 0
    b = cfg["blend"]
    inv = np.power(df["mae"] + b["epsilon"], -b["power"])
    df["w_a"] = inv / inv.groupby([df[c] for c in GROUP]).transform("sum")
    none_rated = df.groupby(GROUP)["mae"].transform(lambda s: s.notna().sum() == 0)
    df.loc[none_rated, "w_a"] = 1.0 / df.loc[none_rated, "n_sources"]
    df["w_a"] = df["w_a"].fillna(0.0)

    # ensemble context (GEFS members) for the same point/date/lead
    ens = load_ensemble_stats()
    ens = ens[(ens["var"] == var) & (ens["source"] == "gefs_ens")]
    if len(ens):
        ens = ens[GROUP + ["sd", "p_ge_64_5", "p_ge_115_6"]].rename(columns={"sd": "ens_sd", "p_ge_64_5": "ens_p_ge_64_5",
                                                                            "p_ge_115_6": "ens_p_ge_115_6"})
        df = df.merge(ens, on=GROUP, how="left")
        df["ens_sd_log"] = _log(df["ens_sd"])
    else:
        df["ens_sd_log"] = df["ens_p_ge_64_5"] = df["ens_p_ge_115_6"] = np.nan

    # place
    sdir = path("data_dir", "static")
    terr = pd.read_parquet(sdir / "terrain.parquet") if (sdir / "terrain.parquet").exists() else None
    pts = pd.DataFrame([{"point_id": p.id, "region": p.region, "lat": p.lat, "lon": p.lon} for p in points()])
    if terr is not None:
        pts = pts.merge(terr.drop(columns=["region", "lat", "lon"]), on="point_id", how="left")
        pts["terrain_code"] = pts["terrain_class"].map(TERRAIN_CODES)
    else:
        for c in ("elev_mean", "slope_mean_deg", "windward_index", "dist_coast_km", "terrain_code"):
            pts[c] = np.nan
        pts["terrain_class"] = None
    df = df.merge(pts, on="point_id", how="left")

    # season: day of year of the valid date and the IMD normal for that day
    doy = doy_leap(df["date"])
    df["doy_sin"], df["doy_cos"] = np.sin(2 * np.pi * doy / 366), np.cos(2 * np.pi * doy / 366)
    df["doy"] = doy
    if (sdir / "climatology_rain.parquet").exists():
        clim = pd.read_parquet(sdir / "climatology_rain.parquet")[["point_id", "doy", "mean", "p95", "p_ge_64_5"]]
        clim = clim.rename(columns={"mean": "clim_mean", "p95": "clim_p95", "p_ge_64_5": "clim_p_ge_64_5"})
        df = df.merge(clim, on=["point_id", "doy"], how="left")
    else:
        df["clim_mean"] = df["clim_p95"] = df["clim_p_ge_64_5"] = np.nan

    # regime: observed as of the issue date V - L (leakage rule), plus the region's forecast consensus
    df["issue"] = df["date"] - pd.to_timedelta(df["lead"].astype(int), unit="D")
    if (sdir / "regimes.parquet").exists():
        reg = pd.read_parquet(sdir / "regimes.parquet")[["date", "z", "z3", "regime"]]
        reg = reg.rename(columns={"date": "issue", "z": "core_z_issue", "z3": "core_z3_issue", "regime": "regime_issue"})
        df = df.merge(reg, on="issue", how="left")
        df["regime_code_issue"] = df["regime_issue"].map(REGIME_CODES)
    else:
        df["core_z_issue"] = df["core_z3_issue"] = df["regime_code_issue"] = np.nan
    cons = df.drop_duplicates(GROUP)[GROUP + ["region", "cons_median_log", "clim_mean"]]
    reg_cons = cons.groupby(["region", "date", "lead"]).agg(region_cons_log=("cons_median_log", "mean"),
                                                            region_clim=("clim_mean", "mean")).reset_index()
    df = df.merge(reg_cons, on=["region", "date", "lead"], how="left")
    df["region_cons_anom"] = df["region_cons_log"] - _log(df["region_clim"])

    df["source_code"] = df["source"].map(source_codes())
    df["family"] = df["source"].map({s.id: s.family for s in sources()})

    # targets
    df = df.merge(truth[["point_id", "date", "obs"]], on=["point_id", "date"], how="left")
    df["err"] = df["corrected"] - df["obs"]
    df["target"] = np.log(df["err"] ** 2 + 0.1)
    return df


def main() -> None:
    df = build()
    out = path("data_dir", "features") / "rain_table.parquet"
    df.to_parquet(out, index=False)
    log.info("feature table: %d rows, %d with truth, %d sources -> %s", len(df), df["obs"].notna().sum(),
             df["source"].nunique(), out)


if __name__ == "__main__":
    main()

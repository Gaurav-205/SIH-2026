"""Stage A: skill ledger + bias-corrected, inverse-error blending (plan section 6).

Pure functions on DataFrames, shared by the live cycle and the scorecard, so what is scored is
exactly what is served.

Tables
  forecasts: point_id, date, source, lead, var, value     (archived or live, daily values)
  truth:     point_id, date, var, obs                     (verified observations)
  ledger:    source, point_id, lead, var, as_of, n, mae, bias, sum_fc, sum_obs, scope
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from ml.common import config, path, points

VARS = ("rain", "tmax", "wind")


# ── Truth ──────────────────────────────────────────────────

def load_truth() -> pd.DataFrame:
    """Verified daily truth per point: IMD final grids (2024-2025), IMD real-time (2026 on) for rain
    and Tmax; ERA5 for wind. Returns point_id, date, var, obs, truth."""
    tdir = path("data_dir", "truth")
    frames = []
    for name, kind in [("imd_rain", "imd_final"), ("imd_tmax", "imd_final"),
                       ("imd_realtime_rain", "imd_realtime"), ("imd_realtime_tmax", "imd_realtime")]:
        f = tdir / f"{name}.parquet"
        if f.exists():
            frames.append(pd.read_parquet(f, columns=["point_id", "date", "var", "value"]).assign(truth=kind))
    era5 = sorted((tdir / "era5").glob("*.parquet")) if (tdir / "era5").exists() else []
    if era5:
        e = pd.concat([pd.read_parquet(f) for f in era5], ignore_index=True)
        frames.append(e[e["var"] == "wind"].assign(truth="era5"))
    if not frames:
        return pd.DataFrame(columns=["point_id", "date", "var", "obs", "truth"])
    t = pd.concat(frames, ignore_index=True).rename(columns={"value": "obs"})
    t["date"] = pd.to_datetime(t["date"])
    # IMD final wins over real-time where both exist
    t = t.sort_values("truth").drop_duplicates(["point_id", "date", "var"], keep="first")
    return t.dropna(subset=["obs"])


FORECAST_KEYS = ["point_id", "date", "source", "lead", "var"]


def load_archive() -> pd.DataFrame:
    """Archived forecasts from every provider: Open-Meteo chunks (chunk*.parquet) and cloud Zarr
    months (zarr_*.parquet, ensemble means for ensembles). If both hold the same key, Open-Meteo wins."""
    files = sorted(path("data_dir", "forecasts").glob("source=*/*.parquet"))  # 'chunk' sorts before 'zarr'
    if not files:
        return pd.DataFrame(columns=[*FORECAST_KEYS, "value"])
    df = pd.concat([pd.read_parquet(f, columns=[*FORECAST_KEYS, "value"]) for f in files], ignore_index=True)
    df["date"] = pd.to_datetime(df["date"])
    df = df.dropna(subset=["value"]).drop_duplicates(FORECAST_KEYS, keep="first")
    return df.reset_index(drop=True)


def load_ensemble_stats() -> pd.DataFrame:
    """Member statistics of the ensemble sources (spread, quantiles, member-counted exceedance)."""
    files = sorted(path("data_dir", "forecasts").glob("source=*/zarr_*.parquet"))
    frames = [f for f in (pd.read_parquet(x) for x in files) if "sd" in f.columns]
    if not frames:
        return pd.DataFrame(columns=FORECAST_KEYS)
    df = pd.concat(frames, ignore_index=True)
    df["date"] = pd.to_datetime(df["date"])
    return df


# ── Skill ledger ───────────────────────────────────────────

def ledger(forecasts: pd.DataFrame, truth: pd.DataFrame, as_of: pd.Timestamp) -> pd.DataFrame:
    """Decaying-average skill of every source x point x lead x var, using only forecasts whose valid
    date is on or before `as_of` (the leakage rule: to forecast lead L valid on V, pass as_of = V - L).

    Points with fewer than `min_pairs` verified days fall back to stats pooled over their region
    (scope = "region"), so a new source is still weighted sensibly.
    """
    cfg = config()["blend"]
    lo = as_of - pd.Timedelta(days=cfg["window_days"])
    f = forecasts[(forecasts["date"] <= as_of) & (forecasts["date"] > lo)]
    m = f.merge(truth[["point_id", "date", "var", "obs"]], on=["point_id", "date", "var"])
    cols = ["source", "point_id", "lead", "var", "n", "mae", "bias", "sum_fc", "sum_obs", "scope"]
    if m.empty:
        return pd.DataFrame(columns=cols + ["as_of"])
    age = (as_of - m["date"]).dt.days.to_numpy()
    m = m.assign(
        w=np.power(0.5, age / cfg["half_life_days"]),
        err=m["value"] - m["obs"],
    )
    m = m.assign(aw=m["w"] * m["err"].abs(), ew=m["w"] * m["err"], fw=m["w"] * m["value"], ow=m["w"] * m["obs"])

    def summarise(g: pd.core.groupby.DataFrameGroupBy) -> pd.DataFrame:
        s = g.agg(n=("err", "size"), w=("w", "sum"), aw=("aw", "sum"), ew=("ew", "sum"), fw=("fw", "sum"), ow=("ow", "sum"))
        return pd.DataFrame({"n": s["n"], "mae": s["aw"] / s["w"], "bias": s["ew"] / s["w"],
                             "sum_fc": s["fw"], "sum_obs": s["ow"]})

    point_stats = summarise(m.groupby(["source", "point_id", "lead", "var"])).reset_index().assign(scope="point")
    region_of = {p.id: p.region for p in points()}
    m = m.assign(region=m["point_id"].map(region_of))
    region_stats = summarise(m.groupby(["source", "region", "lead", "var"])).reset_index()

    ok = point_stats[point_stats["n"] >= cfg["min_pairs"]]
    # every point x source x lead x var that lacks enough point-level history gets its region's stats
    grid = pd.DataFrame([(p.id, p.region) for p in points()], columns=["point_id", "region"])
    pooled = grid.merge(region_stats, on="region").drop(columns="region").assign(scope="region")
    pooled = pooled[pooled["n"] >= cfg["min_pairs"]]
    pooled = pooled.merge(ok[["source", "point_id", "lead", "var"]], how="left", indicator=True,
                          on=["source", "point_id", "lead", "var"])
    pooled = pooled[pooled["_merge"] == "left_only"].drop(columns="_merge")
    out = pd.concat([ok, pooled], ignore_index=True)[cols]
    return out.assign(as_of=as_of)


# ── Blend ──────────────────────────────────────────────────

def _norm_sf(x: np.ndarray) -> np.ndarray:
    """Survival function of the standard normal."""
    return 0.5 * np.vectorize(math.erfc)(x / math.sqrt(2))


def correct(var: str, value: float, stats: pd.Series) -> float:
    """Bias-correct one forecast with its source's recent record."""
    if var == "rain":
        lo, hi = config()["blend"]["rain_ratio_clip"]
        ratio = min(hi, max(lo, (stats["sum_fc"] + 1.0) / (stats["sum_obs"] + 1.0)))
        return value / ratio
    corrected = value - stats["bias"]
    return max(0.0, corrected) if var == "wind" else corrected


def blend_one(var: str, values: dict[str, float], skill: pd.DataFrame) -> dict:
    """Blend one point x lead x variable.

    values: live forecast per source. skill: ledger rows for this point/lead/var indexed by source.
    Sources without a verified record are shown but not weighted; if none has one, the result is an
    equal-weight mean and `method` says so.
    """
    cfg = config()["blend"]
    live = {s: v for s, v in values.items() if v is not None and not math.isnan(v)}
    if not live:
        return {}
    raw = np.array(list(live.values()))
    rated = [s for s in live if s in skill.index]
    if rated:
        corrected = {s: correct(var, live[s], skill.loc[s]) for s in rated}
        inv = {s: (skill.loc[s, "mae"] + cfg["epsilon"]) ** (-cfg["power"]) for s in rated}
        total = sum(inv.values())
        weights = {s: inv[s] / total for s in rated}
        method = "stage_a"
    else:
        corrected = dict(live)
        weights = {s: 1.0 / len(live) for s in live}
        method = "equal_weights_no_verified_history"
    blend = sum(weights[s] * corrected[s] for s in weights)
    spread = math.sqrt(sum(weights[s] * (corrected[s] - blend) ** 2 for s in weights))
    err_sd = (math.sqrt(sum(weights[s] * (cfg["mae_to_sigma"] * skill.loc[s, "mae"]) ** 2 for s in weights))
              if rated else float(np.std(raw)))
    sigma = math.sqrt(spread ** 2 + err_sd ** 2)
    z = cfg["quantile_z"]
    p10, p90 = blend - z * sigma, blend + z * sigma
    if var in ("rain", "wind"):
        blend, p10 = max(0.0, blend), max(0.0, p10)
    if var == "rain":
        drizzle = cfg.get("drizzle_threshold_mm", 0.0)
        if drizzle > 0 and blend < drizzle:
            blend = 0.0
    out = {
        "blend": blend, "p10": p10, "p90": p90, "sigma": sigma,
        "equal_mean": float(raw.mean()), "spread_sd": float(raw.std()),
        "weights": weights, "values": live, "corrected": corrected, "method": method,
    }
    if var == "rain":
        th = np.array(config()["thresholds_mm"], dtype=float)
        prob = _norm_sf((th - blend) / sigma) if sigma > 0 else (blend >= th).astype(float)
        out["prob"] = {str(t): float(p) for t, p in zip(th, prob, strict=True)}
        out["alert_level"] = alert_level(blend, out["prob"])
    return out


def alert_level(blend: float, prob: dict[str, float]) -> str | None:
    a = config()["alerts"]
    p = {float(k): v for k, v in prob.items()}
    red_mm, red_p = a["red"]["blend_mm_with_p_very_heavy"]
    if blend >= a["red"]["blend_mm"] or p[204.5] >= a["red"]["p_extreme"] or (blend >= red_mm and p[115.6] >= red_p):
        return "Red"
    if blend >= a["orange"]["blend_mm"] or p[115.6] >= a["orange"]["p_very_heavy"]:
        return "Orange"
    if blend >= a["yellow"]["blend_mm"] or p[64.5] >= a["yellow"]["p_heavy"]:
        return "Yellow"
    return None


def reasons(var: str, values: dict[str, float], skill: pd.DataFrame, weights: dict[str, float]) -> dict[str, list[dict]]:
    """Plain-language reasons per source, each derived from its verified record."""
    out: dict[str, list[dict]] = {}
    ranked = sorted((s for s in weights if s in skill.index), key=lambda s: skill.loc[s, "mae"])
    med = float(np.median(list(values.values()))) if values else 0.0
    unit = {"rain": "mm", "tmax": "°C", "wind": "m/s"}[var]
    for s, v in values.items():
        rs = []
        if s not in skill.index:
            rs.append({"effect": "down", "text": "No verified record yet at this place, so it is shown but not weighted"})
        else:
            st = skill.loc[s]
            days = int(st["n"])
            if ranked and s == ranked[0]:
                rs.append({"effect": "up", "text": f"Lowest recent error here: {st['mae']:.1f} {unit} over {days} verified days"})
            elif ranked and s == ranked[-1] and len(ranked) > 2:
                rs.append({"effect": "down", "text": f"Largest recent error here: {st['mae']:.1f} {unit} over {days} verified days"})
            if var == "rain" and st["sum_obs"] > 5:
                ratio = (st["sum_fc"] + 1) / (st["sum_obs"] + 1)
                if ratio > 1.25:
                    rs.append({"effect": "down", "text": f"Has run too wet here lately ({(ratio - 1) * 100:.0f}% above observed)"})
                elif ratio < 0.8:
                    rs.append({"effect": "down", "text": f"Has run too dry here lately ({(1 - ratio) * 100:.0f}% below observed)"})
            elif var != "rain" and abs(st["bias"]) >= 1.0:
                rs.append({"effect": "down", "text": f"Recent bias of {st['bias']:+.1f} {unit} (corrected before blending)"})
            if st["scope"] == "region":
                rs.append({"effect": "down", "text": "Too few verified days at this district; skill pooled over the region"})
        if var == "rain" and abs(v - med) / max(med, 5.0) > 0.5:
            rs.append({"effect": "down", "text": "Far from the other models today"})
        out[s] = rs
    return out

"""Daily cycle: refresh IMD real-time truth, fetch live forecasts, update the skill ledger, blend with
Stage A, and export JSON for the backend (ml/exports/). Idempotent; safe to run several times a day.

    python -m ml.daily.run_cycle            # full cycle
    python -m ml.daily.run_cycle --no-truth # skip the IMD real-time download
    python -m ml.daily.run_cycle --scorecard-only
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import logging
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd

from ml.common import config, path, points, sources
from ml.live.forecast import fetch_live, first_valid_date, run_times
from ml.live.scorecard import build as build_scorecard
from ml.live.stage_a import blend_one, ledger, load_archive, load_truth, reasons

log = logging.getLogger("cycle")


# Weights keep 4 decimals so they still sum to 1 within 0.001 after rounding (12 x 0.0833 would
# otherwise become 12 x 0.08 = 0.96); everything else is rounded to 2 decimals.
PRECISE_KEYS = {"weights"}


def _round(x, nd=2):
    if isinstance(x, dict):
        return {k: _round(v, 4 if k in PRECISE_KEYS else nd) for k, v in x.items()}
    if isinstance(x, list):
        return [_round(v, nd) for v in x]
    if isinstance(x, float | np.floating):
        return None if np.isnan(x) else round(float(x), nd)
    return x


def export_dir() -> Path:
    d = Path(path("data_dir").parent / "exports")
    d.mkdir(parents=True, exist_ok=True)
    return d


def issue_time(runs: dict[str, str | None]) -> dt.datetime:
    """The run cycle most live sources share (e.g. 06 UTC today); falls back to 00 UTC today."""
    times = [t for t in runs.values() if t]
    if times:
        return dt.datetime.fromisoformat(Counter(times).most_common(1)[0][0])
    now = dt.datetime.now(dt.UTC)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def build_cycle() -> dict:
    cfg = config()
    runs = run_times()
    init = issue_time(runs)
    # Live forecasts are stored per model run, so re-running the cycle for the same run costs no API calls
    live_file = path("data_dir", "live") / f"forecasts_{init:%Y%m%dT%H}.parquet"
    if live_file.exists():
        live = pd.read_parquet(live_file)
        log.info("reusing stored live forecasts for the %s run", init.isoformat())
    else:
        live = fetch_live(init)
        live.to_parquet(live_file, index=False)
    truth = load_truth()
    archive = load_archive()
    d1 = first_valid_date(init)
    as_of = pd.Timestamp(d1) - pd.Timedelta(days=1)  # valid date V minus lead L is the same for every lead
    led = ledger(archive, truth, as_of)
    led_idx = led.set_index(["point_id", "lead", "var", "source"]) if len(led) else led

    forecasts = []
    for (pid, lead, var), g in live.groupby(["point_id", "lead", "var"]):
        values = dict(zip(g["source"], g["value"], strict=True))
        try:
            skill = led_idx.xs((pid, lead, var), level=["point_id", "lead", "var"])
        except (KeyError, TypeError):
            skill = pd.DataFrame()
        b = blend_one(var, values, skill)
        if not b:
            continue
        rec = {"point_id": pid, "lead": int(lead), "date": str(g["date"].iloc[0].date()), "var": var, **b}
        rec["skill"] = {s: {"mae": float(r["mae"]), "bias": float(r["bias"]), "n": int(r["n"]), "scope": r["scope"]}
                        for s, r in skill.iterrows()} if len(skill) else {}
        if var == "rain":
            rec["reasons"] = reasons(var, values, skill, b["weights"])
        forecasts.append(_round(rec))

    rain_truth = truth[truth["var"] == "rain"]
    static_f = path("data_dir", "static") / "points.parquet"
    elevation = pd.read_parquet(static_f).set_index("point_id")["elevation_m"].to_dict() if static_f.exists() else {}
    return {
        "version": 1,
        "generated_at": dt.datetime.now(dt.UTC).isoformat(),
        "issue": {"init_utc": init.isoformat(), "lead_dates": {str(lead): str(d1 + dt.timedelta(days=lead - 1)) for lead in cfg["leads"]}},
        "method": {"name": "Stage A: bias-corrected inverse-error weighting", **cfg["blend"]},
        "truth": {
            "rain": "IMD 0.25° gridded rainfall (final 2024-2025, real-time 2026)",
            "tmax": "IMD 1.0° gridded Tmax (final 2024-2025, real-time 2026)",
            "wind": "ERA5 (Open-Meteo Historical Weather API)",
            "latest_rain_truth_date": str(rain_truth["date"].max().date()) if len(rain_truth) else None,
            "ledger_as_of": str(as_of.date()),
        },
        "sources": [{"id": s.id, "label": s.label, "family": s.family, "live": s.live, "run_init_utc": runs.get(s.id)}
                    for s in sources()],
        "regions": [{"id": k, "name": v["name"]} for k, v in cfg["regions"].items()],
        "points": [{"id": p.id, "name": p.name, "region": p.region, "lat": p.lat, "lon": p.lon,
                    "elevation_m": elevation.get(p.id)} for p in points()],
        "thresholds_mm": cfg["thresholds_mm"],
        "forecasts": forecasts,
        "attribution": "Forecasts: Open-Meteo (CC BY 4.0) with ECMWF, NOAA, DWD, UKMO, JMA, CMA, ECCC, Météo-France data. "
                       "Truth: India Meteorological Department (IMD), Pune.",
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-truth", action="store_true")
    ap.add_argument("--scorecard-only", action="store_true")
    args = ap.parse_args()
    out = export_dir()
    if not args.scorecard_only:
        if not args.no_truth:
            from ml.ingest import imd_realtime
            imd_realtime.main_for_cycle()
        cycle = build_cycle()
        name = f"cycle_{cycle['issue']['init_utc'][:13].replace(':', '').replace('-', '')}.json"
        for target in (out / name, out / "latest.json"):
            target.write_text(json.dumps(cycle, separators=(",", ":")), encoding="utf-8")
        log.info("cycle %s: %d forecasts -> %s", cycle["issue"]["init_utc"], len(cycle["forecasts"]), out / name)
    card = build_scorecard()
    (out / "scorecard.json").write_text(json.dumps(_round(card, 3), separators=(",", ":")), encoding="utf-8")
    log.info("scorecard: %d rows", len(card["rows"]))


if __name__ == "__main__":
    main()

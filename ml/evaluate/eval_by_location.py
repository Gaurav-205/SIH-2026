"""Evaluate individual models and blends separately on Pune Ghats, Pune Plains, and Mumbai."""

import numpy as np
import pandas as pd
from ml.live.stage_a import load_truth, load_archive
from ml.evaluate import scores

truth = load_truth()
archive = load_archive()

t_rain = truth[truth["var"] == "rain"].copy()
a_rain = archive[archive["var"] == "rain"].copy()

m = a_rain.merge(t_rain[["point_id", "date", "var", "obs"]], on=["point_id", "date", "var"])
m = m[m["lead"] == 1].copy()

locations = ["pune-ghats", "pune-plains", "mumbai"]

for loc in locations:
    sub_loc = m[m["point_id"] == loc]
    print(f"\n======================================================================")
    print(f"LOCATION: {loc.upper()} (Total point-days: {len(sub_loc.drop_duplicates('date'))})")
    print(f"Observed Rain Stats: Mean={sub_loc.drop_duplicates('date')['obs'].mean():.2f} mm | Max={sub_loc.drop_duplicates('date')['obs'].max():.2f} mm | >0mm: {(sub_loc.drop_duplicates('date')['obs'] > 0).mean()*100:.1f}%")
    print(f"----------------------------------------------------------------------")
    print(f"{'Model / Source':32s} | {'N':>5s} | {'MAE':>6s} | {'RMSE':>6s} | {'Bias':>6s} | {'Corr':>5s} | {'ETS >64.5':>9s}")
    print(f"----------------------------------------------------------------------")
    
    rows = []
    for src, g in sub_loc.groupby("source"):
        if len(g) < 50:
            continue
        c = scores.continuous(g["value"].to_numpy(), g["obs"].to_numpy())
        cat = scores.categorical(g["value"].to_numpy(), g["obs"].to_numpy(), 64.5)
        rows.append({
            "source": src,
            "n": len(g),
            "mae": c["mae"],
            "rmse": c["rmse"],
            "bias": c["bias"],
            "corr": c["corr"],
            "ets": cat["ets"]
        })
    df_rows = pd.DataFrame(rows).sort_values("rmse")
    for _, r in df_rows.iterrows():
        print(f"{r['source']:32s} | {r['n']:5d} | {r['mae']:6.2f} | {r['rmse']:6.2f} | {r['bias']:+6.2f} | {r['corr']:5.3f} | {r['ets']:9.3f}")

"""Simulate and compare baseline models vs Stage A on Pune & Mumbai."""

import pandas as pd
import numpy as np
from ml.live.stage_a import load_truth, load_archive, ledger, blend_one
from ml.evaluate import scores
from ml.common import config

truth = load_truth()
archive = load_archive()

t_rain = truth[truth["var"] == "rain"].copy()
a_rain = archive[archive["var"] == "rain"].copy()

target_points = ["pune-ghats", "pune-plains", "mumbai"]

# Filter for target points and Lead 1
m = a_rain.merge(t_rain[["point_id", "date", "var", "obs"]], on=["point_id", "date", "var"])
m = m[(m["point_id"].isin(target_points)) & (m["lead"] == 1)].copy()

# Focus on evaluation period where multiple models exist (e.g. 2024-05-01 to 2024-10-01)
# and 2026-06-01 to 2026-09-25
eval_df = m[(m["date"] >= "2024-05-01") & (m["date"] <= "2024-09-30")].copy()
print(f"Evaluation sample rows: {len(eval_df)}")

# For each date and point_id in eval_df:
# Compute:
# 1) Equal-weight mean
# 2) Stage A blend
# Compare against obs

dates_points = eval_df[["date", "point_id"]].drop_duplicates().sort_values(["date", "point_id"])
print(f"Unique point-dates to evaluate: {len(dates_points)}")

results = []

for _, row in dates_points.iterrows():
    d = row["date"]
    pid = row["point_id"]
    obs_val = eval_df[(eval_df["date"] == d) & (eval_df["point_id"] == pid)]["obs"].iloc[0]
    
    # Live values for this point-date
    sub = eval_df[(eval_df["date"] == d) & (eval_df["point_id"] == pid)]
    if len(sub) < 3:
        continue
    values = dict(zip(sub["source"], sub["value"]))
    
    # As of date for no leakage (for lead 1, valid date d minus 1 day)
    as_of = d - pd.Timedelta(days=1)
    
    # Build ledger up to as_of
    led = ledger(archive, truth, as_of)
    if len(led):
        try:
            skill = led.set_index(["point_id", "lead", "var", "source"]).xs((pid, 1, "rain"), level=["point_id", "lead", "var"])
        except (KeyError, TypeError):
            skill = pd.DataFrame()
    else:
        skill = pd.DataFrame()
        
    b = blend_one("rain", values, skill)
    if not b:
        continue
        
    res = {
        "date": d,
        "point_id": pid,
        "obs": obs_val,
        "equal_mean": b["equal_mean"],
        "stage_a": b["blend"],
    }
    for s, v in values.items():
        res[f"raw_{s}"] = v
    results.append(res)

res_df = pd.DataFrame(results)
print(f"Evaluated {len(res_df)} point-dates.")

def print_metrics(name, pred, obs):
    c = scores.continuous(pred, obs)
    cat = scores.categorical(pred, obs, 64.5)
    print(f"{name:30s}: MAE={c['mae']:6.2f} mm | RMSE={c['rmse']:6.2f} mm | Bias={c['bias']:+6.2f} mm | Corr={c['corr']:5.3f} | ETS_64.5={cat['ets']:5.3f}")

print("\n=== OVERALL BENCHMARK (Pune Ghats, Pune Plains, Mumbai - Monsoon 2024) ===")
obs = res_df["obs"].to_numpy()
print_metrics("Equal-Weight Mean (E1)", res_df["equal_mean"].to_numpy(), obs)
print_metrics("Current Stage A Blend", res_df["stage_a"].to_numpy(), obs)

for col in res_df.columns:
    if col.startswith("raw_"):
        sub = res_df.dropna(subset=[col])
        if len(sub) > 100:
            sname = col.replace("raw_", "")
            print_metrics(f"Raw {sname}", sub[col].to_numpy(), sub["obs"].to_numpy())

"""Fast tuning and refinement of blending models on Pune Ghats, Pune Plains, and Mumbai."""

import numpy as np
import pandas as pd
from ml.live.stage_a import load_truth, load_archive
from ml.evaluate import scores
from ml.common import config

print("Loading truth and archive...")
truth = load_truth()
archive = load_archive()

t_rain = truth[truth["var"] == "rain"].copy()
a_rain = archive[archive["var"] == "rain"].copy()

target_points = ["pune-ghats", "pune-plains", "mumbai"]
m = a_rain.merge(t_rain[["point_id", "date", "var", "obs"]], on=["point_id", "date", "var"])
m = m[(m["point_id"].isin(target_points)) & (m["lead"] == 1)].copy()

print(f"Total matching records for target points: {len(m)}")

# We evaluate on dates with at least 3 models
# Group by (date, point_id)
grouped = m.groupby(["date", "point_id"])
valid_keys = [k for k, g in grouped if len(g) >= 3]
print(f"Total valid (date, point_id) cases: {len(valid_keys)}")

# Let's inspect parameter sensitivity:
# 1. Decay half_life_days: [10, 15, 20, 30]
# 2. Power: [1.0, 1.5, 2.0]
# 3. Drizzle threshold / thresholding: [0.0, 0.2, 0.5]
# 4. Multiplicative vs additive / combined bias correction

# Pre-filter archive and truth for Maharashtra / Konkan points to speed up ledger
mah_points = [
    "palghar", "thane", "mumbai", "raigad", "ratnagiri", "sindhudurg",
    "pune-ghats", "pune-plains", "nashik-ghats", "nashik-plains", "satara-ghats", "kolhapur-ghats"
]
arch_mah = a_rain[a_rain["point_id"].isin(mah_points)].copy()
truth_mah = t_rain[t_rain["point_id"].isin(mah_points)].copy()
merged_hist = arch_mah.merge(truth_mah[["point_id", "date", "obs"]], on=["point_id", "date"])

unique_dates = sorted(list(set(k[0] for k in valid_keys)))
print(f"Unique dates: {len(unique_dates)}")

# Pre-calculate ledger stats efficiently
def compute_ledger_table(as_of, half_life=20, window_days=90):
    lo = as_of - pd.Timedelta(days=window_days)
    sub = merged_hist[(merged_hist["date"] <= as_of) & (merged_hist["date"] > lo) & (merged_hist["lead"] == 1)]
    if sub.empty:
        return {}
    age = (as_of - sub["date"]).dt.days.to_numpy()
    w = np.power(0.5, age / half_life)
    err = sub["value"] - sub["obs"]
    sub = sub.assign(err=err, w=w, aw=w * np.abs(err), ew=w * err, fw=w * sub["value"], ow=w * sub["obs"])
    g = sub.groupby(["point_id", "source"]).agg(
        n=("err", "size"),
        w=("w", "sum"),
        aw=("aw", "sum"),
        ew=("ew", "sum"),
        fw=("fw", "sum"),
        ow=("ow", "sum"),
    )
    g["mae"] = g["aw"] / g["w"]
    g["bias"] = g["ew"] / g["w"]
    g["sum_fc"] = g["fw"]
    g["sum_obs"] = g["ow"]
    return g.to_dict(orient="index")

print("Running parameter sweep on Pune & Mumbai...")

configs_to_test = [
    {"name": "Current Stage A (HL=20, P=2.0, clip=[0.4, 2.5], drizzle=0.0)", "hl": 20, "p": 2.0, "lo": 0.4, "hi": 2.5, "drizzle": 0.0},
    {"name": "Refined Blend 1 (HL=20, P=1.5, clip=[0.5, 2.0], drizzle=0.2)", "hl": 20, "p": 1.5, "lo": 0.5, "hi": 2.0, "drizzle": 0.2},
    {"name": "Refined Blend 2 (HL=14, P=1.5, clip=[0.6, 1.8], drizzle=0.2)", "hl": 14, "p": 1.5, "lo": 0.6, "hi": 1.8, "drizzle": 0.2},
    {"name": "Refined Blend 3 (HL=25, P=1.2, clip=[0.5, 2.0], drizzle=0.3)", "hl": 25, "p": 1.2, "lo": 0.5, "hi": 2.0, "drizzle": 0.3},
    {"name": "Refined Blend 4 (HL=20, P=1.0, clip=[0.5, 2.0], drizzle=0.2)", "hl": 20, "p": 1.0, "lo": 0.5, "hi": 2.0, "drizzle": 0.2},
]

# We sample every 2nd date or evaluate all dates in monsoon (months 6, 7, 8, 9)
monsoon_dates = [d for d in unique_dates if d.month in (6, 7, 8, 9)]
print(f"Monsoon dates count: {len(monsoon_dates)}")

for cfg_idx, cfg_item in enumerate(configs_to_test):
    preds, obs_list, eq_preds = [], [], []
    hl = cfg_item["hl"]
    power = cfg_item["p"]
    lo, hi = cfg_item["lo"], cfg_item["hi"]
    drizzle = cfg_item["drizzle"]
    
    for d in monsoon_dates:
        as_of = d - pd.Timedelta(days=1)
        led_map = compute_ledger_table(as_of, half_life=hl)
        
        for pid in target_points:
            sub = m[(m["date"] == d) & (m["point_id"] == pid)]
            if len(sub) < 3:
                continue
            
            obs_val = sub["obs"].iloc[0]
            raw_vals = sub["value"].to_numpy()
            eq_preds.append(float(np.mean(raw_vals)))
            obs_list.append(obs_val)
            
            # Blend
            rated = []
            inv_weights = []
            corrected = []
            
            for _, r in sub.iterrows():
                src = r["source"]
                val = r["value"]
                key = (pid, src)
                if key in led_map and led_map[key]["n"] >= 5:
                    st = led_map[key]
                    ratio = min(hi, max(lo, (st["sum_fc"] + 1.0) / (st["sum_obs"] + 1.0)))
                    c_val = val / ratio
                    if drizzle > 0 and c_val < drizzle:
                        c_val = 0.0
                    mae = st["mae"]
                    w_inv = (mae + 0.1) ** (-power)
                    inv_weights.append(w_inv)
                    corrected.append(c_val)
                else:
                    corrected.append(val)
                    inv_weights.append(1.0)
            
            tot_w = sum(inv_weights)
            weights = [w / tot_w for w in inv_weights]
            b_val = sum(w * c for w, c in zip(weights, corrected))
            preds.append(max(0.0, b_val))
            
    p_arr, o_arr, eq_arr = np.array(preds), np.array(obs_list), np.array(eq_preds)
    sc = scores.continuous(p_arr, o_arr)
    cat = scores.categorical(p_arr, o_arr, 64.5)
    
    if cfg_idx == 0:
        eq_sc = scores.continuous(eq_arr, o_arr)
        eq_cat = scores.categorical(eq_arr, o_arr, 64.5)
        print(f"\nBaseline Equal Mean : MAE={eq_sc['mae']:5.2f}, RMSE={eq_sc['rmse']:5.2f}, Bias={eq_sc['bias']:+5.2f}, ETS_64.5={eq_cat['ets']:.3f}, Corr={eq_sc['corr']:.3f}")

    print(f"{cfg_item['name']:60s}: MAE={sc['mae']:5.2f}, RMSE={sc['rmse']:5.2f}, Bias={sc['bias']:+5.2f}, ETS_64.5={cat['ets']:.3f}, Corr={sc['corr']:.3f}")

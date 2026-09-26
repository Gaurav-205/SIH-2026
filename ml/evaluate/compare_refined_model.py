"""Refine blending model and compare against verified IMD ground truth observations.

Generates:
1. Accuracy comparison tables across individual models, baseline ensemble, and refined blend.
2. Direct comparison with recent current readings in September 2026 for Pune Ghats, Pune Plains, and Mumbai.
3. Detailed error reduction and skill improvements.
"""

import numpy as np
import pandas as pd
from ml.live.stage_a import load_truth, load_archive
from ml.evaluate import scores
from ml.common import config

print("Loading IMD verified truth and forecast archive...")
truth = load_truth()
archive = load_archive()

t_rain = truth[truth["var"] == "rain"].copy()
a_rain = archive[archive["var"] == "rain"].copy()

target_points = ["pune-ghats", "pune-plains", "mumbai"]

# Filter lead 1 rain
m = a_rain.merge(t_rain[["point_id", "date", "var", "obs"]], on=["point_id", "date", "var"])
m = m[(m["point_id"].isin(target_points)) & (m["lead"] == 1)].copy()

# -------------------------------------------------------------
# 1. EVALUATION OVER ALL MULTI-MODEL DATES
# -------------------------------------------------------------
# Group by (date, point_id)
grouped = m.groupby(["date", "point_id"])
eval_cases = [k for k, g in grouped if len(g) >= 3]

# Efficient rolling ledger with Refined Parameters:
# Half-life: 14 days, Power: 1.5, Ratio clip: [0.55, 1.85], Drizzle threshold: 0.25 mm for plains
def run_evaluation(half_life=14, power=1.5, lo=0.55, hi=1.85):
    # Pre-merge history
    mah_points = [
        "palghar", "thane", "mumbai", "raigad", "ratnagiri", "sindhudurg",
        "pune-ghats", "pune-plains", "nashik-ghats", "nashik-plains", "satara-ghats", "kolhapur-ghats"
    ]
    arch_mah = a_rain[a_rain["point_id"].isin(mah_points) & (a_rain["lead"] == 1)].copy()
    truth_mah = t_rain[t_rain["point_id"].isin(mah_points)].copy()
    hist = arch_mah.merge(truth_mah[["point_id", "date", "obs"]], on=["point_id", "date"])
    
    unique_dates = sorted(list(set(k[0] for k in eval_cases)))
    
    records = []
    
    for d in unique_dates:
        as_of = d - pd.Timedelta(days=1)
        lo_date = as_of - pd.Timedelta(days=90)
        sub_h = hist[(hist["date"] <= as_of) & (hist["date"] > lo_date)]
        
        led_map = {}
        if not sub_h.empty:
            age = (as_of - sub_h["date"]).dt.days.to_numpy()
            w = np.power(0.5, age / half_life)
            err = sub_h["value"] - sub_h["obs"]
            sub_h = sub_h.assign(err=err, w=w, aw=w * np.abs(err), ew=w * err, fw=w * sub_h["value"], ow=w * sub_h["obs"])
            g = sub_h.groupby(["point_id", "source"]).agg(
                n=("err", "size"), w=("w", "sum"), aw=("aw", "sum"), ew=("ew", "sum"), fw=("fw", "sum"), ow=("ow", "sum")
            )
            g["mae"] = g["aw"] / g["w"]
            g["bias"] = g["ew"] / g["w"]
            g["sum_fc"] = g["fw"]
            g["sum_obs"] = g["ow"]
            led_map = g.to_dict(orient="index")
            
        for pid in target_points:
            sub = m[(m["date"] == d) & (m["point_id"] == pid)]
            if len(sub) < 3:
                continue
                
            obs = sub["obs"].iloc[0]
            raw_vals = dict(zip(sub["source"], sub["value"]))
            eq_mean = float(np.mean(list(raw_vals.values())))
            
            # Baseline Stage A
            w_a_list, corr_a_list = [], []
            for s, v in raw_vals.items():
                if (pid, s) in led_map and led_map[(pid, s)]["n"] >= 5:
                    st = led_map[(pid, s)]
                    r = min(2.5, max(0.4, (st["sum_fc"] + 1.0) / (st["sum_obs"] + 1.0)))
                    c_v = v / r
                    mae = st["mae"]
                    w_a_list.append((mae + 0.1) ** -2.0)
                    corr_a_list.append(c_v)
                else:
                    corr_a_list.append(v)
                    w_a_list.append(1.0)
            tot_wa = sum(w_a_list)
            base_stage_a = sum((w / tot_wa) * c for w, c in zip(w_a_list, corr_a_list))
            
            # Refined Stage A+:
            # 1. Power 1.5 instead of 2.0
            # 2. Tighter clip [0.55, 1.85]
            # 3. Drizzle deadband for plains (0.25 mm)
            w_ref_list, corr_ref_list = [], []
            for s, v in raw_vals.items():
                if (pid, s) in led_map and led_map[(pid, s)]["n"] >= 5:
                    st = led_map[(pid, s)]
                    r = min(hi, max(lo, (st["sum_fc"] + 1.0) / (st["sum_obs"] + 1.0)))
                    c_v = v / r
                    if pid == "pune-plains" and c_v < 0.25:
                        c_v = 0.0
                    mae = st["mae"]
                    w_ref_list.append((mae + 0.1) ** -power)
                    corr_ref_list.append(c_v)
                else:
                    corr_ref_list.append(v)
                    w_ref_list.append(1.0)
            tot_wref = sum(w_ref_list)
            refined_stage_a = sum((w / tot_wref) * c for w, c in zip(w_ref_list, corr_ref_list))
            
            rec = {
                "date": d,
                "point_id": pid,
                "obs": obs,
                "equal_mean": eq_mean,
                "base_stage_a": max(0.0, base_stage_a),
                "refined_blend": max(0.0, refined_stage_a),
            }
            for s, v in raw_vals.items():
                rec[s] = v
            records.append(rec)
            
    return pd.DataFrame(records)

print("Simulating evaluation across full multi-model verified record...")
df_eval = run_evaluation()
print(f"Total evaluated point-days: {len(df_eval)}")

# Overall and per-location metrics
def calc_metrics(df, pred_col):
    valid = df.dropna(subset=[pred_col, "obs"])
    c = scores.continuous(valid[pred_col].to_numpy(), valid["obs"].to_numpy())
    cat = scores.categorical(valid[pred_col].to_numpy(), valid["obs"].to_numpy(), 64.5)
    return {
        "n": len(valid),
        "mae": c["mae"],
        "rmse": c["rmse"],
        "bias": c["bias"],
        "corr": c["corr"],
        "ets_64_5": cat["ets"]
    }

print("\n" + "=" * 90)
print(f"{'OVERALL COMPARISON ON PUNE & MUMBAI (Lead 1 Rain)':^90}")
print("=" * 90)
models_to_report = [
    ("Refined Blend (AtmosFusion)", "refined_blend"),
    ("Base Stage A Blend", "base_stage_a"),
    ("Equal-Weight Ensemble Mean", "equal_mean"),
    ("GEFS Ensemble Mean", "gefs_ens"),
    ("ECMWF AIFS (AI)", "ecmwf_aifs025_single"),
    ("ECMWF IFS 0.25°", "ecmwf_ifs025"),
    ("NCEP GFS", "gfs_global"),
    ("DWD ICON", "icon_global"),
    ("JMA GSM", "jma_gsm"),
    ("ECCC GEM", "gem_global"),
    ("CMA GRAPES", "cma_grapes_global"),
    ("Météo-France ARPEGE", "meteofrance_arpege_world"),
]

print(f"{'Model / Pipeline':30s} | {'N':>5s} | {'MAE (mm)':>9s} | {'RMSE (mm)':>9s} | {'Bias (mm)':>9s} | {'Corr':>6s} | {'ETS >64.5':>9s}")
print("-" * 90)
for label, col in models_to_report:
    if col in df_eval.columns:
        m_res = calc_metrics(df_eval, col)
        print(f"{label:30s} | {m_res['n']:5d} | {m_res['mae']:9.2f} | {m_res['rmse']:9.2f} | {m_res['bias']:+9.2f} | {m_res['corr']:6.3f} | {m_res['ets_64_5']:9.3f}")

# Breakdown by District
print("\n" + "=" * 90)
print(f"{'LOCATION BREAKDOWN: PUNE-GHATS vs PUNE-PLAINS vs MUMBAI':^90}")
print("=" * 90)

for loc in target_points:
    sub = df_eval[df_eval["point_id"] == loc]
    print(f"\n--- {loc.upper()} (N = {len(sub)}) ---")
    print(f"{'Model / Pipeline':30s} | {'MAE (mm)':>9s} | {'RMSE (mm)':>9s} | {'Bias (mm)':>9s} | {'Corr':>6s} | {'ETS >64.5':>9s}")
    print("-" * 75)
    for label, col in [
        ("Refined Blend (AtmosFusion)", "refined_blend"),
        ("Base Stage A Blend", "base_stage_a"),
        ("Equal-Weight Ensemble Mean", "equal_mean"),
        ("GEFS Ensemble Mean", "gefs_ens"),
        ("ECMWF AIFS (AI)", "ecmwf_aifs025_single"),
        ("ECMWF IFS 0.25°", "ecmwf_ifs025"),
        ("NCEP GFS", "gfs_global"),
        ("DWD ICON", "icon_global"),
    ]:
        if col in sub.columns:
            m_res = calc_metrics(sub, col)
            print(f"{label:30s} | {m_res['mae']:9.2f} | {m_res['rmse']:9.2f} | {m_res['bias']:+9.2f} | {m_res['corr']:6.3f} | {m_res['ets_64_5']:9.3f}")

# -------------------------------------------------------------
# 2. DIRECT COMPARISON WITH RECENT CURRENT READINGS (SEPT 2026)
# -------------------------------------------------------------
print("\n" + "=" * 90)
print(f"{'RECENT OBSERVATIONS vs FORECAST COMPARISONS (September 2026)':^90}")
print("=" * 90)

# Check recent readings in truth
rt = truth[(truth["point_id"].isin(target_points)) & (truth["var"] == "rain") & (truth["date"] >= "2026-09-18")].copy()
rt = rt.sort_values(["date", "point_id"])
print(f"\nIMD Real-time Verified Rainfall Readings (03:00 - 03:00 UTC):")
print(rt[["date", "point_id", "obs"]].to_string(index=False))

# Let's inspect matching forecasts from archive/live for these exact dates
recent_dates = rt["date"].unique()
recent_f = m[(m["date"].isin(recent_dates)) & (m["lead"] == 1)]
if not recent_f.empty:
    print(f"\nMatching Day-1 Model Forecasts vs Verified Readings:")
    piv = recent_f.pivot_table(index=["date", "point_id"], columns="source", values="value", aggfunc="first").reset_index()
    piv = piv.merge(rt[["date", "point_id", "obs"]], on=["date", "point_id"], how="left")
    print(piv.to_string(index=False))

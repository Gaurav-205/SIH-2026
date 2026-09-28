"""Evaluate current model performance and diagnose areas for refinement on Pune and Mumbai."""

import pandas as pd

from ml.evaluate import scores
from ml.live.stage_a import load_archive, load_truth

truth = load_truth()
archive = load_archive()

# Filter for rain
t_rain = truth[truth["var"] == "rain"].copy()
a_rain = archive[archive["var"] == "rain"].copy()

m = a_rain.merge(t_rain[["point_id", "date", "var", "obs"]], on=["point_id", "date", "var"])

target_points = ["pune-ghats", "pune-plains", "mumbai"]
m_target = m[m["point_id"].isin(target_points)].copy()

print(f"Total merged records for Pune & Mumbai: {len(m_target)}")
print(f"Date range: {m_target['date'].min().date()} to {m_target['date'].max().date()}")

# Evaluation per model for Lead 1
lead1 = m_target[m_target["lead"] == 1]

print("\n--- INDIVIDUAL MODELS (Lead 1, Rain) on Pune Ghats, Pune Plains & Mumbai ---")
stats = []
for src, g in lead1.groupby("source"):
    f, o = g["value"].to_numpy(), g["obs"].to_numpy()
    c = scores.continuous(f, o)
    cat = scores.categorical(f, o, 64.5)
    stats.append(
        {"source": src, "n": len(g), "mae": c["mae"], "rmse": c["rmse"], "bias": c["bias"], "corr": c["corr"], "ets_64_5": cat["ets"]}
    )

df_stats = pd.DataFrame(stats).sort_values("rmse")
print(df_stats.to_string(index=False))

# Now let's evaluate Stage A on these points
# Simulate Stage A daily prediction
print("\nSimulating Stage A on the dataset...")
# Group by date, point_id, lead
results = []
# Test on a representative evaluation window (e.g. 2024 monsoon onwards)
dates = sorted(lead1["date"].unique())
print(f"Total dates to evaluate: {len(dates)}")

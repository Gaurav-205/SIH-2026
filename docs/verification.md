# Verification

Current results live in generated reports, which are the single source of truth; this page explains how
to read them.

| Report | Period | What it answers |
| :--- | :--- | :--- |
| [`ml/reports/validation.md`](../ml/reports/validation.md) | training period, out-of-fold | Which method is best? Does each factor help? (E0–E10, B-alt) |
| `ml/reports/test_scorecard.json` | 2025 monsoon, frozen model, scored once | Does it hold on unseen data? |
| `ml/exports/scorecard.json` (Verification page) | all verified days | Stage A (what is live today) vs each model and the equal mean |

Every score names its truth. Rain is always scored against **IMD 0.25° gridded rainfall**.

## Scores

| Score | Meaning | Better |
| :--- | :--- | :--- |
| RMSE, MAE (mm/day) | typical size of the error; RMSE punishes large misses more | lower |
| bias | mean forecast − observed | nearer 0 |
| corr | linear correlation with observations | higher |
| POD | share of observed heavy-rain days (≥ 64.5 mm) that were forecast | higher |
| FAR | share of forecast heavy-rain days that did not happen | lower |
| CSI | hits / (hits + misses + false alarms) | higher |
| ETS | CSI corrected for hits expected by chance; 0 = no skill | higher |
| SEDI | extremal dependence index; unlike ETS, it does not decay for rare events | higher (max 1) |
| frequency bias | forecast events / observed events | nearer 1 |
| Brier score | mean squared error of a probability | lower |
| BSS vs climatology | 1 − Brier / Brier(IMD 1991–2020 probability for that day and place) | > 0 means better than climatology |
| reliability / resolution | Murphy decomposition: calibration error (lower) and ability to separate events (higher) | — |
| CRPS | error of the whole predictive distribution, in mm | lower |
| quantile score | mean pinball loss of p10/p50/p90 | lower |
| 10–90% coverage | share of observations inside the 10–90% range | ≈ 0.80 |
| relative economic value | benefit of acting on the forecast for a user with cost/loss ratio C/L, relative to perfect forecasts | higher (max 1) |

## Confidence intervals

Days are autocorrelated, so intervals come from a **paired block bootstrap** over blocks of 5
consecutive days (1,000 resamples). "Paired" means both methods are resampled on the same days, and
the interval is on their difference. An interval that contains 0 is **not** a demonstrated
improvement, and the reports say so.

## Stratification

Validation RMSE is also broken down by region, terrain class, monsoon regime on the valid day (an
observed label, used only to group scores), and rain intensity. This shows where the blend wins or
loses rather than a single average.

## What is not computed, and why

- **Fractions Skill Score:** needs gridded fields; the pipeline works at 29 district points.
- **Comparison with IMD district warnings:** needs IMD's warnings API (IP whitelisting) and an archive
  of past warnings.

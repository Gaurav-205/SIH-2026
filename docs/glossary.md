# Glossary

| Term | Meaning |
| :--- | :--- |
| **AIFS** | ECMWF's Artificial Intelligence Forecasting System, a machine-learned global model |
| **B-alt** | the stacking alternative to Stage B: LightGBM predicts the observation directly |
| **Blend** | the weighted combination of bias-corrected forecasts |
| **Block bootstrap** | resampling blocks of consecutive days to get confidence intervals on autocorrelated data |
| **Core zone** | the central-India box whose rain anomaly defines monsoon active/break spells |
| **CRPS** | continuous ranked probability score: the error of a whole forecast distribution (mm) |
| **Cross-fitting** | tuning on one half of the months and applying to the other, so scores never use their own tuning |
| **E0–E10** | the experiment codes in validation (see [methodology](methodology.md#baselines-and-the-alternative)) |
| **ETS** | equitable threat score: hits corrected for chance, for an event such as rain ≥ 64.5 mm |
| **GEFS** | NOAA's Global Ensemble Forecast System (31 members) |
| **IMD thresholds** | 64.5 mm/day heavy, 115.6 mm/day very heavy, 204.5 mm/day extremely heavy |
| **IMD rain day** | the 24 h ending 03 UTC (08:30 IST) on the labelled date |
| **Lead (L)** | days between the forecast's issue date and its valid date; lead 1 = tomorrow |
| **Leakage** | using information not available when the forecast is issued; forbidden, and tested |
| **Ledger** | each model's decayed recent error, bias and wet/dry ratio at a place and lead |
| **MME** | multi-model ensemble; "static MME" = regression weights fitted once (IMD style) |
| **Previous Runs** | Open-Meteo's archive of what each model predicted 1–7 days before each hour |
| **Regime** | the weather situation, e.g. active or break monsoon |
| **SEDI** | symmetric extremal dependence index, a skill score that stays informative for rare events |
| **Stage A** | the bias-corrected, inverse-error-weighted blend with no fitted parameters |
| **Stage B** | the learned gating: LightGBM predicts each model's error, which sets the weights |
| **Windward index** | the mean terrain rise along the south-west monsoon flow (m/km) |

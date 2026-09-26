# 0008: Stage A stays live until the frozen test confirms Stage B

**Context.** Validation on 2024 (out-of-fold, cross-fitted) gave mixed results:
- **For Stage B:** lower RMSE than Stage A at every lead, though the interval crosses zero at 4 of 5 leads.
- **Clearly better probabilistic forecasts:** CRPS is 0.36–0.47 mm lower at all leads, and Brier skill
  at 64.5 mm is higher.
- **Against Stage B:** slightly lower heavy-rain ETS (0.29 vs 0.31 at day 1).
- **ECMWF AIFS alone** is statistically tied with Stage B on its own days.

There are other practical gaps too. The live cycle does not fetch GEFS, which Stage B uses as a feature
and a source. Several live models (IFS 9 km, AIGFS, HGEFS) have no training history.

**Decision.** Keep serving Stage A, which has no fitted parameters and is robust to new models. Stage B is
frozen (`ml/artifacts/stage_b/`) and gets scored once on the June–September 2025 test. It goes live only
if that test confirms the validation gains, with live GEFS added to the cycle first.

**Consequences.** The website's numbers stay conservative and fully explainable. The Verification page
shows the Stage B evidence, including where it loses. If the test confirms Stage B, the most likely
first deployment is its probabilistic output (ranges and exceedance chances), where the gain is clearest.

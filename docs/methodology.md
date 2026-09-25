# Methodology

This page gives the science behind the numbers: conventions, the leakage rule, the models and the way
they are validated. Constants live in [`ml/config.yaml`](../ml/config.yaml); code paths are linked.

## Domain

- **Places:** 29 district centroids in Konkan & Goa (15) and Kerala (14), each with an IMD truth cell.
  The design moves to a regular 0.25° grid with a config change, once gridded archives are affordable
  (see [decision 0002](decisions/0002-district-points-first.md)).
- **Variables:** 24 h rainfall (primary), daily maximum 2 m temperature, and daily mean 10 m wind.
- **Leads:** days 1–5. Lead L for valid day V comes from the run issued on V − L.

## Day conventions

IMD's rain day ends at **03 UTC (08:30 IST)**. Every rain value, forecast or observed, is the total
over the 24 h ending 03 UTC on the labelled date.

- **Open-Meteo hourly totals:** the day sums the values stamped from 04 UTC on D−1 to 03 UTC on D
  ([`ingest/daily.py`](../ml/ingest/daily.py)). A day with any missing hour is missing, never a
  partial sum.
- **Zarr step rates:** these are integrated over forecast hours [24(L−1)+3, 24L+3] from the 00 UTC run.
  A step that straddles 03 UTC is split in proportion to time
  ([`ingest/zarr_archive.py`](../ml/ingest/zarr_archive.py)).
- **Measured, not assumed:** the labelling offset between our windows and IMD's dates was measured on
  29,000 monsoon point-days in 2024. Offset 0 correlated best for all 9 models tested.
- **Tmax and wind:** these use the IST calendar day.

## The leakage rule

To forecast lead L valid on V, the model may only use forecast errors whose valid date is ≤ V − L,
that is, everything already verified when the forecast is issued. Three places enforce this:

1. `ledger(forecasts, truth, as_of = V − L)` in [`live/stage_a.py`](../ml/live/stage_a.py), used
   live and in the scorecard.
2. `ledger_features` in [`features/ledger.py`](../ml/features/ledger.py), the vectorised version used
   for training. Tests prove it equals (1) to 1e-9, and that changing any observation after V − L
   leaves the features of (V, L) unchanged.
3. Regime labels are causal: a label on day t uses no day after t. They enter the model as of the
   issue date, never the valid date.

## Stage A: skill ledger and inverse-error blend

For each source s, point, lead and variable, the verified errors in the last 90 days before V − L are
averaged with a decaying weight 0.5^(age/20 days):

- MAE_s = Σ w |f − o| / Σ w
- bias_s = Σ w (f − o) / Σ w
- ratio_s = (Σ w f + 1) / (Σ w o + 1)

A source needs at least 10 verified pairs at the point, otherwise it uses the pool of its region. If
neither has 10, it is shown but not weighted.

- **Bias correction:** rain is divided by the ratio, clipped to [0.4, 2.5]. Tmax and wind are corrected
  additively (wind is floored at 0).
- **Weights:** w_s ∝ (MAE_s + 0.1)⁻², normalised to sum to 1.
- **Blend:** μ = Σ w_s f̃_s, where f̃ is the corrected forecast.
- **Uncertainty:** σ² = Σ w_s (f̃_s − μ)² + Σ w_s (1.2533 · MAE_s)². The first term is the weighted
  spread; the second turns a MAE into a normal-error variance, since √(π/2) = 1.2533.
- **Range and probabilities:** P10/P90 = μ ∓ 1.2816 σ (P10 floored at 0). P(rain ≥ T) comes from
  N(μ, σ²) for the IMD thresholds 64.5, 115.6 and 204.5 mm.
- **Alerts:** IMD-style colour codes from the blend and those probabilities (rules in `alerts:`).

Stage A has **no fitted parameters**; its constants are the plan's defaults. That makes it safe to
score on any period, including the test season.

## Stage B: learned gating

One LightGBM model ([`models/stage_b.py`](../ml/models/stage_b.py)) predicts every source's
**log(bias-corrected error² + 0.1)** from features known at issue time
([`features/build_table.py`](../ml/features/build_table.py)):

| Group | Features |
| :--- | :--- |
| forecast | the source's value and corrected value (log1p); consensus median, mean and sd; deviation from consensus; number of sources |
| ledger | decayed MAE, bias, log ratio and pair count as of V − L; the MAE's rank among sources; region-pooled flag |
| ensemble | GEFS member spread; member-counted P(≥ 64.5) and P(≥ 115.6) |
| place | lat, lon, elevation, slope, windward index, distance to coast, terrain class |
| season | day-of-year sine/cosine of V; the IMD 1991–2020 normal for V (mean, 95th percentile, P ≥ 64.5) |
| regime | core-zone anomaly and active/break label observed on V − L; the region's forecast consensus and its anomaly |
| lead, source | lead day (with a monotone constraint: predicted error cannot fall as lead grows); source id (categorical) |

**Weights:** w_B = softmax(−pred/τ) over the sources present. Then w = λ·w_B + (1 − λ)·w_A (w_A are the
Stage A weights), floored at 0.02 and renormalised. The blend is Σ w f̃. σ² = weighted spread² + Σ w ·
exp(pred), multiplied by a scale fitted by CRPS.

**One pooled model, not one per source.** This departs from the plan. With two years of data, a
per-source model would see about 10,000 rows each; pooling lets sources share structure (for example,
"errors grow on the windward Ghats in active spells"). The source id stays a feature, so source-specific
behaviour can still be learned ([decision 0004](decisions/0004-pooled-stage-b.md)).

LightGBM settings are the plan's starting values: 63 leaves, learning rate 0.03, at most 2,000 trees with
early stopping at 100, min 500 rows per leaf, feature and bagging fractions 0.8, λ_L2 = 5.

## Baselines and the alternative

| Code | Method | Why it is there |
| :--- | :--- | :--- |
| E0 | each source alone (raw) | the spread of single-model skill; "best single source" is the bar |
| E1 | equal-weight mean | what naive multi-model averaging gives |
| E2 | static MME: per-point, per-lead ridge regression on the raw forecasts, fitted once | the IMD/Krishnamurti superensemble style: the operational bar to beat |
| E3 | Stage A | the value of recent, local skill |
| E4 | Stage B (with and without heavy-rain row weights 1 + log1p(obs)) | full AtmosFusion |
| B-alt | LightGBM stacking: predicts the observation directly (mean) plus p10/p50/p90 quantile models, sorted so they never cross | the honest alternative to gating |
| E5–E8 | E4 without regime / lead / place / season features | does each factor from the problem statement add skill? |
| E9, E10 | E4 without AI sources / without ensemble sources (tables rebuilt without them) | the value of the hybrid source pool |

## Extremes

Per source and lead, an isotonic regression maps the corrected forecast to P(obs ≥ T); the 204.5 mm
threshold pools all leads because such events are rare. The blended probability averages the sources'
calibrated probabilities with the blend weights ([`models/extremes.py`](../ml/models/extremes.py)).

These are compared with:
- Stage A's normal probabilities;
- GEFS member counts;
- IMD 1991–2020 climatology, the Brier-skill reference.

## Regimes

Monsoon **active/break** labels follow Rajeevan, Gadgil & Bhate (2010). The daily rain over the core
zone (a box approximating their polygon, 18–28°N and 69–88°E, land cells) is standardised by the IMD
1991–2020 day-of-year mean and standard deviation. Within June–September a day is active when z > 1 and
break when z < −1, each only once a run of 3 such days has built up. The labels are causal
([`features/regimes.py`](../ml/features/regimes.py)).

Not yet implemented: lows and depressions from MSLP minima, western disturbances from 500 hPa troughs,
and heatwaves from IMD Tmax criteria. These need pressure-level fields at forecast time; the AIFS Zarr
archive has them, so they are the next regime step.

## Terrain

From Copernicus DEM GLO-90, resampled to about 275 m ([`ingest/terrain.py`](../ml/ingest/terrain.py)):
- **In the 0.25° cell:** mean, sd and max elevation, mean slope, aspect and land fraction.
- **Windward index:** the mean positive terrain rise along the south-west monsoon flow (from 240°),
  within ±0.5°, in m/km.
- **Distance to coast:** from the Natural Earth 10 m coastline.

Each district is classed as coast, windward slope, crest, plateau or lowland. The rules were set in
config before any skill was looked at.

## Validation design

- **Blocked leave-one-month-out cross-validation** inside the training period. Each month is predicted
  by models fitted without it and without the 10 days either side. Early stopping uses a different
  month, half a year away.
- **Cross-fitting** of the few tuned scalars (τ, λ, σ scale). They are tuned on one half of the months
  and applied to the other half, so no reported number used parameters tuned on its own data.
- **Scores per lead**, with paired 5-day block-bootstrap 95% intervals on the difference from Stage A,
  E2, E1 and the best single source.

## Freeze and test protocol

1. Run `ml.evaluate.validation`, and choose the Stage B variant on validation RMSE.
2. Run `ml.models.train` to freeze the model. This writes an immutable artifact with the git commit,
   config hash and data manifest.
3. Run `ml.evaluate.test_scorecard`, which scores June–September 2025 once. It refuses if:
   - the config changed after freezing;
   - the test season is not yet downloaded;
   - the test was already scored (unless given a reason, which is logged to `ml/reports/test_runs.log`).

## References

- Krishnamurti et al. (1999), *Science*: multimodel superensemble
- Raftery et al. (2005), *Mon. Wea. Rev.*: Bayesian model averaging
- Gneiting et al. (2005), *Mon. Wea. Rev.*: EMOS and CRPS
- Hamill et al. (2017), *Mon. Wea. Rev.*: NBM quantile mapping
- Rasp & Lerch (2018), *Mon. Wea. Rev.*: neural post-processing
- Vannitsem et al. (2021), *BAMS*: post-processing review
- Rajeevan, Gadgil & Bhate (2010), *J. Earth Syst. Sci.*: active and break monsoon
- Ferro & Stephenson (2011), *Wea. Forecasting*: SEDI
- Murphy (1973), *J. Appl. Meteor.*: Brier score decomposition
- Richardson (2000), *QJRMS*: relative economic value
- Lang et al. (2024): AIFS

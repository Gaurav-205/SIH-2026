# Changelog

## 2026-09-26: data expansion, Stage B, documentation
- **Validation results (2024, out-of-fold):**
  - Stage B RMSE 13.28 vs Stage A 13.45 at day 1; not yet significant.
  - CRPS is significantly lower at every lead.
  - ECMWF AIFS alone is statistically tied with the blend.
  - Removing AI sources is the costliest ablation.
- **Stage B frozen** as `stage_b_20260926T064849Z`. Stage A stays live (decision 0008).
- **Fairness fixes to evaluation:**
  - The "best single source" is now the least favourable paired comparison.
  - The live scorecard scores every method only on days where the blend exists.
- **Robustness:**
  - Every JSON export is strict (NaN → null, `allow_nan=False`).
  - The API client reports an unreadable response instead of rendering nothing.
  - IMD downloads are retried and size-checked.
  - Validation has a `--smoke` mode and per-experiment caching.
- **Website:** the Verification page gains a "Model development" section (E0–E10, significance,
  Brier skill, feature importance), served by `GET /api/v1/validation`.
- **New datasets:**
  - ECMWF AIFS 2024-04 → 2025-02 and the NOAA GEFS 31-member ensemble, from dynamical.org Zarr
  - IMD 1991–2020 rain and Tmax normal
  - Copernicus DEM GLO-90 terrain and the Natural Earth coastline
- **Features:** vectorised leakage-free ledger (proven equal to the live one); causal monsoon
  active/break regimes; terrain classes; climatology; the Stage B training table.
- **Models:**
  - Stage B LightGBM gating, E2 static MME and B-alt stacking with quantiles
  - isotonic exceedance calibration
  - frozen artifacts with provenance, and a test scorecard with a run-once guard
- **Evaluation:** a full score library (SEDI, Brier decomposition, CRPS, quantile score, economic value,
  paired block bootstrap), and validation E0–E10 with reports and figures.
- **Fixes:**
  - The newest Open-Meteo chunk is now extended incrementally; it used to be re-downloaded daily, costing
    ~3,400 calls/day.
  - An all-missing answer now fails loudly.
  - A stale BOM file for after its discontinuation was removed.
- **Engineering:** GitHub Actions CI (web, ml, backend); ruff for the backend; `npm run typecheck`;
  the `docs/` folder with decision records.

## 2026-09-25: live data only
- Removed all demo and hardcoded data. The website reads only pipeline exports through the backend.
- Live cycle: Open-Meteo live runs, IMD real-time truth, Stage A blend, and a scorecard against IMD.
- Redesigned website: sign-up → onboarding → dashboard; light/dark themes; real accounts.

# Changelog

## 2026-09-26: data expansion, Stage B, documentation
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

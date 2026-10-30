# Changelog

## 2026-10-30: bug-fix and design pass
- **Fixes:**
  - `/` shows the Landing page again (it redirected to `/app`, so sign-out and "Leave demo" looped
    back into the guest session, and the Landing header always showed "Open dashboard").
  - Stage A drizzle filter zeroed the blend but could leave P10 above it; P10 now follows (test added).
  - Changing the password now revokes earlier tokens and returns a fresh one for the current session.
  - Malformed tokens or stored password hashes return 401/400 instead of a 500.
  - The login-failure tracker is bounded in memory.
  - The Briefing's alert count uses the same rule as the Alerts page (including the user's threshold).
  - The range bar marker shows where the blend sits between P10 and P90 (it was fixed at the middle).
  - Verification highlights the blend under either export name; the feature list shows the top 12.
  - Model colours no longer reuse IMD warning colours, and none are invisible on light backgrounds.
  - `index.html` forced a dark `color-scheme` on the light theme; the saved theme now applies before
    first paint (no flash).
  - Empty states name what is missing (scorecard, validation report) instead of always "the outlook".
  - The 5-day chart caption no longer overflows its card; empty regions show a message.
  - Landing copy matched the old Stage A constants (inverse square, 20-day half-life); it and
    `docs/methodology.md` now match `ml/config.yaml` (power 1.5, 14-day half-life).
  - Malappuram is treated as coastal for wave context.
- **Design:** one token and component layer in `src/index.css`; a sticky app header with the day and
  region selectors; accent colour replaces the leftover monochrome styling across pages, onboarding,
  auth and Landing; new favicon matching the logo.

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

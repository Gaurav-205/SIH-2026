# Changelog

## 2026-11-01: production deployment on Vercel
- **Deployment:** the site and API run as one Vercel project (`api/index.py`, `vercel.json`,
  `.vercelignore`). A scheduled GitHub Actions workflow publishes a live cycle and deploys daily.
- **Accounts on PostgreSQL:** `BHAROSA_DATABASE_URL` switches the account store from SQLite to
  PostgreSQL (psycopg). The schema is created on first use; CI runs the backend suite on both.
- **Security:** login throttling moved from process memory to the database, so it holds across
  serverless instances. CSP, HSTS, frame-denial and related headers on every response.
- **Fixes:**
  - The Verification page crashed whenever the scorecard was empty (`s.periods` undefined), which is
    the normal state of a new deployment. The browser suite now fails on any error-boundary screen.
  - Pipeline exports were written with mode 0600, unreadable by an API running as another user.
  - Production builds pointed at `http://localhost:8000` unless `VITE_API_URL` was set; they now
    use the same origin.
  - A database outage at startup no longer takes the forecast endpoints down.
- `python -m ml.evaluate.report` republishes the website copy of the committed validation report.
- **Skill-weighted live blend in production:** the deploy job fetches IMD real-time truth, ERA5 wind
  and the recent forecast archive (`ml.ingest.openmeteo --since today-100`). First production
  scorecard (24 Jul–31 Oct 2026, day 1 rain): Bharosa RMSE 10.85 mm vs 11.35 mm equal-weight mean.
- Sign-ups limited to 10 per hour per client IP. `POSTGRES_URL` from Vercel integrations accepted.
- Row level security is enabled on every account table on PostgreSQL, so Supabase's public API cannot
  read them through its anon key; the backend owns the tables and is unaffected.
- An unreachable accounts database now returns a clear 503 instead of a bare 500; login and sign-up
  offer the demo in that case.
- District map labels are placed by pixel collision at the current zoom; Verification opens on a
  period that has scores.

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

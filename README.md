# Bharosa: hybrid AI–NWP multi-model rainfall forecast blending

> **SIH26081 · NCMRWF, Ministry of Earth Sciences**
>
> Bharosa blends physics, AI and ensemble forecasts for 29 districts in Konkan & Goa and Kerala. Each
> model is weighted by how well it has recently verified against IMD observations at that place and lead
> time, and the forecast is shown as a range with the evidence behind it.

[![CI](https://github.com/gaurav-205/SIH-2026/actions/workflows/ci.yml/badge.svg)](https://github.com/gaurav-205/SIH-2026/actions/workflows/ci.yml)

The running app reads pipeline exports and provider APIs. When data is missing it says so; it never
substitutes demonstration forecasts. Automated tests use explicitly synthetic fixtures. Published
scientific claims depend on the validation protocol and source data described in **[docs/](docs/README.md)**.

---

## Contents

- [How it fits together](#how-it-fits-together)
- [Data](#data) · [Method](#method) · [Results so far](#results-so-far-validation-2024-29-districts-against-imd-rain)
- [The web app](#the-web-app)
- [Quickstart](#quickstart)
- [Configuration](#configuration)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation) · [License](#license)

## How it fits together

```
 Open-Meteo / dynamical.org / IMD          ml/  (Python pipeline)               backend/  (FastAPI)        src/  (React)
 ───────────────────────────────►  ingest → skill ledger → Stage A blend  ─►  ml/exports/*.json  ─►  /api/v1/*  ─►  web app
                                    validation, Stage B (frozen)                accounts (SQLite)
```

1. **`ml/`** downloads forecasts and IMD truth, scores every model, blends them, and writes JSON
   exports to `ml/exports/` (`latest.json`, `cycle_<issue>.json`, `scorecard.json`, `validation.json`).
2. **`backend/`** serves those exports read-only, plus user accounts, alert acknowledgements and a
   read-only operations view.
3. **`src/`** is the web app. It validates every publication before displaying it.

## Data

| What | Source | Used for |
| :--- | :--- | :--- |
| Live forecasts, days 1–5 | [Open-Meteo](https://open-meteo.com/en/docs): ECMWF IFS & AIFS, NCEP GFS/AIGFS/HGEFS, DWD ICON, JMA, CMA, ECCC, Météo-France, UKMO | today's blend, alerts, maps |
| Archived forecasts | [Open-Meteo Previous Runs API](https://open-meteo.com/en/docs/previous-runs-api) | skill ledger, training, verification |
| ECMWF AIFS 2024 + NOAA GEFS 31 members | [dynamical.org](https://dynamical.org/catalog/) cloud Zarr (anonymous) | an AI model in the 2024 training year; ensemble spread |
| Rain / Tmax truth | IMD 0.25° / 1° gridded data (final and real-time) | every score and every skill weight |
| Climatology | IMD 1991–2020 normal (30 years) | Brier-skill reference, extreme-rain features, monsoon regimes |
| Terrain | Copernicus DEM GLO-90, Natural Earth coastline | slope, windward index, distance to coast, terrain class |

Licences, coverage and verification dates for each dataset: [docs/data-sources.md](docs/data-sources.md).

## Method

- **Stage A:** a bias-corrected, inverse-error blend with no fitted parameters:
  w ∝ (MAE + 0.1)^−1.5, where MAE is each model's recent error at that district and lead (14-day
  half-life, last 90 days), computed only from forecasts verified before the forecast was issued.
  **This is what the website serves today.** Its constants are in `blend:` in
  [`ml/config.yaml`](ml/config.yaml).
- **Stage B:** a LightGBM gating model that predicts each model's error from its forecast, the consensus,
  its skill record, place, season, regime and lead, and turns those predictions into weights.
- **Baselines:** each model alone, the equal-weight mean, a static MME (IMD-style ridge regression), and
  LightGBM stacking. Ablations remove one factor at a time.

Details: [docs/methodology.md](docs/methodology.md).

## Results so far (validation, 2024, 29 districts, against IMD rain)

These are out-of-fold results: each month is predicted by models trained without it and without the 10
days either side. The full report is [ml/reports/validation.md](ml/reports/validation.md), and the
website's Verification page shows the same numbers.

| Day-1 rain | RMSE (mm) | ETS ≥ 64.5 mm |
| :--- | ---: | ---: |
| **Stage B** | **13.28** | 0.29 |
| Stage A | 13.45 | 0.31 |
| LightGBM stacking (B-alt) | 13.61 | 0.12 |
| Equal-weight mean | 13.97 | 0.09 |
| Static MME (IMD style) | 14.26 | 0.32 |

What the paired 5-day block bootstrap (95% intervals) says:

- **Wins:**
  - Stage B beats every physics model at day 1 (by 1.7–8.4 mm RMSE), the equal mean (−0.69 mm) and
    the static MME (−0.99 mm).
  - Its **probabilistic forecast is clearly better than Stage A's at every lead**: CRPS is lower by
    0.36–0.47 mm, and Brier skill for ≥ 64.5 mm is 0.14 vs 0.10 against climatology.
- **Not yet significant:** Stage B vs Stage A on RMSE (−0.17 mm, interval −0.46 to +0.08). Stage B vs
  **ECMWF AIFS alone**, which on its own days is statistically tied with the blend (+0.06 mm, interval
  −0.81 to +1.10).
- **Losses:**
  - Heavy-rain ETS: Stage B 0.29 vs Stage A 0.31; the static MME has the best ETS but the worst RMSE.
  - Regime, place and season features add no measurable skill yet (ablations E5–E8).
  - Removing AI sources is the costliest ablation (+0.27 mm), so the hybrid pool matters.

> **Note:** `ml/reports/validation.*` was generated *before* commit `753983d` changed the Stage A
> constants (half-life 20 → 14 days, power 2 → 1.5, rain-ratio clip, drizzle filter). Re-run
> `python -m ml.evaluate.validation` to refresh the Stage A row; see
> [methodology](docs/methodology.md#stage-a-skill-ledger-and-inverse-error-blend).

**The held-out test (June–September 2025) has not been scored yet.** The model is frozen
(`ml/artifacts/stage_b/`), and the test runs once the archive backfill reaches 2025. Stage A stays
live until then ([decision 0008](docs/decisions/0008-stage-a-live-until-test.md)).

---

## The web app

```
Landing (/) ─► Sign up ─► Onboarding (/welcome) ─► Workspace (/app)
   │                      role · home region ·        ├─ Briefing       your district, five-day outlook, range, next steps
   ├─► Log in ──────────  alert threshold · lead ────►├─ Explore        map, per-district blend, model weights and reasons
   └─► Explore the demo (guest, no account) ─────────►├─ Forecast       region map + table by lead day, archived publications
                                                      ├─ Alerts         acknowledge / reopen, CAP 1.2 XML & JSON export
                                                      ├─ Model insights trust map, weight matrix, model disagreement
                                                      ├─ Verification   live scorecard, model development (E0–E10), consistency checks
                                                      └─ Preferences    profile, region, threshold, theme, password, delete account
/admin  read-only publication and source monitoring (server-designated administrators only)
```

- Region, lead day, district and archived issue live in the URL, so every view can be shared.
- Guests get the full app; their preferences and acknowledgements stay in the browser.
- Light, dark and system themes; layouts are tested from 320 px to 1440 px; reduced-motion is respected.
- Alerts and CAP exports are **prototype, model-derived alerts** (CAP status `Exercise`), not official
  IMD warnings.

## Quickstart

**Prerequisites:** Node.js 20.19+ (or 22.13+) and Python 3.11+. Run everything from the repository root.

<details open>
<summary><b>Linux / macOS</b></summary>

```bash
python3 -m venv ml/.venv && ml/.venv/bin/python -m pip install -r ml/requirements.lock
python3 -m venv backend/.venv && backend/.venv/bin/python -m pip install -r backend/requirements-dev.txt
npm install
```

```bash
cd backend && .venv/bin/python -m uvicorn main:app --port 8000     # API on http://localhost:8000
```

```bash
npm run dev                                                        # web app on http://localhost:5173
```
</details>

<details>
<summary><b>Windows (PowerShell or Git Bash)</b></summary>

```bash
python -m venv ml/.venv && ml/.venv/Scripts/python.exe -m pip install -r ml/requirements.lock
python -m venv backend/.venv && backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
npm install
```

```bash
cd backend && .venv/Scripts/python.exe -m uvicorn main:app --port 8000
```

```bash
npm run dev
```
</details>

Open http://localhost:5173. Until the pipeline has produced data, the forecast pages say that
nothing has been published yet. That is expected, and accounts already work.

**Produce data** (every step is in [docs/pipeline.md](docs/pipeline.md); use `Scripts/python.exe` on Windows):

```bash
ml/.venv/bin/python -m ml.ingest.openmeteo --run      # archive backfill (stops at the free-tier budget; re-run daily)
ml/.venv/bin/python -m ml.ingest.zarr_archive --run   # AIFS + GEFS from cloud Zarr
ml/.venv/bin/python -m ml.daily.run_cycle             # live forecasts + IMD update + blend → ml/exports/
ml/.venv/bin/python -m ml.evaluate.validation         # out-of-fold validation → ml/reports/ and ml/exports/
```

## Configuration

Frontend (copy `.env.example` to `.env.local`):

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:8000` | URL of the Bharosa API |

Backend (environment variables; the older `ATMOSFUSION_*` names are still accepted):

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `BHAROSA_EXPORTS` | `ml/exports` | directory of pipeline exports to serve |
| `BHAROSA_DB` | `backend/bharosa.db` | SQLite accounts database |
| `BHAROSA_SECRET` | generated, stored in the DB | token signing key; **set it in production** |
| `BHAROSA_TOKEN_TTL` | `604800` (7 days) | session lifetime in seconds |
| `BHAROSA_CORS_ORIGINS` | local dev ports | comma-separated allowed origins |
| `BHAROSA_ADMIN_USER_IDS` | *(none)* | comma-separated account ids allowed into `/admin` |

Pipeline settings (districts, sources, blend constants, alert rules, API budgets) are in
[`ml/config.yaml`](ml/config.yaml).

## Testing

The same checks run in CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). None of them
download anything.

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

```bash
ml/.venv/bin/ruff check ml backend && ml/.venv/bin/python -m pytest ml/tests -q
```

```bash
cd backend && .venv/bin/python -m pytest -q
```

**Browser tests** (Playwright; the API is mocked with a synthetic fixture). Start `npm run dev` first:

```bash
BROWSER_CHANNEL=chromium node tests/browser.cjs
```

The end-to-end account test needs a running backend with a **disposable** database:

```bash
BHAROSA_TEST_ACCOUNTS=1 BROWSER_CHANNEL=chromium node tests/browser-accounts.cjs
```

## Project structure

```
backend/            FastAPI app: main.py (data endpoints), accounts.py + auth.py (accounts, tokens),
                    routers/admin.py (operations), services/ (publication status, environmental context)
ml/                 pipeline: ingest/, features/, live/ (Stage A), models/ (Stage B), evaluate/, daily/
  config.yaml       districts, sources, blend constants, alert rules, API budgets
  reports/          committed validation reports and figures
  artifacts/        frozen Stage B model (metadata and weights)
src/                React app
  pages/            public (landing, auth), app (workspace pages), admin
  layouts/          app shell (sidebar, sticky header, mobile navigation)
  components/       design-system primitives (ui.tsx), map, alerts, loading/empty states
  features/         forecast contract + freshness, environmental context, admin data
  data/             React Query hooks and types for cycles, alerts and view state
  lib/              API client, IMD categories and palettes, exports (CSV, GeoJSON, CAP 1.2)
tests/              frontend unit + browser tests and the synthetic fixture
docs/               architecture, methodology, pipeline, API, decisions (ADRs), changelog
```

## Troubleshooting

| Symptom | Cause / fix |
| :--- | :--- |
| "…hasn't been published yet" on every page | No export in `ml/exports/` yet. Run `python -m ml.daily.run_cycle`. |
| "The forecast service is temporarily unavailable" | The API is not running, or `VITE_API_URL` points elsewhere. |
| Sign-up fails with a CORS error | Add your frontend origin to `BHAROSA_CORS_ORIGINS`. |
| Everyone is signed out after a restart | `BHAROSA_SECRET` changed. Set it to a fixed value. |
| `/admin` says "Access restricted" | Add your account id to `BHAROSA_ADMIN_USER_IDS` and restart the API. |
| Map tiles are blank | The browser cannot reach `server.arcgisonline.com`; forecasts still work. |

## Documentation

[Architecture](docs/architecture.md) · [Data sources](docs/data-sources.md) · [Methodology](docs/methodology.md) · [Pipeline](docs/pipeline.md) · [Verification](docs/verification.md) · [API](docs/api.md) · [Frontend](docs/frontend.md) · [Operations](docs/operations.md) · [Development](docs/development.md) · [Decisions](docs/decisions/README.md) · [Glossary](docs/glossary.md) · [Changelog](docs/changelog.md)

Background: [product and codebase review](docs/redesign/PRODUCT_REVIEW.md) · [implementation notes](docs/redesign/IMPLEMENTATION.md).

## License

[MIT](LICENSE). Developed for NCMRWF, Ministry of Earth Sciences. Data: Open-Meteo (CC BY 4.0), ECMWF and NOAA
via dynamical.org (CC BY 4.0), India Meteorological Department, Copernicus DEM, and Natural Earth.

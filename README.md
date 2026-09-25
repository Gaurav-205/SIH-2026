# AtmosFusion — Hybrid AI–NWP Multi-Model Forecast Blending

> **SIH26081 · NCMRWF, Ministry of Earth Sciences**
> Blends 13 live global forecasts (physics, AI and ensemble) for 29 districts in Konkan & Goa and Kerala. Each model is weighted by its recent, verified skill against IMD observations at that place.

Every number in the app comes from a live API or a published dataset. Nothing is hardcoded or simulated. If the pipeline has not been run yet, the dashboard says so and does not show placeholder data.

---

## Data sources

| What | Source | Used for |
| :--- | :--- | :--- |
| Live forecasts (latest run, days 1–5) | [Open-Meteo Forecast API](https://open-meteo.com/en/docs): ECMWF IFS 0.25° and 9 km, ECMWF AIFS, NCEP GFS, NCEP AIGFS, NCEP HGEFS mean, DWD ICON, JMA GSM, CMA GRAPES, ECCC GEM, Météo-France ARPEGE, BOM ACCESS-G, UKMO 10 km | Today's blend, alerts, maps |
| Archived forecasts (what each model predicted at each lead time) | [Open-Meteo Previous Runs API](https://open-meteo.com/en/docs/previous-runs-api) | Skill ledger (weights) and the hindcast scorecard |
| Model run times | Open-Meteo `static/meta.json` per model | Which run is live, and the valid dates |
| Rainfall truth | IMD 0.25° gridded rainfall ([imdlib](https://pypi.org/project/imdlib/)): final grids for 2024–2025, real-time grids from 2026 | Verification, skill weights |
| Max-temperature truth | IMD 1° gridded Tmax (final + real-time) | Tmax skill |
| Wind truth | ERA5 via the Open-Meteo archive | Wind skill |

Licences: Open-Meteo data is CC BY 4.0 (free tier, non-commercial). IMD data belongs to the India Meteorological Department, Pune. Both are credited in the app.

## How the blend works (Stage A)

For each district, variable and lead day:

1. **Skill ledger.** The ledger compares each model's archived forecasts with IMD truth. Only pairs verified before the forecast was issued are used (`as_of = valid date − lead`), so there is no look-ahead. Errors are decay-weighted (half-life 20 days) over a 90-day window. Each model needs at least 10 pairs; otherwise the district falls back to regional pooling, and then to equal weights.
2. **Bias correction.** Rain uses a multiplicative ratio clipped to 0.4–2.5. Tmax and wind use an additive correction.
3. **Weights.** wₘ ∝ (MAEₘ + 0.1)⁻², normalised so Σwₘ = 1.
4. **Uncertainty.** σ² = weighted model spread² + Σ wₘ (1.2533 · MAEₘ)². P10/P90 and the probabilities of exceeding 64.5, 115.6 and 204.5 mm come from a normal distribution with that σ.
5. **Alerts.** Yellow, Orange and Red levels follow IMD heavy-rain categories. Each alert records the reasons the blend gave (see `ml/config.yaml → alerts`).

Every constant is in [ml/config.yaml](ml/config.yaml).

## Verification scorecard (real hindcast, lead day 1)

This is a leakage-free Stage A hindcast against IMD 0.25° gridded rain for 2024, covering 29 districts. From `ml/exports/scorecard.json`, the RMSE figures use a 95% block-bootstrap confidence interval (5-day blocks). ETS, POD and FAR use the 64.5 mm heavy-rain threshold.

| System | n | RMSE (mm) | 95% CI | ETS | POD | FAR |
| :--- | ---: | ---: | :---: | ---: | ---: | ---: |
| **AtmosFusion (Stage A)** | 9,976 | **13.9** | 12.0–16.2 | **0.28** | **0.39** | 0.45 |
| Equal-weight mean | 9,976 | 14.4 | 11.6–16.9 | 0.07 | 0.08 | 0.40 |
| ECMWF IFS 0.25° | 9,541 | 15.3 | 12.5–17.8 | 0.15 | 0.18 | 0.48 |
| JMA GSM | 7,917 | 16.5 | 13.3–19.5 | 0.13 | 0.16 | 0.52 |
| CMA GRAPES | 9,976 | 17.0 | 14.1–20.1 | 0.11 | 0.17 | 0.70 |
| NCEP GFS | 7,337 | 17.7 | 14.2–21.1 | 0.19 | 0.25 | 0.51 |

Caveats:
- The RMSE confidence intervals overlap, so the RMSE gain is not yet significant. The heavy-rain gain (ETS 0.28 vs 0.07 for the flat average) is the clearer result.
- The held-out test period (monsoon 2025, frozen in `config.yaml`) will be scored once the archive backfill reaches it.
- Models with fewer pairs (for example, UKMO 10 km) have archives that start later.

The Verification page shows all models and lead days.

---

## User flow

```
Landing (/) ─► Sign up ─► Onboarding (/welcome) ─► Dashboard (/app)
   │                      role · home region ·        ├─ Overview      alerts, wettest districts, run status
   ├─► Log in ──────────  alert threshold · lead ────►├─ Districts     map + table, per-district blend and weights
   └─► Explore the demo (no account) ────────────────►├─ Forecast      region view by lead day
                                                      ├─ Models        weights, skill, and the reasons behind them
                                                      ├─ Alerts        acknowledge, CAP 1.2 export
                                                      ├─ Verification  hindcast scorecard vs IMD
                                                      └─ Settings      profile, preferences, theme, password, delete
```

- **Accounts** are stored in SQLite. Passwords are hashed with PBKDF2-SHA256, and access tokens are HS256 and last 7 days. Login attempts are throttled.
- **The demo** shows the same live data without an account. Its settings and acknowledgements stay in the browser. The backend must be running.

---

## Quickstart (Windows; run from the repository root)

**Prerequisites:** Node.js 20.19+ and Python 3.11.

```bash
python -m venv ml/.venv
ml/.venv/Scripts/python.exe -m pip install -r ml/requirements.lock
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
npm install
```

**1. Produce data.** Do this once, then daily:

```bash
ml/.venv/Scripts/python.exe -m ml.ingest.openmeteo --run   # archive backfill; stops at the daily budget, re-run next day
ml/.venv/Scripts/python.exe -m ml.daily.run_cycle          # live forecasts + IMD update + blend → ml/exports/
```

**2. Serve it:**

```bash
cd backend && .venv/Scripts/python.exe -m uvicorn main:app --port 8000
npm run dev
```

Open http://localhost:5173.

The pipeline details are in [ml/README.md](ml/README.md).

### Configuration

| Variable | Where | Purpose |
| :--- | :--- | :--- |
| `VITE_API_URL` | frontend `.env` | Backend URL (default `http://localhost:8000`) |
| `ATMOSFUSION_EXPORTS` | backend env | Folder with the pipeline's exports (default `ml/exports`) |
| `ATMOSFUSION_SECRET` | backend env | Token signing key. If unset, a key is generated once and stored in the database. **Set this in production.** |
| `ATMOSFUSION_DB` | backend env | SQLite file (default `backend/atmosfusion.db`) |
| `ATMOSFUSION_TOKEN_TTL` | backend env | Session length in seconds (default: 7 days) |
| `ATMOSFUSION_CORS_ORIGINS` | backend env | Comma-separated list of allowed frontend origins |

### Tests

```bash
ml/.venv/Scripts/python.exe -m pytest ml/tests -q
cd backend && .venv/Scripts/python.exe -m pytest -q
npx tsc -b && npx eslint . && npm run build
```

- **ML (25 tests):** daily aggregation and IMD day alignment, the rate-limit budget, and ledger leakage (no truth after the issue time). They also check that weights sum to 1 and that fallback and alert rules work.
- **Backend (14 tests):** the full account flow and the data endpoints, including the 503 response before the pipeline has run.

---

## API

| Method | Path | Auth | Purpose |
| :--- | :--- | :---: | :--- |
| GET | `/api/v1/health` | | Service status and the latest cycle |
| GET | `/api/v1/cycles` | | Available forecast cycles |
| GET | `/api/v1/cycle?issue=YYYYMMDDTHH` | | A forecast cycle (latest if `issue` is omitted): sources, points, blends, weights, probabilities, alerts |
| GET | `/api/v1/scorecard` | | Hindcast verification rows |
| POST | `/api/v1/auth/signup`, `/api/v1/auth/login` | | Create an account or log in → `{ token, user }` |
| GET | `/api/v1/auth/me` | ✓ | Current user |
| PATCH | `/api/v1/users/me` | ✓ | Update profile and preferences |
| POST | `/api/v1/users/me/password`, `/api/v1/users/me/delete` | ✓ | Change password or delete the account |
| GET · PUT · DELETE | `/api/v1/alerts/acks[/{id}]` | ✓ | List, acknowledge or reopen alerts |

The data endpoints return **503** with instructions until `ml.daily.run_cycle` has produced an export.

## Exports (in the app)

- **Districts (CSV / GeoJSON).** Blend, P10/P90, equal-weight mean, spread, exceedance probabilities, alert level, and each model's forecast and weight.
- **Alerts (CAP 1.2 XML / JSON).** Marked `status: Exercise`: this is a prototype, not an official IMD warning.

## Project structure

```
ml/
  config.yaml            districts, sources, periods, rate limits, blend + alert constants
  ingest/                Open-Meteo archive, IMD final + real-time grids, ERA5, static
  live/                  run times, live fetch, Stage A ledger/blend, scorecard
  daily/run_cycle.py     one command: fetch → blend → export JSON
  tests/
backend/
  main.py                serves ml/exports (cycles, scorecard) + accounts routes
  auth.py, accounts.py   SQLite accounts, hashing, tokens, preferences, alert acks
src/
  data/                  cycle hooks, regions, alerts, URL view state
  pages/public, pages/app, components/, lib/ (API client, IMD categories, exports, theme)
```

## License
MIT. Developed for NCMRWF, Ministry of Earth Sciences.

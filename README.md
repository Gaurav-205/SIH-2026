# AtmosFusion — Hybrid AI–NWP Multi-Model Forecast Blending

> **SIH26081 · NCMRWF, Ministry of Earth Sciences**
> Blends physics, AI and ensemble forecasts for 29 districts in Konkan & Goa and Kerala. Each model is weighted by how well it has recently verified against IMD observations at that place and lead time.

Every number in the app and in this README comes from code run on real data: live APIs and published datasets. Nothing is hardcoded or simulated. Full documentation is in **[docs/](docs/README.md)**.

---

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

- **Stage A:** a bias-corrected, inverse-error blend with no fitted parameters. It uses each model's
  decayed recent error at the district and lead, computed only from forecasts verified before the
  forecast was issued. **This is what the website serves today.**
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

**The held-out test (June–September 2025) has not been scored yet.** The model is frozen
(`ml/artifacts/stage_b/`), and the test runs once the archive backfill reaches 2025. Stage A stays
live until then ([decision 0008](docs/decisions/0008-stage-a-live-until-test.md)).

---

## User flow

```
Landing (/) ─► Sign up ─► Onboarding (/welcome) ─► Dashboard (/app)
   │                      role · home region ·        ├─ Overview      alerts, wettest districts, run status
   ├─► Log in ──────────  alert threshold · lead ────►├─ Districts     map + table, per-district blend and weights
   └─► Explore the demo (no account) ────────────────►├─ Forecast      region view by lead day
                                                      ├─ Models        weights, skill, and the reasons behind them
                                                      ├─ Alerts        acknowledge, CAP 1.2 export
                                                      ├─ Verification  live scorecard + model development (E0–E10)
                                                      └─ Settings      profile, preferences, theme, password, delete
```

## Quickstart (Windows; run from the repository root)

**Prerequisites:** Node.js 20.19+ and Python 3.11.

```bash
python -m venv ml/.venv && ml/.venv/Scripts/python.exe -m pip install -r ml/requirements.lock
python -m venv backend/.venv && backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
npm install
```

**Produce data** (see [docs/pipeline.md](docs/pipeline.md) for every step):

```bash
ml/.venv/Scripts/python.exe -m ml.ingest.openmeteo --run      # archive backfill (stops at the free-tier budget; re-run daily)
ml/.venv/Scripts/python.exe -m ml.ingest.zarr_archive --run   # AIFS + GEFS from cloud Zarr
ml/.venv/Scripts/python.exe -m ml.daily.run_cycle             # live forecasts + IMD update + blend → ml/exports/
```

**Serve it:**

```bash
cd backend && .venv/Scripts/python.exe -m uvicorn main:app --port 8000
npm run dev
```

Then open http://localhost:5173.

**Checks (same as CI):**

```bash
npm run lint && npm run typecheck && npm run build
ml/.venv/Scripts/ruff.exe check ml backend && ml/.venv/Scripts/python.exe -m pytest ml/tests -q
cd backend && .venv/Scripts/python.exe -m pytest -q
```

## Documentation

[Architecture](docs/architecture.md) · [Data sources](docs/data-sources.md) · [Methodology](docs/methodology.md) · [Pipeline](docs/pipeline.md) · [Verification](docs/verification.md) · [API](docs/api.md) · [Frontend](docs/frontend.md) · [Operations](docs/operations.md) · [Development](docs/development.md) · [Decisions](docs/decisions/README.md) · [Glossary](docs/glossary.md) · [Changelog](docs/changelog.md)

## License
MIT. Developed for NCMRWF, Ministry of Earth Sciences. Data: Open-Meteo (CC BY 4.0), ECMWF and NOAA via dynamical.org (CC BY 4.0), India Meteorological Department, Copernicus DEM, and Natural Earth.

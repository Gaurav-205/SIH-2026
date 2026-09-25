# AtmosFusion ML pipeline

Learns, per place, how much to trust each physics, ensemble and AI forecast, and serves the blend to the website.
Plan and milestones: the "AtmosFusion ML Plan" document (M1–M11). Configuration: [config.yaml](config.yaml).

**Full documentation is in [`docs/`](../docs/README.md)**: [pipeline commands](../docs/pipeline.md),
[methodology](../docs/methodology.md), [data sources](../docs/data-sources.md), [verification](../docs/verification.md).

## Setup (Windows, Python 3.11)

```bash
python -m venv ml/.venv
ml/.venv/Scripts/python.exe -m pip install -r ml/requirements.lock
```

All commands run from the repository root.

## M1 — ingestion (district centroids, Konkan-Goa and Kerala)

```bash
ml/.venv/Scripts/python.exe -m ml.ingest.openmeteo --plan     # requests, weighted calls, days needed
ml/.venv/Scripts/python.exe -m ml.ingest.openmeteo --run      # forecasts; stops at the daily budget, re-run next day
ml/.venv/Scripts/python.exe -m ml.ingest.imd                  # IMD 0.25° rain + 1° Tmax truth (2024–2025), mirrored locally
ml/.venv/Scripts/python.exe -m ml.ingest.era5                 # ERA5 truth (shares the Open-Meteo budget: run after the backfill)
ml/.venv/Scripts/python.exe -m ml.ingest.static               # elevation per point
ml/.venv/Scripts/python.exe -m ml.evaluate.m1_report          # ml/reports/m1_report.md + m1_coverage.csv
ml/.venv/Scripts/python.exe -m pytest ml/tests -q
```

Every step is idempotent: finished chunks are skipped, HTTP responses are cached in `ml/cache/`, and
`ml/cache/openmeteo_budget.json` keeps the free-tier limits (600/min, 5,000/h, 10,000/day, with margin)
across restarts. Don't run two Open-Meteo steps at the same time; they share that budget log.

## Daily cycle (live website data)

```bash
ml/.venv/Scripts/python.exe -m ml.daily.run_cycle                  # latest run + IMD real-time update + Stage A + scorecard
ml/.venv/Scripts/python.exe -m ml.daily.run_cycle --no-truth       # skip the IMD real-time download
ml/.venv/Scripts/python.exe -m ml.daily.run_cycle --scorecard-only # rebuild ml/exports/scorecard.json only
```

What it does:
- Finds the newest run common to all live models, using Open-Meteo `static/meta.json`.
- Fetches days 1–5 for all 29 districts and stores them in `ml/data/live/forecasts_<init>.parquet`, so re-runs of the same run are free.
- Updates the IMD real-time grids (`ml/data/truth/imd_realtime_*.parquet`).
- Blends with a skill ledger built only from pairs verified before issue time.
- Writes `ml/exports/cycle_<init>.json`, `latest.json` and `scorecard.json`. The backend serves them.

Until the archive backfill covers the last 90 days, recent skill pairs are missing, so districts fall back to equal weights. The export records this (`method: "equal"`), and the Models page shows it.

## Data layout

```
ml/data/forecasts/source=<model>/chunkNNN.parquet   point_id, date, source, lead, var, value
ml/data/truth/imd_rain.parquet, imd_tmax.parquet    point_id, date, var, value, cell_lat, cell_lon
ml/data/truth/era5/<start>_<end>.parquet            point_id, date, var, value
ml/data/static/points.parquet                       point_id, region, lat, lon, elevation_m
```

Units: rain mm/day, Tmax °C, wind m/s (daily mean). Rain days end 03 UTC (IMD's 08:30 IST); Tmax and
wind use the IST calendar day. See `ingest/daily.py` and its tests.

## Data licences

Open-Meteo data (including the Previous Runs and Historical Weather APIs) is CC BY 4.0, free tier
non-commercial. IMD gridded data: India Meteorological Department, Pune. Attribute both on the website.

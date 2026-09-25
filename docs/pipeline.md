# ML pipeline

Every command runs from the repository root with the project interpreter,
`ml/.venv/Scripts/python.exe` on Windows or `ml/.venv/bin/python` elsewhere, shortened to `python`
below. Settings live in [`ml/config.yaml`](../ml/config.yaml).

## Stages

| # | Step | Command | Output | Notes |
| :-: | :--- | :--- | :--- | :--- |
| 1 | Open-Meteo archive | `python -m ml.ingest.openmeteo --plan` then `--run` | `ml/data/forecasts/source=*/chunkNNN.parquet` | stops at the daily budget; re-run the next day |
| 2 | Cloud Zarr archives | `python -m ml.ingest.zarr_archive --plan` then `--run [--source gefs_ens]` | `.../source=*/zarr_YYYYMM.parquet` | ~35 min for AIFS + GEFS; IFS ENS is disabled until approved |
| 3 | IMD truth | `python -m ml.ingest.imd` and `python -m ml.ingest.imd_realtime` | `ml/data/truth/imd_*.parquet` | yearly files mirrored in `ml/cache/imd` |
| 4 | IMD climatology + core zone | `python -m ml.ingest.climatology` | `ml/data/static/climatology_*.parquet`, `core_zone_*.parquet` | 30 years; resumable one year at a time |
| 5 | Terrain | `python -m ml.ingest.terrain` | `ml/data/static/terrain.parquet` | DEM tiles cached in `ml/cache/terrain` |
| 6 | Regimes | `python -m ml.features.regimes` | `ml/data/static/regimes.parquet` | needs step 4 |
| 7 | Feature table | `python -m ml.features.build_table` | `ml/data/features/rain_table.parquet` | ~30 s |
| 8 | Validation E0–E10 | `python -m ml.evaluate.validation` | `ml/reports/validation.{json,md}`, `ml/reports/figures/` | ~20–30 min |
| 9 | Freeze Stage B | `python -m ml.models.train` | `ml/artifacts/stage_b/<id>/` | needs step 8 |
| 10 | Frozen test (once) | `python -m ml.evaluate.test_scorecard` | `ml/reports/test_scorecard.json` | refuses until the 2025 monsoon is downloaded |
| 11 | Daily cycle | `python -m ml.daily.run_cycle` | `ml/exports/*.json` | what the website shows |
| 12 | M1 report | `python -m ml.evaluate.m1_report` | `ml/reports/m1_report.md` | coverage, alignment, data quality |

## Data layout

```
ml/data/forecasts/source=<id>/chunkNNN.parquet   Open-Meteo: point_id, date, source, lead, var, value
ml/data/forecasts/source=<id>/zarr_YYYYMM.parquet  Zarr: same columns (+ sd, p10, p50, p90, p_ge_*, n_members for ensembles)
ml/data/truth/imd_{rain,tmax}.parquet             point_id, date, var, value, cell_lat, cell_lon
ml/data/truth/imd_realtime_{rain,tmax}.parquet    same + kind
ml/data/static/terrain.parquet                    per-point terrain features and class
ml/data/static/climatology_{rain,tmax}.parquet    per-point day-of-year statistics, IMD 1991-2020
ml/data/static/core_zone_{rain,clim}.parquet, regimes.parquet
ml/data/features/rain_table.parquet               Stage B training table (one row per point x date x lead x source)
ml/data/live/forecasts_<init>.parquet             stored live runs (re-runs of the same run are free)
ml/artifacts/stage_b/<id>/                        frozen models (model.txt, calibrators.json, metadata.json)
ml/exports/                                       cycle_<init>.json, latest.json, scorecard.json (served by the backend)
ml/reports/                                       reports and figures (commit these)
```

Units: rain in mm/day, Tmax in °C, wind in m/s. Dates are IMD rain days (see [methodology](methodology.md)).

## Idempotency and failure handling

- **Open-Meteo:** finished chunks are skipped. The newest, partial chunk is extended from its last
  stored day (re-fetching 2 days in case the archive was still filling). An answer where every value is
  missing is an error (wrong model slug or dates), never silently stored.
- **Implausible values** (outside physical bounds, e.g. −48 °C Tmax from CMA in April 2024) are masked
  to NaN and logged to `ml/data/quality/` for the M1 report.
- **Zarr:** one file per month. A finished month is never re-read; the current month is `_partial` and
  replaced on the next run.
- **IMD:** if imdpune.gov.in is offline, the climatology step logs the missing years and continues;
  re-running fills them in.

## Adding a source

1. **Open-Meteo model:** add it to `sources:` with `first_date` (check the archive) and `meta` (its
   metadata domain). The backfill plans it automatically.
2. **Zarr dataset:** add it to `zarr_sources:` and to `sources:` with `provider: zarr`.
3. **Anything else (e.g. NCUM from NCMRWF):** write a loader that outputs the forecast Parquet schema
   above, into `ml/data/forecasts/source=<id>/`. Every later step picks it up unchanged.

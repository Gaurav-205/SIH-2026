# Operations runbook

## Daily routine

Run once a day, in this order:

```bash
ml/.venv/Scripts/python.exe -m ml.ingest.openmeteo --run      # archive backfill / newest days (stops at budget)
ml/.venv/Scripts/python.exe -m ml.ingest.zarr_archive --run   # new AIFS/GEFS runs (no quota)
ml/.venv/Scripts/python.exe -m ml.daily.run_cycle             # live runs + IMD real-time + blend + export
```

Then keep the backend running:

```bash
cd backend && .venv/Scripts/python.exe -m uvicorn main:app --port 8000
```

### Scheduling on Windows

Use Task Scheduler with a daily trigger (for example 10:30 IST, after the 00 UTC runs are published)
and the action:

```
Program:   C:\path\to\Project\ml\.venv\Scripts\python.exe
Arguments: -m ml.daily.run_cycle
Start in:  C:\path\to\Project
```

On Linux, use cron: `30 5 * * * cd /srv/atmosfusion && ml/.venv/bin/python -m ml.daily.run_cycle >> ml/cache/cycle.log 2>&1`

## Budgets

| Resource | Limit | Where to see it |
| :--- | :--- | :--- |
| Open-Meteo weighted calls | 9,900/day (backfill capped at 8,500), 4,500/h, 500/min | `ml/cache/openmeteo_budget.json`, and `--plan` for pending work |
| Disk | forecasts < 100 MB; IMD mirror ~850 MB; DEM tiles ~200 MB | `ml/data`, `ml/cache` |

## Troubleshooting

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| Website says "No forecast cycle yet" (503) | nothing exported | run `ml.daily.run_cycle` |
| Website says the server can't be reached | backend not running, or the wrong `VITE_API_URL` | start uvicorn; check `.env.local` |
| Backfill log: `daily budget used … stopping` | the free-tier budget is used up for the rolling 24 h | nothing to fix; re-run tomorrow |
| Backfill error: `every value is missing` | a wrong model slug, or dates outside the model's archive | check `first_date` / `last_date` in config against the Open-Meteo docs |
| Many districts show `equal weights` | fewer than 10 verified days in the last 90 for those models | let the backfill reach recent months; it is expected for new models |
| IMD download fails | imdpune.gov.in offline | retry later; mirrored years are never re-downloaded |
| `test_scorecard` refuses to run | not frozen, config changed, test season not downloaded, or already scored | follow the message; a re-score needs `--rescore "<reason>"` and is logged |

## Backups

`ml/cache/imd` (the IMD mirror) and `ml/data/forecasts` are the expensive parts to rebuild; the IMD mirror
also protects against the IMD server being offline. `ml/artifacts` holds the frozen models, and
`backend/atmosfusion.db` holds user accounts. Back these up; everything else can be regenerated.

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

On Linux, use cron: `30 5 * * * cd /srv/bharosa && ml/.venv/bin/python -m ml.daily.run_cycle >> ml/cache/cycle.log 2>&1`

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
`backend/bharosa.db` holds user accounts. Back these up; everything else can be regenerated.


## Publication monitoring and administrator access

`GET /api/v1/health` reports publication status, not merely file existence. Both the forecast issue
and publication must be no more than 24 hours old. Invalid timestamps, empty records, missing
exports and malformed JSON are explicit states. Republishing an old issue does not make it fresh.
The pipeline writes each JSON export atomically using a temporary file and replacement; this
protects individual files, not a transaction spanning every export.

The separate `/admin` page uses `GET /api/v1/admin/overview`. Set `BHAROSA_ADMIN_USER_IDS` on the
**backend process** to a comma-separated list of verified account IDs. Resolve IDs in the backend
account database; do not infer them from a display name or professional role. An unset/empty list
grants no administrator access. Profile updates cannot assign this privilege. Removing an ID
revokes API access on the next request. Never place this setting in a `VITE_` environment variable.

This dashboard provides read-only publication freshness, contributing-source counts, export
presence and aggregate account/acknowledgement counts. It does not run jobs or expose credentials.
Source participation means values occur in the published records; it is not a current provider
health probe. Persisted job logs, audited retries and configuration changes remain future work.

Environmental context has independent provider failure states and a bounded process-local cache
(5 minutes for available products, 1 minute after partial failures). Multiple API workers need a
shared cache/rate budget before scaling. Air quality and marine/surface products are modelled,
not local station observations. Check provider terms and production access before deployment.

Run the API with a persistent database/storage volume and backups. Static frontend hosting alone
does not provide the API or durable account storage; see the Vercel section below.


## Production deployment (Vercel)

One Vercel project serves both parts: the Vite build as static files, and the FastAPI backend as a
Python function (`api/index.py`, dependencies in the root `requirements.txt`). `vercel.json` rewrites
`/api/*` to the function and every other path to the single-page app, and sets security headers
(CSP, HSTS, frame denial). `.vercelignore` uploads only what the build and function need, plus
`ml/exports/*.json`, which are bundled into the function as read-only files.

| Setting | Where | Notes |
| :--- | :--- | :--- |
| `BHAROSA_SECRET` | Vercel env (Production, Preview), sensitive | Token signing key |
| `BHAROSA_DATABASE_URL` | Vercel env (Production, Preview), sensitive | Supabase transaction pooler URL (port 6543). Without it, account endpoints return 503 because the function filesystem is read-only; forecasts still work |
| `POSTGRES_URL` | Set by the Vercel Supabase integration | Used when `BHAROSA_DATABASE_URL` is unset. The schema enables row level security with no policies, so Supabase's public API cannot read account tables |
| `BHAROSA_ADMIN_USER_IDS` | Vercel env | Optional admin allowlist |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | GitHub repository secrets | Used by `.github/workflows/deploy.yml` |

**Fresh data.** The function cannot run the pipeline, so `.github/workflows/deploy.yml` does it every
day at 11:00 IST, after CI passes on `main`, or by hand:

1. `python -m ml.ingest.imd_realtime --start <120 days ago>`: IMD real-time rain/Tmax truth.
2. `python -m ml.ingest.openmeteo --run --since today-100`: archived forecasts for the chunks covering
   the blend's 90-day window (first run ~4,600 weighted calls; then only new days).
3. `python -m ml.ingest.era5`: ERA5 wind truth from the Open-Meteo archive (first run ~2,200 calls).
4. `python -m ml.daily.run_cycle --no-truth` (truth was step 1) and `python -m ml.evaluate.report`.
5. `vercel deploy --prod` with the new exports.

`ml/data` and `ml/cache` persist between runs through `actions/cache`. Steps 1–3 may fail without
blocking the deploy (the blend falls back to equal weights where history is missing); if step 4
fails, nothing is deployed and the previous publication keeps serving, marked stale after 24 hours.
`vercel.json` disables Git-triggered deployments of `main`, because a Git build has no exports and
would replace live data with 503s. Pull-request previews still build (with empty-data states).

**Limitation.** The 2024–2025 research archive, IMD final grids and terrain data (about 1 GB) are only
needed for training and validation, not for the live blend.

**Manual deploy:** `npx vercel deploy --prod` from a checkout that has `ml/exports/` populated.

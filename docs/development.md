# Development guide

## Setup (Windows; use `bin/` instead of `Scripts/` elsewhere)

```bash
python -m venv ml/.venv && ml/.venv/Scripts/python.exe -m pip install -r ml/requirements.lock
python -m venv backend/.venv && backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
npm install
```

Node 20.19+ or 22.13+ and Python 3.11 are required.

## Checks (the same ones CI runs)

```bash
npm run lint && npm run typecheck && npm run build
ml/.venv/Scripts/ruff.exe check ml backend
ml/.venv/Scripts/python.exe -m pytest ml/tests -q
cd backend && .venv/Scripts/python.exe -m pytest -q
```

CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) runs them on every push and pull request.
Tests use synthetic data and never download anything.

## What the tests guarantee

| Area | Tests |
| :--- | :--- |
| Day conventions | the 03–03 UTC rain window, IST days for Tmax/wind, missing hours → missing day, label offset |
| Data quality | duplicates and infinities rejected; implausible values masked and logged |
| Rate limits | call weights match Open-Meteo's rule; the budget waits per minute and stops per day; partial chunks resume |
| Leakage | the ledger ignores truth after the issue date; the vectorised training ledger equals the live ledger; regime labels are causal |
| Blend | weights sum to 1, ordering, fallback to region and equal weights, alert rules, exported weights sum to 1 |
| Scores | ETS/POD/FAR/CSI/SEDI on a hand example; Brier decomposition; CRPS vs numerical integral; bootstrap; economic value bounds |
| Test protocol | the test season cannot be scored twice without a recorded reason |
| Backend | the full account flow; data endpoints, including the 503 before the first export |

## Conventions

- **Python:** ruff (E, F, I, B, UP), line length 140, type hints, pure functions on DataFrames where
  possible. Settings go in `ml/config.yaml`, never as constants in code.
- **TypeScript:** strict mode, ESLint. Components are small; data comes from hooks in `src/data`.
- **Never commit** data, caches or secrets (`ml/data`, `ml/cache`, `ml/exports`, `*.db`, `.env`). Do
  commit reports (`ml/reports`) and frozen artifacts metadata.
- **Commits:** small and focused, with messages in the imperative mood (e.g. `feat: add GEFS spread feature`).

## Adding a feature to Stage B

1. Compute it in `ml/features/build_table.py`. It must be known at issue time (V − L); if it is an
   observation, take it as of the issue date.
2. Add it to a group in `FEATURE_GROUPS`, so ablations can drop it.
3. Add a test if it could leak. Re-run validation, and keep the feature only if the out-of-fold score
   improves.

## Dependencies

`ml/requirements.txt` lists the direct dependencies; `ml/requirements.lock` pins the exact versions
used for the reported results (`pip freeze`). Update both together.

# Backend API

FastAPI app in [`backend/`](../backend/). Interactive docs are at `http://localhost:8000/docs` while it runs.

## Data endpoints (no auth)

| Method | Path | Returns |
| :--- | :--- | :--- |
| GET | `/api/v1/health` | service status and the latest cycle's run time |
| GET | `/api/v1/cycles` | `{ issues: ["YYYYMMDDTHH", ...] }`, newest first |
| GET | `/api/v1/cycle?issue=YYYYMMDDTHH` | one forecast cycle (latest if `issue` is omitted); `issue` must match `^\d{8}T\d{2}$` |
| GET | `/api/v1/scorecard` | the verification scorecard |
| GET | `/api/v1/validation` | out-of-fold validation of every method and ablation (from `python -m ml.evaluate.validation`) |

Until the pipeline has written an export, the data endpoints return **503**, with a message naming the
command that produces it. The website shows that state rather than placeholder data. The
exports folder is `ml/exports`, or the path in `ATMOSFUSION_EXPORTS`.

### Cycle contract

The TypeScript types in [`src/data/cycle.ts`](../src/data/cycle.ts) mirror the JSON exactly. Main fields:

```text
Cycle
  version, generated_at
  issue        { init_utc, lead_dates: { "1": "YYYY-MM-DD", ... } }
  method       { name, half_life_days, window_days, min_pairs }
  truth        { rain, tmax, wind, latest_rain_truth_date, ledger_as_of }
  sources[]    { id, label, family: physics|ai|ensemble, live, run_init_utc }
  regions[], points[] { id, name, region, lat, lon, elevation_m }
  thresholds_mm [64.5, 115.6, 204.5]
  forecasts[]  ForecastRec: point_id, lead, date, var, blend, p10, p90, sigma, equal_mean, spread_sd,
               method, weights{src}, values{src}, corrected{src}, skill{src: {mae, bias, n, scope}},
               prob{"64.5","115.6","204.5"} (rain), alert_level (rain), reasons{src: [{effect, text}]}
  attribution  data credits shown in the app
```

Weights are rounded to 4 decimals so they still sum to 1 (within 0.001); other numbers are rounded to 2.

## Account endpoints

| Method | Path | Auth | Purpose |
| :--- | :--- | :-: | :--- |
| POST | `/api/v1/auth/signup` | | create an account → `{ token, user }` |
| POST | `/api/v1/auth/login` | | log in → `{ token, user }`; throttled after repeated failures |
| GET | `/api/v1/auth/me` | ✓ | current user |
| PATCH | `/api/v1/users/me` | ✓ | name, role, home region, default lead day, alert threshold, theme, onboarded |
| POST | `/api/v1/users/me/password` | ✓ | change password (current password required) |
| POST | `/api/v1/users/me/delete` | ✓ | delete account (password required) |
| GET | `/api/v1/alerts/acks` | ✓ | acknowledged alert ids |
| PUT / DELETE | `/api/v1/alerts/acks/{id}` | ✓ | acknowledge / reopen an alert |

Authenticated calls send `Authorization: Bearer <token>`.

**Security:**
- Passwords are hashed with PBKDF2-SHA256 and a per-user salt.
- Tokens are HS256, signed with `ATMOSFUSION_SECRET` (a random key is generated and stored if unset).
  They last 7 days by default (`ATMOSFUSION_TOKEN_TTL`).
- A wrong password and an unknown email give the same error.
- CORS origins come from `ATMOSFUSION_CORS_ORIGINS`.

## Errors

Every error body is `{ "detail": ... }`. The frontend client ([`src/lib/api.ts`](../src/lib/api.ts))
turns it into `ApiError(status, message)`, and status 0 means the server could not be reached.

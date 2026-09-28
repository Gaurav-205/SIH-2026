# Redesign implementation and verification

Delivered locally on 28 September 2026. Read the [product review](PRODUCT_REVIEW.md) for the full-system audit, concept, journeys, architecture and phased roadmap prepared before implementation.

## Delivered

- District-first rainfall briefing with dated five-day outlook, forecast range, issue/publication freshness, contributing-source evidence and clear next steps.
- Coastal teal/ink design tokens, semantic severity colours, reorganized core/evidence navigation, mobile bottom navigation and an accessible native navigation dialog.
- Optional lazy CSS 3D rainfall columns driven by the actual selected forecast. Rotation and day selection use HTML controls; mobile and reduced-motion users receive flat columns and the same exact values. This is a forecast comparison, not a terrain or flood simulation.
- Region-aware district selection and alerts; maps refit when changing region. Removed Maharashtra-only quick-focus controls. Forecast history has an explicit archived-state banner and return-to-latest action.
- Runtime forecast contract validation and truthful empty/error/stale states. Corrected rainfall category thresholds, configured-versus-contributing model labels, provisional uncertainty wording and unsupported sensor/surge/cloudburst claims.
- Environmental context separated into a frontend feature and backend service: explicit point identity, modelled provenance, units, valid/fetch times, independent provider failures, bounded parallel requests and bounded cache. Unknown locations do not fall back to Pune. All-null products are unavailable; valid zero measurements remain zero.
- Separate administrator page and read-only operations API. Backend allowlist authorization is independent of self-selected professional roles. Publication freshness, source participation, exports and aggregate account counts are available; nonexistent controls/logs are not presented as working.
- Guest initialization and onboarding guards repaired. Existing account and acknowledgement flows retained. Individual forecast files publish atomically.
- Forecast domain tests and browser regression scripts added; frontend unit tests included in CI. Existing exploratory Python scripts received lint-only cleanup; they were not run to select models or change scientific results.

## Validation evidence

| Check | Result |
|---|---|
| TypeScript project build | Passed |
| ESLint | Passed |
| Production Vite build | Passed |
| Ruff on backend and ML | Passed |
| Python backend and ML suite | 65 passed; one installed Starlette/httpx deprecation warning |
| Frontend domain/contract tests | 4 passed |
| Isolated populated UI browser suite | Passed at 320, 390, 768 and 1440 px; no page-level overflow or uncaught application errors |
| Interaction checks | District/day selection, spatial view, flat fallback, region map refit, history, reduced motion, dialog/Escape, secondary pages and admin layout passed |
| Real API account browser suite | Signup, onboarding guard, saved region/profile, dark mode, password change, sign out/login and test-account deletion passed |
| Real missing-export state | Rendered without forecast fabrication or guest crash |

Tests ran locally on Windows, Node and Python 3.14, with Microsoft Edge via Playwright. CI targets Node 22/Python 3.11 and has been updated but was not run remotely. Browser assertions are smoke/regression coverage, not a comprehensive accessibility certification or physical-device performance study.

Production bundle evidence: entry JavaScript about 384 KB raw / 122 KB gzip; separately loaded map about 157 KB / 47 KB gzip, chart bundle about 352 KB / 102 KB gzip, optional spatial component about 1.9 KB / 0.83 KB gzip. These are emitted chunk sizes, not measured Core Web Vitals. Runtime font subsets and route dependencies affect total transferred bytes.

### Reproduce

```sh
npm run typecheck
npm run lint
npm test
npm run build
python -m pytest backend/tests ml/tests -q
ruff check backend ml
```

On this workstation the npm shim was broken; the equivalent `node D:/Nodejs/node_modules/npm/bin/npm-cli.js <command>` or direct local binaries were used.

For browser checks, run the Vite frontend and API locally, supply Playwright through `PLAYWRIGHT_MODULE` (or an installed `playwright` package), then run `node tests/browser.cjs`. Optional `BHAROSA_BASE_URL` and `BROWSER_CHANNEL` override localhost:5173 and msedge. Forecast and administrator fixtures are intercepted only within this isolated browser context; they never become app exports. Screenshots carry synthetic-test watermarks.

`tests/browser-accounts.cjs` exercises the real API. Start that API with `BHAROSA_DB` pointing to a disposable test database, set `BHAROSA_TEST_ACCOUNTS=1`, then run the script. It creates and deletes its own test account. Never run it against a production account database.

### Visual evidence

- [Desktop briefing](screenshots/after-briefing-desktop.png)
- [Mobile briefing](screenshots/after-briefing-mobile.png)
- [Desktop administrator view](screenshots/after-admin-desktop.png)
- [Mobile administrator view](screenshots/after-admin-mobile.png)

All populated screenshots use explicitly synthetic test data. The architecture [graph](graph/graph.html) is a preimplementation audit snapshot, not a regenerated index of these edits. Its benchmark estimates retrieval-context size; it does not measure model token billing or task accuracy.

## Remaining gates

The repository has no local live forecast exports or scientific archive. Live ingest, provider availability, historical model accuracy and the frozen 2025 test result were not reproduced. Stage A remains the serving method; Stage B was not retrained, retuned or promoted. The audit documents the frozen-configuration/provenance questions that must be resolved before scientific promotion.

Official IMD observations/warnings and INCOIS feeds still need validated access, licensing, station/grid mapping and ingestion contracts. Existing modelled context is not a substitute for an official warning. Provider links and data labels are present; additional official feeds are not represented as integrated.

The admin experience is read-only. Persisted pipeline job events, safe retries, audited source/configuration management and multi-worker cache coordination require additional operational infrastructure. Full gridded terrain/3D weather needs appropriate data and a device-performance evaluation; the delivered spatial outlook works without that dependency.

No deployment, commit, push, production database change or administrator grant was performed. Production readiness still requires durable API/database/storage, provider terms, backups/restore, secret management, authentication hardening and device/accessibility/performance verification. Pre-existing changes to the lockfile and deployment configuration were preserved.

## Source for corrected display thresholds

Daily rainfall category labels follow the [IMD Heavy Rainfall Warning Services brochure](https://mausam.imd.gov.in/imd_latest/contents/pdf/pubbrochures/Heavy%20Rainfall%20Warning%20Services.pdf). This is a display correction; it does not retune the forecast model or imply official warning authority.

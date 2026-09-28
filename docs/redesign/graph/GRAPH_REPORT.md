# Baseline architecture graph (2026-09-28)

This snapshot predates the redesign implementation. It supports the audit; it is not a live index of the edited code. Open [the interactive graph](graph.html) for navigation.

## Corpus Check
- 130 files · ~212,991 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 868 nodes · 1587 edges · 62 communities (49 shown, 13 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 190 edges (avg confidence: 0.8)
- Token cost: unavailable; the extraction tools did not expose usage.

## Community Hubs (Navigation)
- Ingest relationships
- Ingest relationships
- Ingest relationships
- Auth relationships
- Evaluate relationships
- Live relationships
- Components relationships
- Lib relationships
- App relationships
- Ml relationships
- Backend relationships
- App relationships
- Data relationships
- Evaluate relationships
- Backend relationships
- Models relationships
- Decisions relationships
- Tests relationships
- Application relationships
- Ingest relationships
- Docs relationships
- Backend relationships
- Models relationships
- Components relationships
- Lib relationships
- Docs relationships
- Tests relationships
- Docs relationships
- Models relationships
- Docs relationships
- Components relationships
- Evaluate relationships
- Evaluate relationships
- Evaluate relationships
- Figures relationships
- Figures relationships
- Figures relationships
- Figures relationships
- Figures relationships
- Figures relationships
- Figures relationships
- Figures relationships
- Public relationships
- Evaluate relationships
- Evaluate relationships
- Evaluate relationships
- Ingest relationships
- Live relationships
- Application relationships
- Ingest relationships
- Backend relationships
- Backend relationships

## God Nodes (most connected - your core abstractions)
1. `config()` - 49 edges
2. `path()` - 42 edges
3. `useSession` - 34 edges
4. `cx()` - 24 edges
5. `Bharosa — Hybrid AI–NWP Multi-Model Forecast Blending` - 20 edges
6. `docs/methodology.md` - 20 edges
7. `useCycle()` - 15 edges
8. `useView()` - 15 edges
9. `build_cycle()` - 14 edges
10. `main()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Frontend` --references--> ``src/data/cycle.ts``  [EXTRACTED]
  README.md → docs/api.md
- `out_path()` --calls--> `path()`  [INFERRED]
  ml/ingest/openmeteo.py → ml/common.py
- `test_resolve_date()` --calls--> `resolve_date()`  [INFERRED]
  ml/tests/test_ingest.py → ml/common.py
- `docs/data-sources.md` --references--> ``ml/config.yaml``  [EXTRACTED]
  README.md → docs/data-sources.md
- `docs/data-sources.md` --references--> `imdlib`  [EXTRACTED]
  README.md → docs/data-sources.md

## Communities (62 total, 13 thin omitted)

### Community 0 - "Ingest relationships"
Cohesion: 0.05
Nodes (60): Budget, call_weight(), DailyLimitReached, Weighted call accounting for the Open-Meteo free tier.  Open-Meteo counts a re, Block until `weight` fits in every window, then record it., Sleep until enough old events leave the window., aggregate(), local_day() (+52 more)

### Community 1 - "Ingest relationships"
Cohesion: 0.05
Nodes (65): build(), _log(), main(), Training table for Stage B: one row per point x valid date x lead x source (rain, Feature table. `exclude_families` drops whole source families before any feature, source_codes(), stage_a_correct(), _causal() (+57 more)

### Community 2 - "Ingest relationships"
Cohesion: 0.05
Nodes (62): alignment(), coverage(), duplicate_cells(), load_forecasts(), load_truth(), main(), md_table(), quality_log() (+54 more)

### Community 3 - "Auth relationships"
Cohesion: 0.05
Nodes (46): Banners(), UserMenu(), AppearanceForm(), DangerZone(), PasswordForm(), PreferencesForm(), ProfileForm(), Settings() (+38 more)

### Community 4 - "Evaluate relationships"
Cohesion: 0.06
Nodes (36): check_guard(), coverage(), main(), NotReady, Frozen test scorecard: the 2025 monsoon (config periods.test), scored once (plan, Refuse a second look at the test set unless a reason is given (and recorded)., E2 fitted once on the whole training period, per point and lead, applied to the, record_run() (+28 more)

### Community 5 - "Live relationships"
Cohesion: 0.08
Nodes (42): build_cycle(), export_dir(), issue_time(), main(), Daily cycle: refresh IMD real-time truth, fetch live forecasts, update the skill, The run cycle most live sources share (e.g. 06 UTC today); falls back to 00 UTC, _round(), build() (+34 more)

### Community 6 - "Components relationships"
Cohesion: 0.09
Nodes (28): AlertItem(), BAR, timeFmt, TONE, Badge(), Button, ButtonProps, Field() (+20 more)

### Community 7 - "Lib relationships"
Cohesion: 0.12
Nodes (22): Alerts(), Filter, PageHeader(), AppAlert, buildAlerts(), issueId(), LEVEL_RANK, THRESHOLD_LEVEL (+14 more)

### Community 8 - "App relationships"
Cohesion: 0.13
Nodes (15): controlsFor(), NAV, ViewControls(), StationTelemetryCard(), UNITS, VAR_LABEL, Segmented(), Cycle (+7 more)

### Community 9 - "Ml relationships"
Cohesion: 0.08
Nodes (27): Rain threshold and probability alert rules, Rain-day alignment evidence differs between snapshot and config, Stage B versus AIFS matched-day RMSE intervals all cross zero, ML pipeline configuration, Stored training covers January-December 2024 only, IFS ensemble backfill disabled, Equal-weight fallback without recent verified pairs, Extreme rainfall probability skill not demonstrated (+19 more)

### Community 10 - "Backend relationships"
Cohesion: 0.13
Nodes (19): ack_alert(), AlertAck, AuthResponse, _check_email(), list_acks(), login(), LoginRequest, me() (+11 more)

### Community 11 - "App relationships"
Cohesion: 0.16
Nodes (22): Sidebar(), Districts(), Forecast(), View, VIEWS, Models(), greeting(), Overview() (+14 more)

### Community 12 - "Data relationships"
Cohesion: 0.11
Nodes (19): FEATURE_LABELS, ValidationPanel(), num(), Period, Verification(), Card(), Stat(), Family (+11 more)

### Community 13 - "Evaluate relationships"
Cohesion: 0.11
Nodes (19): block_bootstrap_diff(), brier(), brier_skill(), categorical(), contingency(), crps_normal(), crps_normal_rows(), quantile_score() (+11 more)

### Community 14 - "Backend relationships"
Cohesion: 0.17
Nodes (12): _b64(), check_login(), create_token(), db(), decode_token(), init_db(), Bharosa accounts: storage, password hashing and access tokens. Standard library, Returns the user id for a valid, unexpired token, else None. (+4 more)

### Community 15 - "Models relationships"
Cohesion: 0.17
Nodes (16): blend(), crossfit_blend(), cv_predict(), fit(), lgb_params(), month_folds(), Stage B: LightGBM gating (plan section 6, milestone M5).  One pooled LightGBM, Blend and a normal-error sigma per point/date/lead from the weighted predicted e (+8 more)

### Community 16 - "Decisions relationships"
Cohesion: 0.11
Nodes (18): 0001: Open-Meteo Previous Runs API as the primary forecast archive, decision 0002, 0003: IMD gridded truth, 03 UTC rain day, offset measured, decision 0004, 0005: dynamical.org Zarr archives for AIFS 2024 and full ensembles, 0006: Freeze, then score the 2025 monsoon once, with a logged guard, 0007: The website shows only pipeline output; no demo data, decision 0008 (+10 more)

### Community 17 - "Tests relationships"
Cohesion: 0.32
Nodes (14): _bearer(), _email(), Account flow tests: sign up -> log in -> profile -> preferences -> password -> d, _signup(), test_alert_acknowledgements(), test_change_password(), test_delete_account(), test_login_and_me() (+6 more)

### Community 18 - "Application relationships"
Cohesion: 0.18
Nodes (16): `.github/workflows/ci.yml`, Bharosa — Hybrid AI–NWP Multi-Model Forecast Blending, docs/, Architecture, Changelog, Development, Glossary, Operations (+8 more)

### Community 19 - "Ingest relationships"
Cohesion: 0.21
Nodes (14): classify(), dem_window(), dist_to_coast_km(), features(), fetch_tile(), gradients(), load_coastline(), main() (+6 more)

### Community 20 - "Docs relationships"
Cohesion: 0.14
Nodes (15): docs/methodology.md, docs/pipeline.md, `ml/config.yaml`, `features/build_table.py`, `features/ledger.py`, `features/regimes.py`, `ingest/daily.py`, `ingest/terrain.py` (+7 more)

### Community 21 - "Backend relationships"
Cohesion: 0.2
Nodes (11): cycle(), cycles(), _issues(), _json_file(), Bharosa API (NCMRWF / MoES, SIH26081)  Serves the outputs of the ML pipeline (, Out-of-fold validation of every method and ablation (ml.evaluate.validation)., Live microclimate, air quality (SAFAR/CAMS), marine surges, and soil moisture te, Issues available, newest first (e.g. "20260925T06" = the 06 UTC run of 25 Sep 20 (+3 more)

### Community 22 - "Models relationships"
Cohesion: 0.19
Nodes (6): config_sha256(), FrozenStageB, git_state(), Frozen Stage B artifact: everything needed to reproduce a blend, with provenance, Weight-averaged calibrated P(obs >= t) per point/date/lead., save()

### Community 23 - "Components relationships"
Cohesion: 0.2
Nodes (9): DistrictMap(), esc(), icon(), LabelSide, labelSides(), MapPoint, BASEMAPS, ALERT_COLORS (+1 more)

### Community 24 - "Lib relationships"
Cohesion: 0.24
Nodes (8): LiveState(), pipelineCommand(), Spinner(), API_BASE_URL, ApiError, apiRequest(), describe(), FastApiValidationError

### Community 25 - "Docs relationships"
Cohesion: 0.18
Nodes (11): docs/data-sources.md, dynamical.org, Open-Meteo, Open-Meteo Previous Runs API, imdlib, Copernicus DEM GLO-90, Natural Earth 10 m coastline, Environmental telemetry (+3 more)

### Community 26 - "Tests relationships"
Cohesion: 0.33
Nodes (7): cycle_doc(), Data endpoints serve the pipeline's exports verbatim and never invent data., test_issues_listing_and_lookup(), test_latest_cycle_and_health(), test_scorecard_is_served_verbatim(), test_validation_report_is_served_verbatim(), write()

### Community 27 - "Docs relationships"
Cohesion: 0.25
Nodes (8): Frontend, Exercise CAP exports, Frontend backend endpoint, `src/auth/guards.tsx`, `src/components/LiveState.tsx`, `src/data/alerts.ts`, `src/data/state.ts`, `src/lib/exportUtils.ts`

### Community 28 - "Models relationships"
Cohesion: 0.33
Nodes (6): blend_probs(), calibrated_cv(), _fit_predict(), Calibrated exceedance probabilities (plan milestone M6).  Per source and lead,, Out-of-fold per-row calibrated probabilities, columns cal_<t>., Weighted average of calibrated source probabilities (weights renormalised over s

### Community 29 - "Docs relationships"
Cohesion: 0.29
Nodes (7): `backend/`, API, Missing export returns 503, Password policy, Token policy, `src/data/cycle.ts`, `src/lib/api.ts`

### Community 34 - "Figures relationships"
Cohesion: 0.67
Nodes (3): Monsoon regime calendar, Core-zone rain anomaly across 2024–2026 relative to IMD 1991–2020 normal, Active and break markers with reference lines at z=+1 and z=-1

### Community 35 - "Figures relationships"
Cohesion: 0.67
Nodes (3): Stage B feature importance (gain), corr_log dominates gain at roughly 0.74; cons_mean_log and cons_median_log rank next, Gain ranks predictive feature contribution; it does not establish causation

### Community 36 - "Figures relationships"
Cohesion: 0.67
Nodes (3): Rain ≥64.5 mm reliability, Stage A, Stage B, isotonic variants and raw GEFS are compared to diagonal calibration, Normal Stage B tracks diagonal more closely in several bins; isotonic curves underpredict observed frequency in mid-probability bins

### Community 37 - "Figures relationships"
Cohesion: 0.67
Nodes (3): Validation RMSE against IMD rain, Stage B has lowest displayed RMSE at all five lead days, approximately 13.3–14.8 mm/day, Static MME is worse than best single source at leads 3–5

### Community 38 - "Figures relationships"
Cohesion: 0.67
Nodes (3): Smoke monsoon regime calendar, Core-zone rain anomaly across 2024–2026 relative to IMD 1991–2020 normal, Active and break markers with reference lines at z=+1 and z=-1

### Community 39 - "Figures relationships"
Cohesion: 0.67
Nodes (3): Smoke Stage B feature importance (gain), corr_log dominates gain at roughly 0.62; cons_mean_log ranks second near 0.15, Feature ranking differs from main report; region_cons_log appears ahead of cons_median_log

### Community 40 - "Figures relationships"
Cohesion: 0.67
Nodes (3): Smoke rain ≥64.5 mm reliability, Stage A, Stage B, isotonic variants and raw GEFS are compared to diagonal calibration, Calibration curves differ materially from main report; counts and uncertainty intervals are absent

### Community 41 - "Figures relationships"
Cohesion: 0.67
Nodes (3): Smoke validation RMSE against IMD rain, Best single source has lower RMSE than Stage B at all five lead days; Stage B is approximately 21–23 mm/day, Static MME peaks near 43 mm/day at lead 3; B-alt stacking stays near 26.5 mm/day

### Community 42 - "Public relationships"
Cohesion: 0.67
Nodes (3): Application favicon, Dark rounded square contains two blue concentric circles, a blue radial line and orange droplet, Radar and rainfall branding

## Knowledge Gaps
- **279 isolated node(s):** `Account endpoints: sign up, log in, profile and preferences, password, alert ack`, `Bharosa accounts: storage, password hashing and access tokens. Standard library`, `One short-lived connection per call; commits on success.`, `Returns the user id for a valid, unexpired token, else None.`, `Bharosa API (NCMRWF / MoES, SIH26081)  Serves the outputs of the ML pipeline (` (+274 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `config()` connect `Ingest relationships` to `Ingest relationships`, `Ingest relationships`, `Evaluate relationships`, `Live relationships`, `Models relationships`, `Ingest relationships`, `Models relationships`, `Models relationships`?**
  _High betweenness centrality (0.248) - this node is a cross-community bridge._
- **Why does `fetch()` connect `Ingest relationships` to `Lib relationships`, `Ingest relationships`?**
  _High betweenness centrality (0.224) - this node is a cross-community bridge._
- **Why does `apiRequest()` connect `Lib relationships` to `Ingest relationships`, `Auth relationships`, `Data relationships`, `Lib relationships`?**
  _High betweenness centrality (0.221) - this node is a cross-community bridge._
- **Are the 45 inferred relationships involving `config()` (e.g. with `build_cycle()` and `main()`) actually correct?**
  _`config()` has 45 INFERRED edges - model-reasoned connections that need verification._
- **Are the 39 inferred relationships involving `path()` (e.g. with `export_dir()` and `build_cycle()`) actually correct?**
  _`path()` has 39 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Account endpoints: sign up, log in, profile and preferences, password, alert ack`, `Bharosa accounts: storage, password hashing and access tokens. Standard library`, `One short-lived connection per call; commits on success.` to the rest of the system?**
  _279 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Ingest relationships` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._

Token accounting: extraction-agent usage is not exposed by this environment; zeros above are placeholders, not measured zero cost. Structural relationships are extracted; semantic claims describe source evidence, not independently reproduced model accuracy.

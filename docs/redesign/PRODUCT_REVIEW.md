# Bharosa product and architecture review

Audit date: 28 September 2026. Scope: React application, FastAPI accounts/data API, Python ingestion, live blending, training, evaluation, tests, documentation, CI, deployment config and stored reports/artifact metadata. Original local changes in .gitignore, package-lock.json and vercel.json are preserved.

## 1. Current application and evidence limits

Bharosa is a district-point, five-day rainfall decision-support prototype for Konkan/Goa and Kerala. It blends numerical weather, AI and ensemble model forecasts using recent IMD verification. Temperature and wind are secondary variables. Stage A (bias correction plus inverse error weights) serves the website; Stage B (LightGBM gating) remains experimental. Public forecasts, account preferences, per-user acknowledgement, CSV/GeoJSON and Exercise CAP exports exist. There is no admin authorization or admin dashboard.

The core architecture is sound: Python ingestion -> Parquet -> blend -> JSON exports -> FastAPI -> React. React Query handles remote state, Zustand sessions, URL parameters the region/lead, Leaflet maps and Recharts comparisons. The late-added telemetry endpoint bypasses the offline pipeline and makes sequential external requests.

Inventory: graphify detected 130 supported files (89 code, 32 document, 9 images), approximately 212,991 words including the model dump. Structural extraction found 736 nodes/1,792 relationships. Semantic review covers documentation, config, artifact metadata and eight result figures. Generated/vendor files are excluded from application review. This is a whole-system architectural audit with targeted line-level tracing; it is not a claim that every model coefficient or external dataset was independently verified.

Baseline: frontend lint and TypeScript passed; backend + ML tests: 56 passed. The checkout has no ml/exports or training archive. Real forecast accuracy, current provider availability and trained-model reproduction therefore cannot be verified locally. Reported scientific metrics are supplied-report evidence, not newly reproduced results. Browser baseline covers the actual empty/loading experience. Synthetic fixtures may be used only in isolated automated checks, never as production fallback.

## 2. Problems found

| Priority | Evidence | Consequence | Treatment |
|---|---|---|---|
| P0 | src/auth/guards.tsx renders children before initializing an absent demo session; onboarding guard is a no-op | null-user crash after sign-out or expired persisted session; inconsistent account journey | explicit guest initialization boundary and account onboarding guard |
| P0 | backend/main.py telemetry defaults unknown point IDs to Pune | wrong-place data presented under requested ID; arbitrary cache keys | validate district against export; 404 unknown and 503 unavailable |
| P0 | src/pages/app/Districts.tsx calls CAMS output SAFAR, sensors and real-time observations | false provenance; European AQI misclassified; soil volume presented as saturation; wave height as surge | source/kind/units/valid-time explicit; remove unsupported labels |
| P0 | src/pages/app/AppShell.tsx and backend health treat file presence as live/operational | stale data looks current | age based on issue AND publication time, missing/invalid/stale states |
| P0 | no server-side admin permissions; profile role is self-selected | a role selector cannot authorize operational access | independent server-controlled admin capability, fail closed |
| P1 | Overview repeats stats, Maharashtra spotlight, map, alerts and rankings; spotlight ignores region | unclear purpose and competing primary actions | one district briefing, outlook, area exploration, evidence |
| P1 | P10/P90 called best/worst; blend called most likely; All clear based on acknowledgement count | misleading uncertainty and safety implication | lower/upper estimate, blend, no active prototype alerts wording |
| P1 | src/components/DistrictMap.tsx FitOnce never refits after region change; minZoom 7 | map may remain on old area and cannot fit long Kerala extent | refit on point-set identity; suitable minimum zoom |
| P1 | src/data/alerts.ts optimistic rollback only when prior cache exists | failed first acknowledgement can linger | restore empty previous state too |
| P1 | backend/main.py sequential telemetry requests up to 15 s vs client 8 s | timed-out UI and silent missing panels | independent bounded concurrent fetches, statuses, bounded cache |
| P1 | ml/daily/run_cycle.py direct writes to latest.json | concurrent reader can see partial JSON | atomic replacement and corruption-aware API responses |
| P1 | model run selection is modal metadata timestamp; live cache keyed only to that timestamp | mixed provider runs and stale reuse when other sources advance | future per-provider run manifest/cache and issue validity contracts |
| P1 | ml/live/stage_a.py and features/ledger.py use date-only truth cutoff | issue-time observation availability is not established, especially 00 UTC vs rain ending 03 UTC | scientific audit required before revised accuracy claims; retain current model |
| P1 | frozen artifact metadata config hash differs from current config; dirty training tree | exact reproduction blocked; guarded test should refuse current config | recover frozen config, keep frozen test untouched |
| P1 | ml/evaluate/fast_tune_pune.py and compare_refined_model.py duplicate blending and evaluate unbounded archive dates | drift from served method and potential test-season contamination | quarantine exploratory scripts; explicit train-window input before promotion |
| P2 | monochrome semantic tokens, chart colors and alert badges | weak hierarchy; severity hard to distinguish | sea-teal accent, amber/coral severity, labels/icons retained |
| P2 | seven equal desktop navigation links and mobile drawer | desktop density on phone; specialist tools dominate | four primary destinations plus secondary evidence/account |
| P2 | user-facing error messages contain shell commands | users receive operational instructions they cannot act on | plain recovery states; troubleshooting in ops documentation |
| P2 | API client casts JSON directly; metadata has no runtime contract | malformed records can crash formatters | validate published exports and incrementally add runtime decoders |
| P2 | localStorage bearer token and process-local throttling | multi-worker/session revocation limitations | audited auth library/cookie migration and shared rate limit as deployment work |
| P2 | static-only Vercel rewrite and default localhost API | deployed frontend alone cannot provide forecasts/accounts | explicit API deployment, persistent export store/DB and allowed origin |

Scientific evidence must remain honest: supplied 2024 validation does not establish held-out 2025 performance; Stage B vs AIFS RMSE differences are not significant in paired comparisons; extreme-event sample is small. E4 selection is among E4/E4w, not the ablation family, explaining why E8 can have a lower reported RMSE. Main and smoke plots use different runs and are not interchangeable. District centroids and shared IMD cells do not establish street-level or catchment flood accuracy.

## 3. Improved concept

**Bharosa: understand the rain ahead.** A local rainfall briefing that answers: where, when, how much, how uncertain, and what evidence supports it. Primary user: a local planner or district preparedness officer checking a place before planning activities. Secondary user: forecaster/researcher comparing models. Administrator: operator maintaining pipeline reliability. These are different jobs, not different color themes for the same dashboard.

Keep rainfall as the core. Environmental context is secondary and only shown when a reliable source exists. Do not turn the product into a general climate, air-quality, marine and disaster platform merely because endpoints exist. Do not market district-point rainfall as hyperlocal observation or flood prediction.

## 4. Story and user journey

Discover: concise purpose and supported geography, access without account.
Understand: select district, see dated rainfall estimate, uncertainty and freshness immediately.
Explore: browse five forecast days, change region/place, inspect map and compare neighbouring points.
Analyze: open source contributions and independent validation when needed.
Act: review prototype alerts, consult official advisories, acknowledge a reviewed item or export evidence. Acknowledgement means reviewed, not hazard resolved.

First five seconds: place, valid day, expected rain, whether data is current. Primary action: choose a district/day. Optional account: retain preferences; never a prerequisite for public forecasts. Onboarding applies only to newly created accounts.

## 5. Information architecture

| Route | Audience | Job |
|---|---|---|
| / and /app | public/guest/account | local rainfall briefing |
| /landing | public | product explanation and methodology summary |
| /app/districts | public/guest/account | Explore: map, location, environmental context |
| /app/forecast | public/guest/account | area comparison and uncertainty |
| /app/alerts | public/guest/account | prototype alerts and official advisory links |
| /app/models | specialist, public evidence | model contributions and disagreement |
| /app/verification | specialist, public evidence | historical verification and limitations |
| /app/settings | guest/account | personal preferences and account controls |
| /admin | authenticated administrator | monitoring, coverage, data freshness and account counts |

Retain existing URLs to preserve links. Group Models/Verification under Evidence. Admin has its own shell and backend authorization, never the editable professional role. Operational actions should be added only with audit history and narrowly scoped privileges.

## 6. User and admin experiences

User: calm editorial hierarchy, wide rainfall briefing, readable uncertainty, horizontally scrollable date choices, district cards and compact links to evidence. Current observations must be separate from future forecasts. Until observations are integrated, label the home as Forecast briefing, not Current conditions.

Admin: compact system status, publication age, participating source count, per-source run times and actual record coverage, latest truth date, available cycles, verification availability and user totals. Read-only first; unavailable values say unavailable. API health is an observed check, never an invented uptime percentage. Config inspection can be read-only; retries/rebuilds require a job runner, audited server actions and idempotency. Do not expose account emails, tokens or raw logs in a public endpoint.

Desktop: sidebar, summary strip, source table and operational panels. Tablet: two-column summaries, horizontally contained tables. Mobile: status first, source cards or scroll-contained table, incident details expandable, no dangerous bulk action.

## 7. Mobile-first behavior

Below 1024 px: persistent bottom navigation (Briefing, Explore, Forecast, Alerts), secondary account/evidence through accessible menu. At 390 px: single-column briefing, 44 px targets, date cards in a scroll-snap strip, native district select, essential figures before map. Safe-area padding prevents navigation covering content. Maps are optional exploration surfaces with HTML selection alternatives. Never require hovering, dragging or swiping: taps and keyboard buttons provide the same actions. Dialog closes with Escape, traps focus and restores focus. Tablet adds columns without changing reading order.

## 8. Design system and spatial experience

Visual direction: coastal observatory. Deep ink/teal hero, pale mineral canvas, white cards, restrained cyan accents, amber caution, coral danger. Inter for prose/UI; tabular numbers for measurements. Body 14–16 px, secondary 12–14 px, hero rainfall 56–80 px, headings 24–48 px. Spacing scale 4/8/12/16/24/32/48. Radii 10 controls, 16 cards, 24 feature panels. Thin borders and soft shadows; glass reserved for decorative scene layers with opaque readable content.

Buttons: primary teal, secondary outlined, destructive explicit. Focus visible in both themes. Alerts use icon, text and color. Skeletons indicate layout; empty states explain scope; errors offer retry and retain stale data when safe. Motion 150–250 ms, no endless attention-demanding pulse; reduced-motion disables transforms and animated transitions.

| Spatial element | Meaning / why depth | Interaction | Mobile | Fallback | Budget |
|---|---|---|---|---|---|
| Optional five-day spatial rainfall columns | columns separate dates and reveal relative magnitude; depth supports exploration, exact comparison remains in HTML | ordinary date buttons and rotate slider | compact scene, no parallax; opt-in | 2D date cards always present; reduced motion uses flat/static view | CSS 3D, no WebGL dependency, five objects, no animation loop |
| Future terrain/rain scene | shows coastal-to-Ghats elevation relationship once licensed DEM + georeferenced rainfall available | orbit buttons/keyboard, layer toggles, reset | simplified mesh loaded on request | static cross-section + accessible data table | lazy chunk target <150 KB gzip, <50k triangles, DPR <=1.5, idle render off |
| Card depth / atmosphere | separates primary briefing and secondary evidence, no weather state invented | focus/hover elevation only | static | solid surfaces | CSS only |

Do not render rain animation from daily accumulation as if it were currently raining. Do not interpolate a continuous hazard surface from 29 district points. Do not build a globe or 3D bar chart for its own sake. The first implemented spatial enhancement should be optional, accurate to forecast values and free of a large rendering dependency.

## 9. Data sources and combination policy

Existing: Open-Meteo forecast and previous runs; dynamical.org AIFS/GEFS archives; IMD final/realtime rain/Tmax; ERA5 wind; IMD climatology; Copernicus DEM/Natural Earth; modelled Open-Meteo air-quality, surface and marine context. Several model names share one API gateway, so ten models do not equal ten independent delivery paths.

| Consideration | Purpose | Integration decision |
|---|---|---|
| IMD district warnings, nowcast, station/AWS observations | official warnings and observed conditions | highest priority; documented API exists; access, station mapping, freshness and redistribution must be verified before activation |
| INCOIS ocean-state/high-wave advisories | coastal context | link official advisory first; integrate only licensed machine-readable feed and relevant coastal points |
| CAMS via Open-Meteo | modelled regional air quality | retain with explicit European AQI, source and valid time; never label SAFAR/CPCB observations |
| Open-Meteo surface/marine | humidity, pressure, volumetric soil water, wave context | optional independent products; no soil saturation or storm-surge inference |
| GPM IMERG | spatial rainfall cross-check | research backlog; assess latency, gauge dependence and licensing; not interchangeable IMD truth |
| CWC river gauges | actual river/flood context | later only if product expands; validate access/coverage and datum, never infer river levels from rain |

Provider docs checked during audit: [IMD API reference](https://api.imd.gov.in/public/api_reference.html), [Open-Meteo air quality](https://open-meteo.com/en/docs/air-quality-api), [marine](https://open-meteo.com/en/docs/marine-weather-api), [pricing/production access](https://open-meteo.com/en/pricing), [INCOIS ocean-state forecast](https://www.incois.gov.in/oceanservices/osfforecast.jsp). Documentation establishes capability, not an SLA or granted credentials.

Normalize every product with source/provider, model/station identifier, observed/forecast/derived kind, issue/valid/fetched timestamps, units, spatial support, license/attribution and quality/status. Never average official warnings with model probabilities. Keep observations separate from forecasts; final truth supersedes preliminary truth while preserving revisions. Deduplicate provider/model/run/location/variable/valid-window. For conflicting forecasts show spread and source contributions; do not silently choose a convenient value. Report source-specific failures and staleness, bounded retries/cache, timeout budgets, no-data distinct from zero. New sources must prove incremental decision value or skill on held-out data before entering the blend.

## 10. Recommended project structure

```text
src/
  app/                 # router, providers, application composition
  layouts/             # user and admin shells, responsive navigation
  pages/               # thin route entry points, stable existing URLs
  features/
    forecast/          # briefing, outlook, selectors, freshness policy
    environment/       # modelled context, units, provenance
    alerts/            # alert domain, review state, official advice links
    evidence/          # models and validation
    admin/             # monitoring hooks, contracts, operational UI
  visualizations/      # optional spatial scenes; no business rules
  components/          # reusable controls and states (ui.tsx migration facade)
  data/                # existing forecast API facade during migration
  auth/                # session and guards
  lib/                 # API transport, formatting, export helpers
  styles/              # design tokens and global styling
backend/
  main.py              # app composition and existing public data routes
  accounts.py, auth.py # existing auth boundary; migrate separately
  services/            # telemetry and forecast status/repositories
  routers/             # admin and future product-specific APIs
ml/
  ingest/, features/, live/, models/, evaluate/, tests/
  experiments/         # exploratory scripts after provenance review
  daily/               # orchestration and publication manifests
```

Migrate at feature boundaries; avoid moving every stable file at once. Responsive components belong with their feature/layout; do not fork an independent mobile application. Keep the Python science pipeline separate from web business logic. Existing imports remain compatibility facades until consumers migrate.

## 11. Technology decisions

Retain React/Vite, TypeScript, React Query, Zustand for session only, Leaflet and FastAPI. No Next.js rewrite is needed for this application. Retain the deterministic Stage A serving path and frozen Stage B guard. Start spatial effects with CSS 3D and HTML; adopt Three.js only if the terrain scene proves useful and passes device budgets. Add runtime export validation, atomic publishing, read-only protected admin and source adapters before new APIs. SQLite is acceptable for a single persistent backend instance; use managed PostgreSQL and migrations when deploying multiple instances. Use a scheduled pipeline worker with versioned object storage/publication pointer, not a frontend serverless request running training.

Proposed budgets (targets, not measured achievements): p75 LCP <=2.5 s, INP <=200 ms, CLS <=0.1; initial route JS <=200 KB gzip excluding optional maps/charts; only one map mounted per visible feature; no background spatial render loop; complete keyboard path; WCAG 2.2 AA manual and automated checks; check 390/768/1440 widths plus 320 px and 200% zoom.

## 12. Phased roadmap and acceptance gates

1. Audit and evidence: map modules, baseline tests, provenance and screenshots. Gate: grounded issue list and limitations documented.
2. Product/IA: rainfall briefing, four core destinations, evidence secondary, independent ops. Gate: one clear place/day task and stable links.
3. Foundations/design system: semantic tokens, session guards, data freshness, backend boundaries. Gate: no guest crash, no false live status, fail-closed admin.
4. Core redesign: district-first hero, 5-day outlook, next-step links, coherent exploration. Gate: real/empty/error/stale states render without fabricated values.
5. Spatial enhancement: optional CSS 3D outlook, HTML controls and equivalents. Gate: keyboard/touch/reduced-motion, no extra request loop.
6. Data layer: fix telemetry identity/provenance/units, bounded parallel fetch, atomic exports. Next: source contracts, per-run manifests, official IMD integration after access validation. Gate: partial failures visible, unknown locations rejected.
7. Admin: protected read-only health/freshness/coverage/source/user monitoring. Next: persisted job events, restricted configuration and audited retries. Gate: guest/normal-user API access denied and responsive layout.
8. Mobile: primary bottom navigation, date strip, accessible dialog, map alternatives. Gate: no page-level horizontal overflow at target widths, 44 px controls.
9. Performance/accessibility: production build, bundle evidence, browser regressions and domain tests. Gate: test results recorded, limitations explicit.
10. Polish and production readiness: copy, empty states, source attribution, docs. Deployment gate: actual exports, provider terms/access, durable DB/storage, backups/restore, monitoring, auth hardening and device performance verified.

Scientific work is a separate gate: recover frozen configuration; investigate issue-time availability and exploratory-script period boundaries; reproduce validation; only then score frozen test once under protocol. UI work must not silently retune or promote Stage B.

## 13. Prioritized change list

Change now: guest guards, real source naming, truthful forecast terminology, freshness state, region map fitting, alert rollback, atomic publication, consistent tokens and mobile navigation.
Rebuild now: overview into district briefing; application shell into core/evidence hierarchy; telemetry component into attributed modelled context.
Add now: optional spatial outlook, protected read-only admin, source status/coverage, focused regression tests and this audit/roadmap.
Remove from primary journey: Maharashtra-only spotlight, fake institutional guest identity, technical run commands, equal weighting/model counts as primary hero metrics, unsupported worst-case/sensor/surge claims.
Preserve: accessible HTML content, live-only serving policy, source attribution, Exercise CAP status, scientific uncertainty, existing account/ack/export functions, Stage A method and frozen test.
Defer with explicit dependencies: official live observation/warning ingestion, gridded terrain scene, real-time job logs and operations actions, production deployment, auth cookie migration and Stage B promotion. None should be represented as already functioning.

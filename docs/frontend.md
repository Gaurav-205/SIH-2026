# Frontend

React 19 + TypeScript + Vite, with Tailwind for styling, React Query for server data, Zustand for the
session, React Router for pages and React-Leaflet (Esri gray basemaps, no key) for maps.

## User flow

```
/ → /app (guest briefing, no account required)
/landing → product introduction
/signup → /welcome (role, region, alert threshold, lead day) → /app
/login → /app (or onboarding for an unfinished account)
/admin → separate operations view; server-authorized administrators only
```

Guests use the same export-backed forecast endpoints. Missing data remains visibly unavailable.
Account preferences persist in the API; guest preferences stay in this browser. Guards initialize
guest state before rendering dependent pages and keep unfinished accounts in onboarding.

The application shell lives in `src/layouts/UserLayout.tsx`; `AppShell` is a compatibility facade.
Forecast validation, freshness and district selection live in `src/features/forecast/`; modelled
context lives in `src/features/environment/`. The optional, lazy CSS 3D outlook lives in
`src/visualizations/` and has flat mobile/reduced-motion equivalents.

## Pages (`src/pages/app/`)

| Page | Shows |
| :--- | :--- |
| Overview / Briefing | selected district, dated five-day outlook, uncertainty, freshness, contributing sources, optional spatial outlook |
| Districts | map + table; a district's blend, range, probabilities, model weights and the reasons behind them |
| Forecast | region view for a lead day, publication history with an explicit archived banner |
| Models | each model's weight and verified skill, and whether it is weighted or shown only |
| Alerts | district alerts against your threshold; acknowledge or reopen; CAP 1.2 XML/JSON export |
| Verification | the scorecard (RMSE with intervals, ETS/POD/FAR) and live consistency checks |
| Settings | profile, preferences, theme, password, account deletion |

## Data

- [`src/data/cycle.ts`](../src/data/cycle.ts): types that mirror the pipeline's JSON, plus the
  `useCycle`, `useScorecard` and `useCycleIndex` hooks.
- [`src/components/LiveState.tsx`](../src/components/LiveState.tsx): loading, backend unreachable, and
  "no export yet" (503) states.
- [`src/data/alerts.ts`](../src/data/alerts.ts): builds district alerts from the cycle and stores
  acknowledgements (server for accounts, browser for the demo).
- [`src/data/state.ts`](../src/data/state.ts): region and lead are kept in the URL, so any view can be
  shared.
- [`src/lib/exportUtils.ts`](../src/lib/exportUtils.ts): CSV, GeoJSON and CAP 1.2 exports. CAP alerts
  are marked `status: Exercise`, because this is a prototype and not an official IMD warning.

The app never fabricates values. If a number is not in the export, it is not shown.

## Theming

Colours are CSS variables (canvas, surface, subtle, line, fg, muted, accent, ok, warn, danger). They
are defined for light and dark in `src/index.css` and mapped in `tailwind.config.js`. The theme can
follow the system or be forced in Settings.

## Commands

```bash
npm run dev        # http://localhost:5173
npm run lint
npm run typecheck
npm run build      # dist/ (vercel.json adds the SPA rewrite)
```

`VITE_API_URL` points the app at the backend (default `http://localhost:8000`).

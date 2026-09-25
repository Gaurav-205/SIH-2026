# Frontend

React 19 + TypeScript + Vite, with Tailwind for styling, React Query for server data, Zustand for the
session, React Router for pages and React-Leaflet (Esri gray basemaps, no key) for maps.

## User flow

```
Landing (/) → Sign up (/signup) → Onboarding (/welcome: role, home region, alert threshold, lead day) → Dashboard (/app)
           ↘ Log in (/login) ─────────────────────────────────────────────────────────────────────────↗
           ↘ Explore the demo (no account; same live data; settings kept in this browser)
```

Guards in [`src/auth/guards.tsx`](../src/auth/guards.tsx) send signed-out visitors to `/login` and back
afterwards, and keep new accounts in onboarding until it is finished.

## Pages (`src/pages/app/`)

| Page | Shows |
| :--- | :--- |
| Overview | greeting, open alerts, wettest districts, run status |
| Districts | map + table; a district's blend, range, probabilities, model weights and the reasons behind them |
| Forecast | region view for a lead day |
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

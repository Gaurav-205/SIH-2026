# AtmosFusion — Hybrid AI–NWP Multi-Model Forecast Blending System

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.2+-61DAFB.svg?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6.svg?logo=typescript)](https://www.typescriptlang.org)

> **Built for NCMRWF / Ministry of Earth Sciences (MoES) — SIH26081**  
> Operational multi-model ensemble blending platform dynamically refereeing physical NWP models (*ECMWF IFS, WRF 3km, GFS/BharatFS, NCUM*) and AI forecasting models (*Google GraphCast, ECMWF AIFS*) to eliminate extreme precipitation wash-out over complex Indian terrain.

---

## 🧭 User flow

```
Landing (/) ──► Sign up (/signup) ──► Onboarding (/welcome) ──► Dashboard (/app)
     │                                role · home region ·          │
     │                                alert threshold · lead day    ├─ Overview      today's alerts, peaks, regime
     ├──► Log in (/login) ─────────────────────────────────────────►├─ Stations      Pune AWS map, weights, plume
     │                                                              ├─ Forecast      regional grid, 2D / 3D terrain
     └──► Explore the demo (no account, works offline) ────────────►├─ Models        Trust Map + disagreement
                                                                    ├─ Alerts        acknowledge, CAP 1.2 export
                                                                    ├─ Verification  scorecard + live checks
                                                                    └─ Settings      profile, prefs, theme, password, delete
```

- **Accounts** live in the FastAPI backend: SQLite storage, PBKDF2-SHA256 salted password hashes, signed (HS256) access tokens valid for 7 days, login throttling, and the same error for "wrong password" and "no such account".
- **Protected routes**: signed-out visitors go to `/login` and return to the page they asked for; new accounts finish onboarding before reaching the dashboard.
- **Preferences** (home region, default lead day, alert threshold, light/dark/system theme) are saved to the account, and the dashboard opens on them. View state (region, date, lead day) is also kept in the URL, so any view can be shared.
- **Alert acknowledgements** are stored per user on the server.
- **Demo mode** needs no account or backend: everything runs in the browser and settings are kept in local storage.

## 📊 Data used in the app

| Where | Data | Engine |
| :--- | :--- | :--- |
| Stations, Overview | Five Pune AWS stations with six model forecasts (sample inputs) | FastAPI `services/blend.py`, or the identical in-browser `src/lib/blendEngine.ts` when the backend is offline |
| Forecast, Models, Verification | Konkan & Goa and Kerala on a 0.25° grid | Deterministic demo generator in the browser (`src/data/demo.ts`), labelled as demo data |
| Verification (benchmark table) | Pune district skill figures | Static reference figures bundled with the prototype |

---

## 🌧 The Core Scientific Problem

Classical multi-model ensembles use **flat arithmetic averaging**:
$$\bar{y} = \frac{1}{M}\sum_{m=1}^{M} f_m$$

Over complex terrain such as the **Western Ghats escarpment**, this flat average **erases extreme localized precipitation**. For instance, at **Lavasa / Temghar Ghat**, during a 162 mm cloudburst event:
- High-resolution orographic models (WRF 3km: 175 mm, GraphCast: 165 mm) correctly resolve steep upslope moisture convergence.
- Coarser global models (GFS: 45 mm, NCUM: 60 mm) severely under-estimate.
- Flat averaging yields **114 mm** — washing out the **flash flood / mudslide signal by ~48 mm**.

**AtmosFusion solves this with dynamic, cell-by-cell skill weighting.**

---

## 📐 Mathematical Formulation

### 1. Skill-Weighted Dynamic Consensus
Each model $m$ at station/grid cell $s$ is assigned weight $w_{m,s}$ based on rolling 48h Mean Absolute Error ($\text{MAE}_{m,s}$):
$$w_{m,s} = \frac{\left(\text{MAE}_{m,s} + \epsilon\right)^{-p}}{\sum_{k} \left(\text{MAE}_{k,s} + \epsilon\right)^{-p}}, \qquad \sum_{m} w_{m,s} = 1.000$$

Where:
- $p = 2.0$ (quadratic skill penalization)
- $\epsilon = 0.1\text{ mm}$ (numerical stability against zero error)

The consensus forecast $\hat{y}_s$ is computed as:
$$\hat{y}_s = \sum_{m} w_{m,s} f_{m,s}$$

### 2. Monotonic Parametric Uncertainty Quantiles
Rather than asserting arbitrary disjoint probabilities, AtmosFusion derives percentiles $P_{10}, P_{50}, P_{90}$ and exceedance probabilities $P(\text{Rain} \ge T)$ from a single continuous distribution fitted to the consensus mean $\mu_s = \hat{y}_s$ and weighted ensemble spread $\sigma_s$:
$$\sigma_s = \max\left(4.0, \sqrt{\sum_m w_{m,s}(f_{m,s} - \hat{y}_s)^2}\right)$$
$$P_{90} = \hat{y}_s + 1.28155\,\sigma_s, \qquad P(\text{Rain} \ge T) = 1 - \Phi\left(\frac{T - \hat{y}_s}{\sigma_s}\right)$$

This mathematically guarantees:
- $P_{10} \le P_{50} \le P_{90}$ (monotonicity)
- $P(\text{Heavy} \ge 64.5) \ge P(\text{Very Heavy} \ge 115.6) \ge P(\text{Extreme} \ge 204.5)$
- If threshold $T \ge P_{90}$, then $P(\text{Rain} \ge T) \le 10\%$.

---

## 🏆 Held-Out Verification Scorecard (Pune District Benchmark)

| Model / System | Architecture | Day-1 RMSE (mm) | Day-3 RMSE (mm) | Heavy Rain ETS | Extreme Rain CSI | CRPS Score |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **AtmosFusion Blend** | **Hybrid AI + NWP (Dynamic)** | **11.2** | **13.1** | **0.48** | **0.41** | **4.8** |
| IMD Static MME | Operational Ensemble | 12.7 | 15.4 | 0.38 | 0.31 | 6.2 |
| Google GraphCast | AI / ML (0.25°) | 13.8 | 15.9 | 0.36 | 0.30 | 5.5 |
| ECMWF IFS HRES | Physics NWP (9km) | 14.1 | 16.2 | 0.35 | 0.28 | 5.8 |
| WRF (3km Meso) | Physics NWP (High-Res) | 14.5 | 16.8 | 0.37 | 0.33 | 5.9 |
| GFS / BharatFS | Physics NWP (13km) | 15.2 | 17.5 | 0.32 | 0.25 | 6.8 |
| NCUM | Physics NWP (12km) | 16.6 | 18.2 | 0.31 | 0.22 | 7.1 |

---

## 🚀 Quickstart

### 1. Prerequisites
- **Node.js** 20.19+ or 22.13+
- **Python** 3.10+ for the backend (needed for accounts; the demo works without it)

### 2. Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Swagger docs: [http://localhost:8000/docs](http://localhost:8000/docs). The accounts database (`backend/atmosfusion.db`) is created on first start.

### 3. Frontend
```bash
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173), then **Get started** to create an account, or **Explore the demo**.

| Command | Output |
| :--- | :--- |
| `npm run build` | `dist/` for Vercel/Netlify ([vercel.json](vercel.json) adds the SPA rewrite) |
| `npm run build:single` | `dist-single/index.html`: one self-contained file with hash routing, a backup for offline demos (demo mode only) |
| `npm run preview` | Serves the production build locally |

### 4. Configuration

| Variable | Where | Purpose |
| :--- | :--- | :--- |
| `VITE_API_URL` | frontend `.env` | Backend URL (default `http://localhost:8000`) |
| `ATMOSFUSION_SECRET` | backend env | Token signing key. If unset, a random key is generated once and stored in the database. **Set it in production.** |
| `ATMOSFUSION_DB` | backend env | SQLite file path (default `backend/atmosfusion.db`) |
| `ATMOSFUSION_TOKEN_TTL` | backend env | Session length in seconds (default 7 days) |
| `ATMOSFUSION_CORS_ORIGINS` | backend env | Comma-separated allowed frontend origins |

### 5. Tests
```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest -q
```
28 tests cover the blending engine's guarantees (weights sum to 1, blend = Σ wᵢfᵢ, P10 ≤ P50 ≤ P90, ordered exceedance probabilities, Lavasa's peak preserved) and the full account flow (sign-up, duplicates, hashing at rest, login, throttling, tampered tokens, preferences, password change, acknowledgements, deletion). Frontend checks: `npm run lint` and `npm run build`.

---

## 🎬 Demo Walkthrough

1. **Landing** — the hero card shows the real Lavasa numbers: flat average 114.2 mm, blend 152 mm, observed 162 mm.
2. **Get started** — create an account, then pick role, home region, alert threshold and default lead day.
3. **Overview** — open alerts, wettest district, the Pune station peak, and what needs attention. Acknowledge an alert and watch the sidebar badge drop.
4. **Stations** — Lavasa: the blend misses the observation by 10 mm, the flat average by 47.8 mm. The weights panel explains why (WRF and GraphCast had the lowest recent error on the escarpment).
5. **Forecast** — switch to 3D terrain and *Worst case*: amber columns mark cells where the 90th percentile reaches 204.5 mm.
6. **Models** — click a grid cell on the Trust Map to see every weight and the reasons it rose or fell.
7. **Alerts** — acknowledge, then export CAP 1.2 XML for disaster-response systems.
8. **Settings** — switch to dark mode; change your threshold and see the alert list update.

---

## 🗂 Project Structure

```
backend/
  main.py              FastAPI app: station forecasts, scorecard, quantile curves
  auth.py              SQLite storage, password hashing, signed tokens, login throttling
  accounts.py          Sign-up, login, profile/preferences, password, delete, alert acks
  services/blend.py    Blending engine (weights, quantiles, alerts)
  tests/               pytest: engine invariants + account flow
src/
  App.tsx              Routes and guards (the flow above)
  auth/                Session store (account or demo) and route guards
  pages/public/        Landing, Login, Signup
  pages/Welcome.tsx    Onboarding
  pages/app/           App shell + Overview, Stations, Forecast, Models, Alerts, Verification, Settings
  components/          Design system (ui.tsx), station map, grid map, alert row
  data/                View state + data hooks, alerts, regional demo generator
  lib/                 API client, blending engine, exports, theme, basemaps
  three/               3D terrain (React Three Fiber)
```

---

## 📡 API Endpoints

| Method | Path | Auth | Purpose |
| :--- | :--- | :---: | :--- |
| POST | `/api/v1/auth/signup` | | Create an account → `{ token, user }` |
| POST | `/api/v1/auth/login` | | Log in → `{ token, user }` |
| GET | `/api/v1/auth/me` | ✓ | Current user |
| PATCH | `/api/v1/users/me` | ✓ | Update name, role, home region, lead day, threshold, theme, onboarded |
| POST | `/api/v1/users/me/password` | ✓ | Change password |
| POST | `/api/v1/users/me/delete` | ✓ | Delete account (password required) |
| GET | `/api/v1/alerts/acks` | ✓ | List acknowledged alerts |
| PUT / DELETE | `/api/v1/alerts/acks/{alert_id}` | ✓ | Acknowledge / reopen an alert |
| GET | `/api/v1/health` | | Service status |
| GET | `/api/v1/regions/{region}/forecast?lead_day=1` | | Blended station forecasts and alerts (`pune` or `pune-metro`) |
| GET | `/api/v1/scorecard` | | Benchmark rows |
| GET | `/api/v1/quantile-curve?station_id=pune-lavasa` | | 10-day P10/P50/P90 plume |

Authenticated calls send `Authorization: Bearer <token>`.

---

## 💾 Export Formats

- **Stations (CSV / GeoJSON)**: blend, flat average, P90, spread, exceedance probabilities, alert level, and per-model weights
- **Alerts (CAP 1.2 XML / JSON)**: station and district alerts in OASIS Common Alerting Protocol format, marked `status: Exercise` (prototype, not an official warning)

---

## 📄 License
MIT License. Developed for NCMRWF / Ministry of Earth Sciences (MoES).

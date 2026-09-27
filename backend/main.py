"""
Bharosa API (NCMRWF / MoES, SIH26081)

Serves the outputs of the ML pipeline (ml/daily/run_cycle.py), which fetches live forecasts from
Open-Meteo, verifies each model against IMD gridded rainfall, and blends them. Nothing here is
hardcoded: if the pipeline has not produced a cycle yet, the endpoints say so (503).

Also hosts user accounts (see accounts.py).
"""

import json
import os
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

import accounts
import auth

_DEFAULT_EXPORTS = Path(__file__).resolve().parent.parent / "ml" / "exports"
EXPORTS_DIR = Path(os.getenv("BHAROSA_EXPORTS", os.getenv("ATMOSFUSION_EXPORTS", _DEFAULT_EXPORTS)))
CYCLE_FILE = re.compile(r"^cycle_(\d{8}T\d{2})\.json$")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    auth.init_db()  # create the accounts tables on first run
    yield


app = FastAPI(
    title="Bharosa API",
    description="Live multi-model forecast blending (Open-Meteo forecasts, IMD truth) and user accounts",
    version="3.0.0",
    lifespan=lifespan,
)
app.include_router(accounts.router)

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "BHAROSA_CORS_ORIGINS",
        os.getenv(
            "ATMOSFUSION_CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://localhost:4173,http://127.0.0.1:4173",
        ),
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


def _json_file(path: Path, what: str, command: str = "python -m ml.daily.run_cycle") -> Response:
    if not path.exists():
        raise HTTPException(status_code=503, detail=f"No {what} yet. Run the pipeline: {command}")
    # Written by the pipeline as JSON; served as-is
    return Response(content=path.read_bytes(), media_type="application/json", headers={"Cache-Control": "no-cache"})


def _issues() -> list[str]:
    if not EXPORTS_DIR.exists():
        return []
    return sorted((m.group(1) for f in EXPORTS_DIR.iterdir() if (m := CYCLE_FILE.match(f.name))), reverse=True)


@app.get("/api/v1/health")
def health():
    latest = EXPORTS_DIR / "latest.json"
    info = {"status": "operational", "service": "Bharosa API v3", "cycle": None}
    if latest.exists():
        c = json.loads(latest.read_text(encoding="utf-8"))
        info["cycle"] = {
            "init_utc": c["issue"]["init_utc"],
            "generated_at": c["generated_at"],
            "live_sources": sum(1 for s in c["sources"] if s["live"]),
            "points": len(c["points"]),
            "latest_rain_truth_date": c["truth"].get("latest_rain_truth_date"),
        }
    else:
        info["status"] = "no_cycle"
    return info


@app.get("/api/v1/cycles")
def cycles():
    """Issues available, newest first (e.g. "20260925T06" = the 06 UTC run of 25 Sep 2026)."""
    return {"issues": _issues()}


@app.get("/api/v1/cycle")
def cycle(issue: str | None = Query(None, pattern=r"^\d{8}T\d{2}$", description="Issue id from /cycles; latest if omitted")):
    if issue is None:
        return _json_file(EXPORTS_DIR / "latest.json", "forecast cycle")
    if issue not in _issues():
        raise HTTPException(status_code=404, detail=f"Issue {issue} not found")
    return _json_file(EXPORTS_DIR / f"cycle_{issue}.json", "forecast cycle")


@app.get("/api/v1/scorecard")
def scorecard():
    return _json_file(EXPORTS_DIR / "scorecard.json", "scorecard")


@app.get("/api/v1/validation")
def validation():
    """Out-of-fold validation of every method and ablation (ml.evaluate.validation)."""
    return _json_file(EXPORTS_DIR / "validation.json", "validation report", "python -m ml.evaluate.validation")


_TELEMETRY_CACHE: dict[str, tuple[dict, float]] = {}


@app.get("/api/v1/telemetry")
def telemetry(point_id: str = Query("pune-ghats", description="District point id")):
    """Live microclimate, air quality (SAFAR/CAMS), marine surges, and soil moisture telemetry."""
    import time
    import urllib.request

    now = time.time()
    if point_id in _TELEMETRY_CACHE:
        val, ts = _TELEMETRY_CACHE[point_id]
        if now - ts < 300:  # 5-minute cache
            return val

    latest = EXPORTS_DIR / "latest.json"
    lat, lon, name = 18.52, 73.85, "Pune"
    if latest.exists():
        try:
            c = json.loads(latest.read_text(encoding="utf-8"))
            for p in c.get("points", []):
                if p["id"] == point_id:
                    lat, lon, name = p["lat"], p["lon"], p["name"]
                    break
        except Exception:
            pass

    is_coastal = point_id in {
        "mumbai", "thane", "raigad", "ratnagiri", "sindhudurg", "north-goa", "south-goa",
        "alappuzha", "kozhikode", "kannur", "kasaragod", "kollam", "thiruvananthapuram"
    }

    out = {
        "point_id": point_id,
        "name": name,
        "lat": lat,
        "lon": lon,
        "is_coastal": is_coastal,
        "air_quality": None,
        "surface": None,
        "marine": None,
        "radar": {
            "pune_dwr": "https://mausam.imd.gov.in/radar/dwr_pune.gif",
            "mumbai_dwr": "https://mausam.imd.gov.in/radar/dwr_mumbai.gif",
            "satellite_ir": "https://mausam.imd.gov.in/satellite/insat3d_ir1.jpg",
        },
    }

    # Air Quality (PM2.5, PM10, AQI, UV)
    try:
        url = f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=pm2_5,pm10,european_aqi,uv_index"
        req = urllib.request.Request(url, headers={"User-Agent": "Bharosa/3.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            out["air_quality"] = data.get("current")
    except Exception:
        pass

    # Surface & Catchment Soil Moisture
    try:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=relative_humidity_2m,surface_pressure,soil_moisture_0_to_1cm"
        req = urllib.request.Request(url, headers={"User-Agent": "Bharosa/3.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            out["surface"] = data.get("current")
    except Exception:
        pass

    # Marine Arabian Sea Swells (for Coastal Districts)
    if is_coastal:
        try:
            url = f"https://marine-api.open-meteo.com/v1/marine?latitude={lat}&longitude={lon}&current=wave_height,wave_direction,wave_period"
            req = urllib.request.Request(url, headers={"User-Agent": "Bharosa/3.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode())
                out["marine"] = data.get("current")
        except Exception:
            pass

    _TELEMETRY_CACHE[point_id] = (out, now)
    return out


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

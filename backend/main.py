"""
AtmosFusion API (NCMRWF / MoES, SIH26081)

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

EXPORTS_DIR = Path(os.getenv("ATMOSFUSION_EXPORTS", Path(__file__).resolve().parent.parent / "ml" / "exports"))
CYCLE_FILE = re.compile(r"^cycle_(\d{8}T\d{2})\.json$")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    auth.init_db()  # create the accounts tables on first run
    yield


app = FastAPI(
    title="AtmosFusion API",
    description="Live multi-model forecast blending (Open-Meteo forecasts, IMD truth) and user accounts",
    version="3.0.0",
    lifespan=lifespan,
)
app.include_router(accounts.router)

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ATMOSFUSION_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://localhost:4173,http://127.0.0.1:4173",
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
    info = {"status": "operational", "service": "AtmosFusion API v3", "cycle": None}
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

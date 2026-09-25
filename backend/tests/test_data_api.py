"""Data endpoints serve the pipeline's exports verbatim and never invent data."""

import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from main import app

EXPORTS = Path(os.environ["ATMOSFUSION_EXPORTS"])


def cycle_doc(init: str) -> dict:
    return {
        "version": 1,
        "generated_at": "2026-09-25T15:00:00+00:00",
        "issue": {"init_utc": init, "lead_dates": {"1": "2026-09-27"}},
        "truth": {"latest_rain_truth_date": "2026-09-24"},
        "sources": [{"id": "gfs_global", "live": True}, {"id": "bom_access_global", "live": False}],
        "points": [{"id": "mumbai"}],
        "forecasts": [],
    }


@pytest.fixture()
def client():
    for f in EXPORTS.glob("*.json") if EXPORTS.exists() else []:
        f.unlink()
    with TestClient(app) as c:
        yield c


def write(name: str, doc: dict):
    EXPORTS.mkdir(parents=True, exist_ok=True)
    (EXPORTS / name).write_text(json.dumps(doc), encoding="utf-8")


def test_no_cycle_yet_is_an_explicit_503(client):
    assert client.get("/api/v1/health").json()["status"] == "no_cycle"
    r = client.get("/api/v1/cycle")
    assert r.status_code == 503 and "run_cycle" in r.json()["detail"]
    assert client.get("/api/v1/scorecard").status_code == 503
    assert client.get("/api/v1/validation").status_code == 503


def test_latest_cycle_and_health(client):
    write("latest.json", cycle_doc("2026-09-25T06:00:00+00:00"))
    write("cycle_20260925T06.json", cycle_doc("2026-09-25T06:00:00+00:00"))
    assert client.get("/api/v1/cycle").json()["issue"]["init_utc"].startswith("2026-09-25T06")
    h = client.get("/api/v1/health").json()
    assert h["status"] == "operational"
    assert h["cycle"]["live_sources"] == 1 and h["cycle"]["points"] == 1


def test_issues_listing_and_lookup(client):
    for issue, init in [("20260924T06", "2026-09-24T06:00:00+00:00"), ("20260925T06", "2026-09-25T06:00:00+00:00")]:
        write(f"cycle_{issue}.json", cycle_doc(init))
    assert client.get("/api/v1/cycles").json()["issues"] == ["20260925T06", "20260924T06"]
    assert client.get("/api/v1/cycle?issue=20260924T06").json()["issue"]["init_utc"].startswith("2026-09-24")
    assert client.get("/api/v1/cycle?issue=20200101T00").status_code == 404
    assert client.get("/api/v1/cycle?issue=../../etc").status_code == 422  # no path traversal


def test_scorecard_is_served_verbatim(client):
    doc = {"rows": [{"lead": 1, "method": "AtmosFusion (Stage A)", "rmse": 13.9}]}
    write("scorecard.json", doc)
    assert client.get("/api/v1/scorecard").json() == doc


def test_validation_report_is_served_verbatim(client):
    doc = {"chosen_stage_b": "E4 Stage B", "scores": [{"lead": 1, "method": "E3 Stage A", "rmse": 14.2}]}
    write("validation.json", doc)
    assert client.get("/api/v1/validation").json() == doc

import datetime as dt
import json

import pytest
from fastapi.testclient import TestClient

import main
from services import telemetry
from services.forecast_status import publication_status


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "EXPORTS_DIR", tmp_path)
    monkeypatch.setenv("BHAROSA_ADMIN_USER_IDS", "")
    with TestClient(main.app) as client:
        yield client


def test_stale_publication_does_not_become_fresh_when_republished(tmp_path):
    now = dt.datetime(2026, 9, 28, tzinfo=dt.UTC)
    doc = {
        "issue": {"init_utc": "2026-09-20T00:00:00Z"},
        "generated_at": now.isoformat(),
        "sources": [],
        "points": [],
        "forecasts": [{"values": {"model": 10}}],
    }
    (tmp_path / "latest.json").write_text(json.dumps(doc))
    assert publication_status(tmp_path, now)["status"] == "stale"
    doc["issue"]["init_utc"] = "2099-01-01T00:00:00Z"
    (tmp_path / "latest.json").write_text(json.dumps(doc))
    assert publication_status(tmp_path, now)["status"] == "invalid_timestamp"


def test_corrupt_export_is_explicit_and_not_operational(client, tmp_path):
    (tmp_path / "latest.json").write_text("{unfinished")
    assert client.get("/api/v1/health").json()["status"] == "invalid_export"
    assert client.get("/api/v1/cycle").status_code == 503


def test_unknown_district_never_requests_pune(client, tmp_path, monkeypatch):
    def forbidden(_):
        pytest.fail("Unknown location must not call a provider")

    monkeypatch.setattr(main, "context_for", forbidden)
    assert client.get("/api/v1/telemetry?point_id=unknown").status_code == 503
    (tmp_path / "latest.json").write_text(json.dumps({"issue": {}, "sources": [], "points": [], "forecasts": []}))
    assert client.get("/api/v1/telemetry?point_id=unknown").status_code == 404
    assert client.get("/api/v1/telemetry?point_id=../../pune").status_code == 422


def test_modelled_context_preserves_zero_and_independent_failure(monkeypatch):
    telemetry._CACHE.clear()

    def fetch(host, params):
        if "air-quality" in host:
            return {"status": "unavailable", "data": None, "units": {}}
        return {"status": "available", "data": {"time": "2026-09-28T00:00", "soil_moisture_0_to_1cm": 0}, "units": {}}

    monkeypatch.setattr(telemetry, "fetch_product", fetch)
    out = telemetry.context_for({"id": "pune-ghats", "name": "Pune Ghats", "lat": 18.5, "lon": 73.4})
    assert out["surface"]["soil_moisture_0_to_1cm"] == 0
    assert out["products"]["air_quality"]["status"] == "unavailable"
    assert out["products"]["surface"]["kind"] == "modelled"
    assert out["products"]["marine"]["status"] == "not_applicable"


def test_administrator_permission_cannot_be_self_assigned(client, monkeypatch):
    assert client.get("/api/v1/admin/overview").status_code == 401
    signup = client.post(
        "/api/v1/auth/signup", json={"name": "Ops test", "email": "ops-test@example.test", "password": "test-password-123"}
    )
    assert signup.status_code == 201
    account = signup.json()
    headers = {"Authorization": "Bearer " + account["token"]}
    assert client.get("/api/v1/admin/overview", headers=headers).status_code == 403
    client.patch("/api/v1/users/me", json={"role": "forecaster", "is_admin": True}, headers=headers)
    assert client.get("/api/v1/admin/overview", headers=headers).status_code == 403
    monkeypatch.setenv("BHAROSA_ADMIN_USER_IDS", str(account["user"]["id"]))
    assert client.get("/api/v1/auth/me", headers=headers).json()["is_admin"] is True
    response = client.get("/api/v1/admin/overview", headers=headers)
    assert response.status_code == 200
    assert "total" in response.json()["users"]
    monkeypatch.setenv("BHAROSA_ADMIN_USER_IDS", "")
    assert client.get("/api/v1/admin/overview", headers=headers).status_code == 403


def test_timestamp_without_measurements_is_unavailable(monkeypatch):
    import io

    def request(*args, **kwargs):
        return io.BytesIO(b'{"current":{"time":"2026-09-28T00:00","pm2_5":null}}')

    monkeypatch.setattr(telemetry.urllib.request, "urlopen", request)
    result = telemetry.fetch_product("https://example.test", {"current": "pm2_5"})
    assert result["status"] == "unavailable"


def test_nested_corrupt_publication_is_not_operational(tmp_path):
    doc = {"issue": {}, "sources": [1], "points": [], "forecasts": [None]}
    (tmp_path / "latest.json").write_text(json.dumps(doc))
    assert publication_status(tmp_path)["status"] == "invalid_export"

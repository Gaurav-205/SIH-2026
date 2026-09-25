"""
Account flow tests: sign up -> log in -> profile -> preferences -> password -> delete.
Run from backend/:  python -m pytest -q
"""

import uuid

import pytest
from fastapi.testclient import TestClient

import auth
from main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:  # runs the lifespan, which creates the tables
        yield c


def _email() -> str:
    return f"user-{uuid.uuid4().hex[:8]}@example.com"


def _signup(client, email=None, password="monsoon-2026", name="Asha Rao"):
    return client.post("/api/v1/auth/signup", json={"name": name, "email": email or _email(), "password": password})


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_signup_returns_token_and_default_preferences(client):
    r = _signup(client, email="  Asha@Example.COM ".replace("Asha", f"asha{uuid.uuid4().hex[:6]}"))
    assert r.status_code == 201
    body = r.json()
    assert body["token"].count(".") == 2
    user = body["user"]
    assert user["email"] == user["email"].strip().lower()
    assert user["onboarded"] is False
    assert user["home_region"] == "konkan" and user["lead_day"] == 1 and user["theme"] == "light"
    assert "password" not in str(user)


def test_signup_rejects_duplicates_and_bad_input(client):
    email = _email()
    assert _signup(client, email=email).status_code == 201
    assert _signup(client, email=email.upper()).status_code == 409
    assert _signup(client, password="short").status_code == 422
    assert _signup(client, email="not-an-email").status_code == 422
    assert _signup(client, name="   ").status_code == 422


def test_password_is_hashed_at_rest(client):
    email = _email()
    _signup(client, email=email, password="plain-text-pass")
    with auth.db() as conn:
        stored = conn.execute("SELECT password_hash FROM users WHERE email = ?", (email,)).fetchone()[0]
    assert stored.startswith("pbkdf2_sha256$") and "plain-text-pass" not in stored


def test_login_and_me(client):
    email = _email()
    _signup(client, email=email)
    r = client.post("/api/v1/auth/login", json={"email": email.upper(), "password": "monsoon-2026"})
    assert r.status_code == 200
    me = client.get("/api/v1/auth/me", headers=_bearer(r.json()["token"]))
    assert me.status_code == 200 and me.json()["email"] == email


def test_login_failures_are_generic_and_throttled(client):
    email = _email()
    _signup(client, email=email)
    wrong = client.post("/api/v1/auth/login", json={"email": email, "password": "wrong-password"})
    unknown = client.post("/api/v1/auth/login", json={"email": _email(), "password": "whatever-123"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["detail"] == unknown.json()["detail"]
    for _ in range(5):
        client.post("/api/v1/auth/login", json={"email": email, "password": "wrong-password"})
    assert client.post("/api/v1/auth/login", json={"email": email, "password": "monsoon-2026"}).status_code == 429


def test_protected_routes_need_a_valid_token(client):
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/auth/me", headers=_bearer("abc.def.ghi")).status_code == 401
    token = _signup(client).json()["token"]
    header, payload, sig = token.split(".")
    tampered = f"{header}.{payload}.{sig[:-2]}xx"
    assert client.get("/api/v1/auth/me", headers=_bearer(tampered)).status_code == 401


def test_update_preferences_and_onboarding(client):
    token = _signup(client).json()["token"]
    r = client.patch(
        "/api/v1/users/me",
        headers=_bearer(token),
        json={"role": "disaster_manager", "home_region": "kerala", "lead_day": 3, "alert_threshold": 64.5, "theme": "dark", "onboarded": True},
    )
    assert r.status_code == 200
    user = r.json()
    assert (user["role"], user["home_region"], user["lead_day"], user["alert_threshold"], user["theme"], user["onboarded"]) == (
        "disaster_manager", "kerala", 3, 64.5, "dark", True,
    )
    assert client.patch("/api/v1/users/me", headers=_bearer(token), json={"lead_day": 9}).status_code == 422
    assert client.patch("/api/v1/users/me", headers=_bearer(token), json={"home_region": "mars"}).status_code == 422


def test_change_password(client):
    email = _email()
    token = _signup(client, email=email).json()["token"]
    bad = client.post("/api/v1/users/me/password", headers=_bearer(token), json={"current_password": "nope", "new_password": "new-secret-99"})
    assert bad.status_code == 400
    ok = client.post("/api/v1/users/me/password", headers=_bearer(token), json={"current_password": "monsoon-2026", "new_password": "new-secret-99"})
    assert ok.status_code == 204
    assert client.post("/api/v1/auth/login", json={"email": email, "password": "new-secret-99"}).status_code == 200


def test_alert_acknowledgements(client):
    token = _signup(client).json()["token"]
    h = _bearer(token)
    assert client.put("/api/v1/alerts/acks/station:pune-lavasa:D1", headers=h).status_code == 200
    assert [a["alert_id"] for a in client.get("/api/v1/alerts/acks", headers=h).json()] == ["station:pune-lavasa:D1"]
    assert client.delete("/api/v1/alerts/acks/station:pune-lavasa:D1", headers=h).status_code == 204
    assert client.get("/api/v1/alerts/acks", headers=h).json() == []
    assert client.put("/api/v1/alerts/acks/bad id!", headers=h).status_code == 422


def test_delete_account(client):
    email = _email()
    token = _signup(client, email=email).json()["token"]
    assert client.post("/api/v1/users/me/delete", headers=_bearer(token), json={"password": "wrong"}).status_code == 400
    assert client.post("/api/v1/users/me/delete", headers=_bearer(token), json={"password": "monsoon-2026"}).status_code == 204
    assert client.get("/api/v1/auth/me", headers=_bearer(token)).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": email, "password": "monsoon-2026"}).status_code == 401

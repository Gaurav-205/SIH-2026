"""
Bharosa accounts: storage, password hashing and access tokens.
Standard library only (sqlite3, hashlib, hmac) so the backend needs no extra dependencies.
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from collections.abc import Iterator
from contextlib import contextmanager

_default_db = (
    "bharosa.db"
    if not os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), "atmosfusion.db"))
    or os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), "bharosa.db"))
    else "atmosfusion.db"
)
DB_PATH = os.getenv(
    "BHAROSA_DB",
    os.getenv(
        "ATMOSFUSION_DB",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), _default_db),
    ),
)
TOKEN_TTL_SECONDS = int(os.getenv("BHAROSA_TOKEN_TTL", os.getenv("ATMOSFUSION_TOKEN_TTL", str(7 * 24 * 3600))))  # 7 days
PBKDF2_ITERATIONS = 210_000

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    email           TEXT    NOT NULL UNIQUE,
    password_hash   TEXT    NOT NULL,
    role            TEXT    NOT NULL DEFAULT 'forecaster',
    home_region     TEXT    NOT NULL DEFAULT 'konkan',
    lead_day        INTEGER NOT NULL DEFAULT 1,
    alert_threshold REAL    NOT NULL DEFAULT 115.6,
    theme           TEXT    NOT NULL DEFAULT 'light',
    onboarded       INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS alert_acks (
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_id  TEXT    NOT NULL,
    acked_at  TEXT    NOT NULL,
    PRIMARY KEY (user_id, alert_id)
);
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


# ── Database ────────────────────────────────────────────────

@contextmanager
def db() -> Iterator[sqlite3.Connection]:
    """One short-lived connection per call; commits on success."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with db() as conn:
        conn.executescript(SCHEMA)


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# ── Passwords ───────────────────────────────────────────────

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt_hex, digest_hex = stored.split("$")
    except ValueError:
        return False
    if algo != "pbkdf2_sha256":
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations))
    return hmac.compare_digest(digest.hex(), digest_hex)


# A real hash to compare against when the email is unknown, so response time
# does not reveal whether an account exists.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(12))


def check_login(email: str, password: str) -> sqlite3.Row | None:
    with db() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if row is None:
        verify_password(password, _DUMMY_HASH)
        return None
    return row if verify_password(password, row["password_hash"]) else None


# ── Tokens (JWT, HS256) ─────────────────────────────────────

def _secret() -> bytes:
    env = os.getenv("BHAROSA_SECRET", os.getenv("ATMOSFUSION_SECRET"))
    if env:
        return env.encode()
    # Persist a generated secret so tokens survive backend restarts
    with db() as conn:
        row = conn.execute("SELECT value FROM meta WHERE key = 'token_secret'").fetchone()
        if row:
            return row["value"].encode()
        value = secrets.token_urlsafe(48)
        conn.execute("INSERT INTO meta (key, value) VALUES ('token_secret', ?)", (value,))
        return value.encode()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def create_token(user_id: int) -> str:
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    now = int(time.time())
    payload = _b64(json.dumps({"sub": str(user_id), "iat": now, "exp": now + TOKEN_TTL_SECONDS}, separators=(",", ":")).encode())
    signing_input = f"{header}.{payload}".encode()
    signature = _b64(hmac.new(_secret(), signing_input, hashlib.sha256).digest())
    return f"{header}.{payload}.{signature}"


def decode_token(token: str) -> int | None:
    """Returns the user id for a valid, unexpired token, else None."""
    try:
        header, payload, signature = token.split(".")
        expected = _b64(hmac.new(_secret(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            return None
        if json.loads(_unb64(header)).get("alg") != "HS256":
            return None
        claims = json.loads(_unb64(payload))
        if int(claims["exp"]) < time.time():
            return None
        return int(claims["sub"])
    except (ValueError, KeyError, json.JSONDecodeError):
        return None


# ── Login throttling ────────────────────────────────────────

_MAX_FAILURES = 5
_WINDOW_SECONDS = 300
_failures: dict[str, list[float]] = {}


def too_many_failures(key: str) -> bool:
    recent = [t for t in _failures.get(key, []) if time.time() - t < _WINDOW_SECONDS]
    _failures[key] = recent
    return len(recent) >= _MAX_FAILURES


def record_failure(key: str) -> None:
    _failures.setdefault(key, []).append(time.time())


def clear_failures(key: str) -> None:
    _failures.pop(key, None)

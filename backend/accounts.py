"""
Account endpoints: sign up, log in, profile and preferences, password, alert acknowledgements.
"""

import re
import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Response, status
from pydantic import BaseModel, Field, field_validator

import auth

router = APIRouter(prefix="/api/v1", tags=["accounts"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

Role = Literal["forecaster", "disaster_manager", "researcher", "other"]
Region = Literal["konkan", "kerala"]
Theme = Literal["light", "dark", "system"]
Threshold = Literal[64.5, 115.6, 204.5]


# ── Schemas ─────────────────────────────────────────────────

def _normalise_email(value: str) -> str:
    value = value.strip().lower()
    if not EMAIL_RE.match(value) or len(value) > 254:
        raise ValueError("Enter a valid email address")
    return value


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def _check_email(cls, v: str) -> str:
        return _normalise_email(v)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def _lower_email(cls, v: str) -> str:
        return v.strip().lower()


class UserOut(BaseModel):
    is_admin: bool = False
    id: int
    name: str
    email: str
    role: Role
    home_region: Region
    lead_day: int
    alert_threshold: float
    theme: Theme
    onboarded: bool
    created_at: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class PreferencesUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    role: Role | None = None
    home_region: Region | None = None
    lead_day: int | None = Field(default=None, ge=1, le=5)
    alert_threshold: Threshold | None = None
    theme: Theme | None = None
    onboarded: bool | None = None


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class PasswordConfirm(BaseModel):
    password: str = Field(min_length=1, max_length=128)


class AlertAck(BaseModel):
    alert_id: str
    acked_at: str


def _user_out(row: sqlite3.Row) -> UserOut:
    return UserOut(
        is_admin=auth.is_admin(row["id"]),
        id=row["id"],
        name=row["name"],
        email=row["email"],
        role=row["role"],
        home_region=row["home_region"],
        lead_day=row["lead_day"],
        alert_threshold=row["alert_threshold"],
        theme=row["theme"],
        onboarded=bool(row["onboarded"]),
        created_at=row["created_at"],
    )


# ── Current user dependency ─────────────────────────────────

def current_user(authorization: str | None = Header(default=None)) -> sqlite3.Row:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not signed in or session expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not authorization or not authorization.lower().startswith("bearer "):
        raise unauthorized
    user_id = auth.decode_token(authorization.split(" ", 1)[1].strip())
    if user_id is None:
        raise unauthorized
    with auth.db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise unauthorized
    return row


# ── Auth ────────────────────────────────────────────────────

@router.post("/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest):
    try:
        with auth.db() as conn:
            cur = conn.execute(
                "INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (body.name, body.email, auth.hash_password(body.password), auth.now_iso()),
            )
            row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="An account with this email already exists") from None
    return AuthResponse(token=auth.create_token(row["id"]), user=_user_out(row))


@router.post("/auth/login", response_model=AuthResponse)
def login(body: LoginRequest):
    if auth.too_many_failures(body.email):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in a few minutes.")
    row = auth.check_login(body.email, body.password)
    if row is None:
        auth.record_failure(body.email)
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    auth.clear_failures(body.email)
    return AuthResponse(token=auth.create_token(row["id"]), user=_user_out(row))


@router.get("/auth/me", response_model=UserOut)
def me(user: sqlite3.Row = Depends(current_user)):
    return _user_out(user)


# ── Profile & preferences ───────────────────────────────────

@router.patch("/users/me", response_model=UserOut)
def update_me(body: PreferencesUpdate, user: sqlite3.Row = Depends(current_user)):
    changes = body.model_dump(exclude_none=True)
    if "name" in changes:
        changes["name"] = changes["name"].strip()
        if not changes["name"]:
            raise HTTPException(status_code=422, detail="Name is required")
    if "onboarded" in changes:
        changes["onboarded"] = int(changes["onboarded"])
    with auth.db() as conn:
        if changes:
            # Column names come from the validated schema above, never from raw input
            assignments = ", ".join(f"{k} = ?" for k in changes)
            conn.execute(f"UPDATE users SET {assignments} WHERE id = ?", (*changes.values(), user["id"]))
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    return _user_out(row)


@router.post("/users/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(body: PasswordChange, user: sqlite3.Row = Depends(current_user)):
    if not auth.verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    with auth.db() as conn:
        conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (auth.hash_password(body.new_password), user["id"]))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/users/me/delete", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(body: PasswordConfirm, user: sqlite3.Row = Depends(current_user)):
    if not auth.verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Password is incorrect")
    with auth.db() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (user["id"],))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Alert acknowledgements ──────────────────────────────────

ALERT_ID_PATTERN = r"^[A-Za-z0-9_.:\-]+$"


@router.get("/alerts/acks", response_model=list[AlertAck])
def list_acks(user: sqlite3.Row = Depends(current_user)):
    with auth.db() as conn:
        rows = conn.execute(
            "SELECT alert_id, acked_at FROM alert_acks WHERE user_id = ? ORDER BY acked_at DESC", (user["id"],)
        ).fetchall()
    return [AlertAck(alert_id=r["alert_id"], acked_at=r["acked_at"]) for r in rows]


@router.put("/alerts/acks/{alert_id}", response_model=AlertAck)
def ack_alert(alert_id: str = Path(min_length=1, max_length=120, pattern=ALERT_ID_PATTERN), user: sqlite3.Row = Depends(current_user)):
    acked_at = auth.now_iso()
    with auth.db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO alert_acks (user_id, alert_id, acked_at) VALUES (?, ?, ?)",
            (user["id"], alert_id, acked_at),
        )
    return AlertAck(alert_id=alert_id, acked_at=acked_at)


@router.delete("/alerts/acks/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def unack_alert(alert_id: str = Path(min_length=1, max_length=120, pattern=ALERT_ID_PATTERN), user: sqlite3.Row = Depends(current_user)):
    with auth.db() as conn:
        conn.execute("DELETE FROM alert_acks WHERE user_id = ? AND alert_id = ?", (user["id"], alert_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)

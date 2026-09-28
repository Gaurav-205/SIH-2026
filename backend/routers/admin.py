"""Read-only operations. Professional profile roles never grant administrator access."""

import sqlite3
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

import accounts
import auth
from services.forecast_status import publication_status, read_cycle


def require_admin(user: sqlite3.Row = Depends(accounts.current_user)) -> sqlite3.Row:
    if not auth.is_admin(user["id"]):
        raise HTTPException(status_code=403, detail="Administrator access required")
    return user


def make_router(exports: Path) -> APIRouter:
    router = APIRouter(prefix="/api/v1/admin", tags=["admin"], dependencies=[Depends(require_admin)])

    @router.get("/overview")
    def overview():
        status = publication_status(exports)
        sources = []
        try:
            cycle = read_cycle(exports / "latest.json")
            for source in cycle["sources"]:
                count = sum(source["id"] in f.get("values", {}) for f in cycle["forecasts"])
                sources.append({**source, "record_count": count, "status": "participating" if count else "no_records"})
        except (OSError, ValueError, KeyError, TypeError, AttributeError):
            pass
        with auth.db() as conn:
            users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            onboarded = conn.execute("SELECT COUNT(*) FROM users WHERE onboarded = 1").fetchone()[0]
            acknowledgements = conn.execute("SELECT COUNT(*) FROM alert_acks").fetchone()[0]
        return {
            **status,
            "sources": sources,
            "users": {"total": users, "onboarded": onboarded, "acknowledgements": acknowledgements},
            "exports": {
                "cycles": len(list(exports.glob("cycle_*.json"))),
                "scorecard": (exports / "scorecard.json").exists(),
                "validation": (exports / "validation.json").exists(),
            },
            "capabilities": {"job_logs": False, "pipeline_control": False},
            "note": "Read-only publication monitoring. Source participation is not an upstream API health probe.",
        }

    return router

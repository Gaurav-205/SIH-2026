"""Read-only publication status. Presence is not evidence of freshness."""

import datetime as dt
import json
from pathlib import Path

MAX_AGE_HOURS = 24


def age_hours(value: str | None, now: dt.datetime) -> float | None:
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return None
        age = (now - parsed).total_seconds() / 3600
        return round(age, 2) if age >= -0.25 else None
    except (AttributeError, TypeError, ValueError):
        return None


def read_cycle(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("issue"), dict):
        raise ValueError("Invalid forecast publication")
    for key in ("sources", "points", "forecasts"):
        if not isinstance(data.get(key), list) or not all(isinstance(item, dict) for item in data[key]):
            raise ValueError(f"Invalid {key}")
    return data


def publication_status(exports: Path, now: dt.datetime | None = None) -> dict:
    now = now or dt.datetime.now(dt.UTC)
    result = {
        "status": "no_cycle",
        "service": "Bharosa API v3",
        "cycle": None,
        "checked_at": now.isoformat(),
        "freshness_limit_hours": MAX_AGE_HOURS,
    }
    try:
        c = read_cycle(exports / "latest.json")
        issue_age = age_hours(c["issue"].get("init_utc"), now)
        generated_age = age_hours(c.get("generated_at"), now)
        records = c["forecasts"]
        result["cycle"] = {
            "init_utc": c["issue"].get("init_utc"),
            "generated_at": c.get("generated_at"),
            "live_sources": len({s for f in records for s in f.get("values", {})}),
            "points": len(c["points"]),
            "records": len(records),
            "latest_rain_truth_date": c.get("truth", {}).get("latest_rain_truth_date"),
            "issue_age_hours": issue_age,
            "publication_age_hours": generated_age,
        }
        if issue_age is None or generated_age is None:
            result["status"] = "invalid_timestamp"
        elif max(issue_age, generated_age) > MAX_AGE_HOURS:
            result["status"] = "stale"
        elif not records:
            result["status"] = "no_forecasts"
        else:
            result["status"] = "operational"
    except FileNotFoundError:
        pass
    except (OSError, ValueError, TypeError, KeyError, AttributeError):
        result["status"] = "invalid_export"
    return result

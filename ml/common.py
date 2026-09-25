"""Shared configuration, paths and date helpers for the AtmosFusion ML pipeline."""

from __future__ import annotations

import datetime as dt
import logging
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent.parent  # repository root
CONFIG_PATH = ROOT / "ml" / "config.yaml"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@lru_cache(maxsize=1)
def config() -> dict[str, Any]:
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)


def path(key: str, *parts: str) -> Path:
    """Absolute path under one of the configured project directories, created on demand."""
    p = ROOT / config()["project"][key]
    p = p.joinpath(*parts)
    p.mkdir(parents=True, exist_ok=True)
    return p


def resolve_date(value: str, today: dt.date | None = None) -> dt.date:
    """Parse an ISO date, or 'today' / 'today-N' relative to the current UTC date."""
    today = today or dt.datetime.now(dt.UTC).date()
    if value == "today":
        return today
    if value.startswith("today-"):
        return today - dt.timedelta(days=int(value.split("-", 1)[1]))
    return dt.date.fromisoformat(value)


@dataclass(frozen=True)
class Point:
    id: str
    region: str
    name: str
    lat: float
    lon: float


@dataclass(frozen=True)
class Source:
    id: str
    family: str
    label: str
    first_date: dt.date
    max_lead: int
    skip_vars: tuple[str, ...] = ()
    last_date: dt.date | None = None   # archive end for discontinued models
    live: bool = True                  # served by the live Forecast API
    meta: str | None = None            # Open-Meteo metadata domain (run init time)
    provider: str = "openmeteo"        # openmeteo (Previous Runs API) | zarr (ml/ingest/zarr_archive.py)


def points() -> list[Point]:
    return [Point(**p) for p in config()["points"]]


def sources() -> list[Source]:
    leads = config()["leads"]
    return [
        Source(
            id=s["id"],
            family=s["family"],
            label=s["label"],
            first_date=dt.date.fromisoformat(s["first_date"]),
            max_lead=int(s.get("max_lead", max(leads))),
            skip_vars=tuple(s.get("skip_vars", ())),
            last_date=dt.date.fromisoformat(s["last_date"]) if s.get("last_date") else None,
            live=bool(s.get("live", True)),
            meta=s.get("meta"),
            provider=s.get("provider", "openmeteo"),
        )
        for s in config()["sources"]
    ]


def date_chunks(start: dt.date, end: dt.date, days: int) -> list[tuple[dt.date, dt.date]]:
    """Split [start, end] into consecutive inclusive chunks of at most `days` days."""
    out, cur = [], start
    while cur <= end:
        stop = min(end, cur + dt.timedelta(days=days - 1))
        out.append((cur, stop))
        cur = stop + dt.timedelta(days=1)
    return out

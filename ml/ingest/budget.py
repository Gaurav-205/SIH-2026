"""Weighted call accounting for the Open-Meteo free tier.

Open-Meteo counts a request as locations x max(1, variables/10) x max(1, days/14) calls, with
limits per minute, hour and day. We record every request's weight in a small JSON log so
limits hold across restarts, and wait (or stop for the day) before exceeding them.
"""

from __future__ import annotations

import json
import logging
import math
import time
from pathlib import Path

log = logging.getLogger("budget")

WINDOWS = {"minute": 60, "hour": 3600, "day": 86400}


def call_weight(n_locations: int, n_variables: int, n_days: int) -> float:
    return n_locations * max(1.0, n_variables / 10) * max(1.0, n_days / 14)


class DailyLimitReached(RuntimeError):
    pass


class Budget:
    def __init__(self, log_path: Path, limits: dict[str, float], clock=time.time, sleep=time.sleep):
        self.path = log_path
        self.limits = limits
        self.clock = clock
        self.sleep = sleep
        self.events: list[tuple[float, float]] = []
        if log_path.exists():
            self.events = [tuple(e) for e in json.loads(log_path.read_text())]

    def used(self, window: str) -> float:
        cutoff = self.clock() - WINDOWS[window]
        return sum(w for t, w in self.events if t > cutoff)

    def _save(self):
        cutoff = self.clock() - WINDOWS["day"]
        self.events = [e for e in self.events if e[0] > cutoff]
        self.path.write_text(json.dumps(self.events))

    def acquire(self, weight: float, stop_at_daily_limit: bool = True) -> None:
        """Block until `weight` fits in every window, then record it."""
        if weight > self.limits["minute"]:
            raise ValueError(f"single request weight {weight:.0f} exceeds the per-minute limit")
        while True:
            if self.used("day") + weight > self.limits["day"]:
                if stop_at_daily_limit:
                    raise DailyLimitReached(f"daily budget used: {self.used('day'):.0f}/{self.limits['day']}")
                self._wait_for("day", weight)
                continue
            waited = False
            for window in ("hour", "minute"):
                if self.used(window) + weight > self.limits[window]:
                    self._wait_for(window, weight)
                    waited = True
            if not waited:
                break
        self.events.append((self.clock(), weight))
        self._save()

    def _wait_for(self, window: str, weight: float) -> None:
        """Sleep until enough old events leave the window."""
        cutoff_span = WINDOWS[window]
        now = self.clock()
        need = self.used(window) + weight - self.limits[window]
        freed, wait_until = 0.0, now
        for t, w in sorted(e for e in self.events if e[0] > now - cutoff_span):
            freed += w
            wait_until = t + cutoff_span
            if freed >= need:
                break
        delay = max(1.0, math.ceil(wait_until - now) + 1)
        log.info("rate limit: waiting %.0fs for the %s window", delay, window)
        self.sleep(delay)

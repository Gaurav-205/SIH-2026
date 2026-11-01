"""Live fetch: one failing provider must not stop the publication."""

import datetime as dt

import pandas as pd
import pytest
import requests

from ml.common import sources
from ml.live import forecast


class _FakeBudget:
    def __init__(self, *_args):
        pass

    def acquire(self, _weight):
        pass


class _Response:
    def __init__(self, body):
        self._body = body

    def raise_for_status(self):
        pass

    def json(self):
        return self._body


class _Session:
    """Answers every request with zero rain, except the listed models, which time out."""

    def __init__(self, failing):
        self.failing = failing

    def get(self, _url, timeout, params):
        assert timeout == 60
        if params["models"] in self.failing:
            raise requests.ReadTimeout("timed out")
        hours = pd.date_range("2026-11-01", periods=24 * (params["forecast_days"] + 1), freq="h").strftime("%Y-%m-%dT%H:%M")
        hourly = {name: [0.0] * len(hours) for name in params["hourly"].split(",")}
        return _Response([{"hourly": {"time": list(hours), **hourly}} for _ in params["latitude"].split(",")])


def _fetch(monkeypatch, failing):
    monkeypatch.setattr(forecast, "Budget", _FakeBudget)
    monkeypatch.setattr(forecast, "_session", lambda: _Session(failing))
    return forecast.fetch_live(dt.datetime(2026, 11, 2, tzinfo=dt.UTC))


def test_one_failing_source_is_left_out(monkeypatch):
    live = [s.id for s in sources() if s.live]
    df = _fetch(monkeypatch, {live[0]})
    assert set(df["source"]) == set(live) - {live[0]}


def test_most_sources_failing_stops_the_cycle(monkeypatch):
    live = [s.id for s in sources() if s.live]
    with pytest.raises(RuntimeError, match="live forecasts unavailable"):
        _fetch(monkeypatch, set(live[: len(live) // 2 + 1]))

"""Tests for day alignment, units/validation, rate limiting and backfill planning."""

import datetime as dt

import numpy as np
import pandas as pd
import pytest

from ml.common import date_chunks, resolve_date
from ml.ingest import openmeteo
from ml.ingest.budget import Budget, DailyLimitReached, call_weight
from ml.ingest.daily import aggregate, local_day, mask_implausible, rain_windows, validate_daily
from ml.ingest.openmeteo import pending, plan_tasks

DAYS_CFG = {"rain_window_end_utc_hour": 3, "rain_label_offset_days": 0, "other_vars_tz": "Asia/Kolkata"}


def hourly(start: str, hours: int, values=None) -> pd.Series:
    idx = pd.date_range(start, periods=hours, freq="h", tz="UTC")
    return pd.Series(np.ones(hours) if values is None else values, index=idx, name="value")


# ── Day alignment ───────────────────────────────────────────

def test_rain_window_ends_at_03_utc_and_is_labelled_by_end_date():
    # 1 mm every hour from 2024-07-01 00:00 to 2024-07-03 23:00 UTC
    s = hourly("2024-07-01 00:00", 72)
    daily = rain_windows(s)
    # Window ending 2024-07-02 03:00 covers stamps 07-01 04:00..07-02 03:00 -> complete, 24 mm
    assert daily.loc[pd.Timestamp("2024-07-02")] == 24
    # Window ending 07-01 03:00 needs 06-30 04:00.. -> incomplete -> NaN, never a partial sum
    assert np.isnan(daily.loc[pd.Timestamp("2024-07-01")])


def test_rain_window_boundaries_are_exact():
    # Put all rain in the single hour stamped 03:00 (the last hour of the window ending that day)
    values = np.zeros(72)
    values[24 + 3] = 10.0  # 2024-07-02 03:00 UTC
    daily = rain_windows(hourly("2024-07-01 00:00", 72, values))
    assert daily.loc[pd.Timestamp("2024-07-02")] == 10.0
    assert daily.loc[pd.Timestamp("2024-07-03")] == 0.0
    # ...and the hour stamped 04:00 starts the next window
    values = np.zeros(72)
    values[24 + 4] = 10.0  # 2024-07-02 04:00 UTC
    daily = rain_windows(hourly("2024-07-01 00:00", 72, values))
    assert daily.loc[pd.Timestamp("2024-07-02")] == 0.0
    assert daily.loc[pd.Timestamp("2024-07-03")] == 10.0


def test_missing_hour_makes_the_day_missing():
    values = np.ones(72)
    values[10] = np.nan  # 07-01 10:00 UTC, inside the window ending 07-02 03:00
    daily = rain_windows(hourly("2024-07-01 00:00", 72, values))
    assert np.isnan(daily.loc[pd.Timestamp("2024-07-02")])
    assert daily.loc[pd.Timestamp("2024-07-03")] == 24  # the next window is unaffected


def test_tmax_uses_the_ist_calendar_day():
    # IST day 2024-07-02 = UTC 07-01 18:30 .. 07-02 18:30 -> stamps 07-01 19:00 .. 07-02 18:00
    values = np.zeros(72)
    values[24 + 18] = 40.0  # 07-02 18:00 UTC = 23:30 IST on 07-02 -> belongs to 07-02
    values[24 + 19] = 45.0  # 07-02 19:00 UTC = 00:30 IST on 07-03 -> belongs to 07-03
    daily = local_day(hourly("2024-07-01 00:00", 72, values), "max")
    assert daily.loc[pd.Timestamp("2024-07-02")] == 40.0
    assert daily.loc[pd.Timestamp("2024-07-03")] == 45.0


def test_label_offset_shifts_rain_only():
    s = hourly("2024-07-01 00:00", 72)
    shifted = aggregate(s, "rain", {**DAYS_CFG, "rain_label_offset_days": -1})
    assert shifted.loc[pd.Timestamp("2024-07-01")] == 24


def test_naive_index_is_rejected():
    s = pd.Series([1.0], index=pd.DatetimeIndex(["2024-07-01"]))
    with pytest.raises(ValueError):
        rain_windows(s)


# ── Validation ──────────────────────────────────────────────

def test_validation_catches_duplicates_and_infinities():
    df = pd.DataFrame({
        "point_id": ["a", "a", "b"],
        "date": [dt.date(2024, 7, 1)] * 3,
        "var": ["rain", "rain", "wind"],
        "value": [5.0, 5.0, np.inf],
    })
    problems = validate_daily(df, ["point_id", "date", "var"])
    assert any("duplicate" in p for p in problems)
    assert any("infinite" in p for p in problems)


def test_implausible_values_are_masked_and_reported():
    # CMA GRAPES archive case: 'temperature_2m' of about -48 degC over Maharashtra in April 2024
    df = pd.DataFrame({
        "point_id": ["a", "b", "c", "d"],
        "date": [dt.date(2024, 4, 20)] * 4,
        "var": ["tmax", "tmax", "rain", "wind"],
        "value": [-47.8, 38.5, -0.0, 25.0],
    })
    clean, removed = mask_implausible(df)
    assert list(removed["point_id"]) == ["a"]
    assert np.isnan(clean.loc[0, "value"])
    assert clean.loc[1:, "value"].tolist() == [38.5, -0.0, 25.0]  # plausible values untouched
    assert df.loc[0, "value"] == -47.8  # input not mutated


# ── Budget ──────────────────────────────────────────────────

def test_call_weight_matches_open_meteo_rule():
    assert call_weight(1, 3, 7) == 1
    assert call_weight(1, 20, 7) == 2
    assert call_weight(1, 10, 28) == 2
    assert call_weight(29, 15, 93) == pytest.approx(29 * 1.5 * 93 / 14)


class FakeClock:
    def __init__(self):
        self.t = 1_000_000.0
        self.slept = 0.0

    def time(self):
        return self.t

    def sleep(self, s):
        self.t += s
        self.slept += s


def test_budget_waits_for_the_minute_window(tmp_path):
    clock = FakeClock()
    b = Budget(tmp_path / "b.json", {"minute": 100, "hour": 1000, "day": 5000}, clock.time, clock.sleep)
    b.acquire(80)
    b.acquire(80)  # must wait ~60 s for the first to leave the minute window
    assert clock.slept >= 60
    assert b.used("hour") == 160


def test_budget_stops_at_the_daily_limit_and_persists(tmp_path):
    clock = FakeClock()
    log = tmp_path / "b.json"
    b = Budget(log, {"minute": 100, "hour": 1000, "day": 150}, clock.time, clock.sleep)
    b.acquire(100)
    reopened = Budget(log, {"minute": 100, "hour": 1000, "day": 150}, clock.time, clock.sleep)
    with pytest.raises(DailyLimitReached):
        reopened.acquire(100)


# ── Planning ────────────────────────────────────────────────

def test_chunks_cover_each_day_exactly_once():
    chunks = date_chunks(dt.date(2024, 1, 1), dt.date(2024, 12, 31), 91)
    days = [c[0] + dt.timedelta(days=i) for c in chunks for i in range((c[1] - c[0]).days + 1)]
    assert len(days) == len(set(days)) == 366


def test_plan_respects_first_dates_leads_and_limits():
    end = dt.date(2026, 9, 1)
    tasks = plan_tasks(end)
    by_source = {}
    for t in tasks:
        by_source.setdefault(t.source.id, []).append(t)
        assert t.start >= t.source.first_date
        assert t.end <= end
        assert t.weight <= 500, "a single request must fit the per-minute budget"
    # each source's chunks tile its period with no gaps or overlaps
    for src_tasks in by_source.values():
        src_tasks.sort(key=lambda t: t.start)
        for a, b in zip(src_tasks, src_tasks[1:], strict=False):
            assert b.start == a.end + dt.timedelta(days=1)
    arpege = by_source["meteofrance_arpege_world"][0]
    assert all(lead <= 3 for _, lead, _ in arpege.variables)
    assert "wind" not in {var for var, _, _ in arpege.variables}
    assert {lead for _, lead, _ in by_source["gfs_global"][0].variables} == {1, 2, 3, 4, 5}


def test_resolve_date():
    today = dt.date(2026, 9, 25)
    assert resolve_date("today-1", today) == dt.date(2026, 9, 24)
    assert resolve_date("2024-01-01", today) == dt.date(2024, 1, 1)


def test_partial_chunk_resumes_from_its_last_day(tmp_path, monkeypatch):
    """The newest chunk is extended day by day, not re-downloaded in full every run."""

    def fake_path(key, *parts):
        p = tmp_path.joinpath(*parts)
        p.mkdir(parents=True, exist_ok=True)
        return p

    monkeypatch.setattr(openmeteo, "path", fake_path)
    end = dt.date(2026, 9, 20)
    newest = max(t.index for t in plan_tasks(end))
    gfs = next(t for t in plan_tasks(end) if t.source.id == "gfs_global" and t.index == newest)
    assert not gfs.complete and not gfs.resume

    stored = pd.DataFrame({"point_id": "mumbai", "date": pd.date_range(gfs.start, end - dt.timedelta(days=3)).date,
                           "source": "gfs_global", "lead": 1, "var": "rain", "value": 1.0})
    stored.to_parquet(gfs.out_path, index=False)  # the partial file
    resumed = next(t for t in plan_tasks(end) if t.source.id == "gfs_global" and t.index == newest)
    assert resumed.resume
    assert resumed.start == stored["date"].max() - dt.timedelta(days=openmeteo.REFETCH_DAYS - 1)
    assert resumed.weight < gfs.weight / 3

    # a partial chunk stored up to the end date is not pending
    stored.assign(date=end).to_parquet(gfs.out_path, index=False)
    assert all(t.source.id != "gfs_global" or t.index != newest for t in pending(plan_tasks(end)))


def test_zarr_rain_window_integrates_step_rates_exactly():
    from ml.ingest.zarr_archive import integrate_steps, rain_window_hours

    assert rain_window_hours(1) == (3.0, 27.0) and rain_window_hours(5) == (99.0, 123.0)
    # 6-hourly steps, constant 1 mm/h (1/3600 mm/s): any 24 h window is 24 mm
    hours = np.arange(0, 132, 6, dtype=float)
    rate = np.full((len(hours), 2), 1 / 3600)
    assert np.allclose(integrate_steps(hours, rate, (3.0, 27.0)), 24.0)
    # rain only in the step 00-06 UTC of day 2 (hours 24-30): 6 mm; window 3-27 takes hours 24-27 = 3 mm
    rate = np.zeros((len(hours), 1))
    rate[np.searchsorted(hours, 30)] = 1 / 3600
    assert integrate_steps(hours, rate, (3.0, 27.0))[0] == pytest.approx(3.0)
    assert integrate_steps(hours, rate, (27.0, 51.0))[0] == pytest.approx(3.0)
    # a missing step inside the window makes the day missing; a window past the forecast is missing
    rate[np.searchsorted(hours, 12)] = np.nan
    assert np.isnan(integrate_steps(hours, rate, (3.0, 27.0))[0])
    assert np.isnan(integrate_steps(hours, rate, (120.0, 144.0))[0])


def test_ensemble_stats_count_members():
    from ml.ingest.zarr_archive import ensemble_stats

    members = np.array([[0.0], [70.0], [120.0], [np.nan]])
    s = ensemble_stats(members, [64.5, 115.6])
    assert s["n_members"][0] == 3
    assert s["p_ge_64_5"][0] == pytest.approx(2 / 3) and s["p_ge_115_6"][0] == pytest.approx(1 / 3)
    assert s["mean"][0] == pytest.approx(190 / 3)

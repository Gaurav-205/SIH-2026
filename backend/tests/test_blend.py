"""
Invariant tests for the AtmosFusion blending engine.
Run from backend/:  python -m pytest -q
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import RAW_STATION_DATA, get_computed_stations  # noqa: E402
from services.blend import calculate_weights, compute_station_metrics, round_half_up  # noqa: E402

LEAD_DAYS = [1, 2, 3, 5, 7, 10]


def _metrics(raw):
    return compute_station_metrics(
        station_id=raw["id"],
        station_name=raw["name"],
        terrain_type=raw["terrain_type"],
        predictions=raw["model_predictions"],
        recent_mae=raw["recent_mae_48h"],
    )


@pytest.mark.parametrize("raw", RAW_STATION_DATA, ids=lambda r: r["id"])
def test_weights_sum_to_one_and_favour_low_error(raw):
    weights = calculate_weights(raw["recent_mae_48h"])
    assert sum(weights.values()) == pytest.approx(1.0, abs=1e-9)
    by_mae = sorted(raw["recent_mae_48h"], key=raw["recent_mae_48h"].get)
    assert weights[by_mae[0]] == max(weights.values())
    assert weights[by_mae[-1]] == min(weights.values())


@pytest.mark.parametrize("lead_day", LEAD_DAYS)
def test_physical_invariants_hold_at_every_lead_day(lead_day):
    for s in get_computed_stations(lead_day):
        blend = sum(s.model_predictions[m] * s.assigned_weights[m] for m in s.model_predictions)
        assert s.consensus_blend == pytest.approx(round_half_up(blend, 1), abs=1e-9)
        assert min(s.model_predictions.values()) <= s.consensus_blend <= max(s.model_predictions.values())
        assert s.p_heavy_rain >= s.p_very_heavy >= s.p_extremely_heavy
        assert s.worst_case_90th >= s.consensus_blend >= 0
        assert 0 <= s.consensus_humidity <= 100
        assert (s.alert_level is None) == (s.active_alert is None)


@pytest.mark.parametrize("raw", RAW_STATION_DATA, ids=lambda r: r["id"])
def test_quantile_curve_is_monotonic(raw):
    for p in _metrics(raw).quantile_curve:
        assert 0 <= p.p10 <= p.p50 <= p.p90


def test_orographic_peak_is_preserved_at_lavasa():
    """The headline case: skill weighting keeps the cloudburst signal that flat averaging washes out."""
    raw = next(r for r in RAW_STATION_DATA if r["id"] == "pune-lavasa")
    m = _metrics(raw)
    observed = raw["observed_rain_24h"]
    assert m.simple_average == pytest.approx(114.2)
    assert abs(m.consensus_blend - observed) < abs(m.simple_average - observed)
    assert m.alert_level == "Red"


def test_round_half_up_matches_javascript():
    # Python's round() is half-to-even; JavaScript's Math.round is half-up
    assert round_half_up(0.5) == 1
    assert round_half_up(2.5) == 3
    assert round_half_up(-2.5) == -2

"""Stage A ledger and blend: leakage rule, weights, probability/quantile ordering, fallbacks.
Inputs here are synthetic fixtures for testing only; nothing from them is served."""

import datetime as dt

import numpy as np
import pandas as pd
import pytest

from ml.common import points
from ml.live.forecast import first_valid_date
from ml.live.stage_a import alert_level, blend_one, ledger, reasons

P = points()[0].id


def archive(days=40, end="2024-07-31", sources=("a", "b"), lead=1, errors=None):
    dates = pd.date_range(end=end, periods=days, freq="D")
    rows, truth = [], []
    for d in dates:
        truth.append((P, d, "rain", 20.0))
        for s in sources:
            rows.append((P, d, s, lead, "rain", 20.0 + (errors or {}).get(s, 0.0)))
    fc = pd.DataFrame(rows, columns=["point_id", "date", "source", "lead", "var", "value"])
    tr = pd.DataFrame(truth, columns=["point_id", "date", "var", "obs"])
    return fc, tr


def at_point(led: pd.DataFrame) -> pd.DataFrame:
    """Ledger rows for the district under test (other districts get region-pooled rows)."""
    return led[led["point_id"] == P].set_index("source")


def test_ledger_never_uses_forecasts_valid_after_as_of():
    fc, tr = archive(days=60, errors={"a": 2.0, "b": 8.0})
    as_of = pd.Timestamp("2024-07-10")
    # Poison everything after as_of: if the ledger peeked, source a's error would explode
    fc.loc[(fc["date"] > as_of) & (fc["source"] == "a"), "value"] = 500.0
    led = at_point(ledger(fc, tr, as_of))
    assert led.loc["a", "mae"] == pytest.approx(2.0)
    assert led.loc["b", "mae"] == pytest.approx(8.0)
    assert (led["as_of"] == as_of).all()


def test_ledger_needs_min_pairs_then_pools_by_region():
    fc, tr = archive(days=5)  # below min_pairs at the point
    led = ledger(fc, tr, pd.Timestamp("2024-07-31"))
    assert led.empty  # the region has only this point's 5 days too -> still below min_pairs
    fc, tr = archive(days=30)
    led = ledger(fc, tr, pd.Timestamp("2024-07-31"))
    assert set(at_point(led)["scope"]) == {"point"}
    # other districts in the same region borrow the pooled record
    others = led[led["point_id"] != P]
    assert len(others) and set(others["scope"]) == {"region"}


def test_weights_sum_to_one_and_favour_low_error():
    fc, tr = archive(days=40, errors={"a": 1.0, "b": 10.0})
    skill = at_point(ledger(fc, tr, pd.Timestamp("2024-07-31")))
    b = blend_one("rain", {"a": 40.0, "b": 80.0}, skill)
    assert sum(b["weights"].values()) == pytest.approx(1.0)
    assert b["weights"]["a"] > 0.9
    assert b["method"] == "stage_a"


def test_rain_bias_correction_uses_the_recent_ratio():
    fc, tr = archive(days=40, errors={"a": 20.0})  # source a forecasts 40 mm when 20 mm fell: ~2x too wet
    skill = at_point(ledger(fc, tr, pd.Timestamp("2024-07-31")))
    b = blend_one("rain", {"a": 60.0}, skill)
    ratio = (skill.loc["a", "sum_fc"] + 1) / (skill.loc["a", "sum_obs"] + 1)
    assert 1.9 < ratio < 2.0
    assert b["corrected"]["a"] == pytest.approx(60.0 / ratio)  # roughly halved: ~30 mm


def test_probabilities_and_percentiles_are_ordered():
    fc, tr = archive(days=40, errors={"a": 5.0, "b": 15.0})
    skill = at_point(ledger(fc, tr, pd.Timestamp("2024-07-31")))
    for vals in ({"a": 0.0, "b": 3.0}, {"a": 90.0, "b": 150.0}, {"a": 250.0, "b": 300.0}):
        b = blend_one("rain", vals, skill)
        assert 0 <= b["p10"] <= b["blend"] <= b["p90"]
        p = [b["prob"][k] for k in ("64.5", "115.6", "204.5")]
        assert p[0] >= p[1] >= p[2]
        assert all(0 <= x <= 1 for x in p)


def test_no_history_falls_back_to_equal_weights_and_says_so():
    b = blend_one("rain", {"a": 10.0, "b": 30.0}, pd.DataFrame())
    assert b["method"] == "equal_weights_no_verified_history"
    assert b["weights"] == {"a": 0.5, "b": 0.5}
    assert b["blend"] == pytest.approx(20.0)


def test_unrated_sources_are_shown_but_not_weighted():
    fc, tr = archive(days=40, sources=("a",))
    skill = at_point(ledger(fc, tr, pd.Timestamp("2024-07-31")))
    b = blend_one("rain", {"a": 10.0, "new": 90.0}, skill)
    assert set(b["weights"]) == {"a"}
    assert "new" in b["values"]
    r = reasons("rain", {"a": 10.0, "new": 90.0}, skill, b["weights"])
    assert any("not weighted" in x["text"] for x in r["new"])


def test_missing_values_are_ignored():
    assert blend_one("rain", {"a": np.nan}, pd.DataFrame()) == {}


def test_alert_levels():
    assert alert_level(210.0, {"64.5": 1, "115.6": 1, "204.5": 0.6}) == "Red"
    assert alert_level(120.0, {"64.5": 0.9, "115.6": 0.55, "204.5": 0.05}) == "Orange"
    assert alert_level(70.0, {"64.5": 0.55, "115.6": 0.1, "204.5": 0.0}) == "Yellow"
    assert alert_level(10.0, {"64.5": 0.01, "115.6": 0.0, "204.5": 0.0}) is None


def test_first_valid_date_starts_after_the_run():
    # 06 UTC run: the day ending 03 UTC tomorrow started before the run, so lead 1 ends the day after
    assert first_valid_date(dt.datetime(2026, 9, 25, 6, tzinfo=dt.UTC)) == dt.date(2026, 9, 27)
    # 00 UTC run: the window 25 Sep 04 UTC - 26 Sep 03 UTC starts after the run
    assert first_valid_date(dt.datetime(2026, 9, 25, 0, tzinfo=dt.UTC)) == dt.date(2026, 9, 26)


def test_exported_weights_still_sum_to_one():
    # Regression: rounding 12 equal weights to 2 decimals gave 12 x 0.08 = 0.96 in the exported cycle
    from ml.daily.run_cycle import _round

    rec = _round({"blend": 1.23456, "weights": {f"m{i}": 1 / 12 for i in range(12)}})
    assert rec["blend"] == 1.23
    assert abs(sum(rec["weights"].values()) - 1) < 1e-3


def test_test_scorecard_refuses_a_second_look(tmp_path):
    from ml.evaluate.test_scorecard import NotReady, check_guard

    out, log_file = tmp_path / "test_scorecard.json", tmp_path / "test_runs.log"
    check_guard(out, log_file, None)  # first scoring is allowed
    out.write_text("{}")
    with pytest.raises(NotReady):
        check_guard(out, log_file, None)
    check_guard(out, log_file, "IMD revised the 2025 grids")  # allowed only with a recorded reason

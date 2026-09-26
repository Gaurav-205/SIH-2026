"""Score definitions against hand-computed values."""

import math

import numpy as np
import pytest

from ml.evaluate import scores


def test_categorical_scores_hand_example():
    # 2 hits, 1 false alarm, 1 miss, 6 correct negatives
    f = np.array([70, 80, 70, 10, 0, 0, 0, 0, 0, 0], dtype=float)
    o = np.array([70, 90, 10, 70, 0, 0, 0, 0, 0, 0], dtype=float)
    s = scores.categorical(f, o, 64.5)
    assert (s["hits"], s["false_alarms"], s["misses"]) == (2, 1, 1)
    rand = 3 * 3 / 10
    assert s["ets"] == pytest.approx((2 - rand) / (4 - rand))
    assert s["pod"] == pytest.approx(2 / 3) and s["far"] == pytest.approx(1 / 3) and s["csi"] == pytest.approx(0.5)
    pod, pofd = 2 / 3, 1 / 7
    expected = (math.log(pofd) - math.log(pod) - math.log(1 - pofd) + math.log(1 - pod)) / (
        math.log(pofd) + math.log(pod) + math.log(1 - pofd) + math.log(1 - pod))
    assert s["sedi"] == pytest.approx(expected)


def test_brier_decomposition_adds_up():
    rng = np.random.default_rng(0)
    p = rng.uniform(size=5000)
    y = (rng.uniform(size=5000) < p).astype(float)
    r = scores.reliability(p, y, bins=10)
    # exact when every forecast in a bin equals the bin mean; close otherwise
    assert scores.brier(p, y) == pytest.approx(r["reliability"] - r["resolution"] + r["uncertainty"], abs=0.01)
    assert scores.brier_skill(np.full(5000, y.mean()), np.full(5000, y.mean()), y) == pytest.approx(0.0)


def test_crps_normal_matches_numerical_integral():
    from scipy.stats import norm

    mu, sd, o = 10.0, 4.0, 13.0
    x = np.linspace(-40, 60, 200001)
    num = np.trapezoid((norm.cdf(x, mu, sd) - (x >= o)) ** 2, x)
    assert scores.crps_normal(np.array([mu]), np.array([sd]), np.array([o])) == pytest.approx(num, rel=1e-4)


def test_quantile_score_is_zero_for_perfect_quantiles():
    o = np.array([1.0, 2.0, 3.0])
    assert scores.quantile_score({0.5: o.copy()}, o) == 0.0


def test_block_bootstrap_interval_contains_the_difference():
    rng = np.random.default_rng(1)
    dates = np.repeat(np.arange(100), 5)
    a, b = rng.gamma(2, 2, 500), rng.gamma(2, 2, 500) + 1.0
    r = scores.block_bootstrap_diff(dates, a, b)
    assert r["lo"] <= r["diff"] <= r["hi"]
    assert r["hi"] < 0  # b is clearly worse


def test_relative_economic_value_bounds():
    y = np.array([1, 0, 0, 1, 0, 0, 0, 0, 1, 0], dtype=float)
    perfect = scores.relative_economic_value(y.copy(), y, np.array([0.1, 0.3, 0.5]))
    assert np.allclose(perfect, 1.0)
    clim = scores.relative_economic_value(np.full(10, y.mean()), y, np.array([0.1, 0.5]))
    assert np.all(clim <= 1e-12)


def test_exported_json_is_strict(tmp_path):
    """Browsers reject NaN/Infinity in JSON; every export must be strict."""
    import json

    from ml.common import write_json

    f = tmp_path / "x.json"
    write_json(f, {"a": float("nan"), "b": [np.float32(1.5), np.inf, np.int64(3)], "c": {"d": -np.inf}})
    assert json.loads(f.read_text(), parse_constant=lambda c: pytest.fail(f"non-strict token {c}")) == {
        "a": None, "b": [1.5, None, 3], "c": {"d": None}}

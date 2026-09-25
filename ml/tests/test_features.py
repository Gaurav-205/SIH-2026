"""The vectorised training ledger must equal the live cycle's ledger (same leakage rule, same numbers)."""

import numpy as np
import pandas as pd
import pytest

from ml.common import points
from ml.features.ledger import ledger_features
from ml.live.stage_a import ledger


def synthetic(seed: int = 7, days: int = 140) -> tuple[pd.DataFrame, pd.DataFrame]:
    rng = np.random.default_rng(seed)
    pts = [p.id for p in points()[:3]] + [p.id for p in points() if p.region == "kerala"][:2]
    dates = pd.date_range("2024-05-01", periods=days, freq="D")
    fc = pd.DataFrame([(p, d, s, lead, "rain") for p in pts for d in dates for s in ("a", "b") for lead in (1, 3)],
                      columns=["point_id", "date", "source", "lead", "var"])
    fc["value"] = rng.gamma(0.8, 12, len(fc))
    fc = fc.sample(frac=0.8, random_state=seed).reset_index(drop=True)            # random gaps
    fc = fc[~((fc["point_id"] == pts[0]) & (fc["source"] == "b"))]               # forces region pooling
    truth = pd.DataFrame([(p, d, "rain") for p in pts for d in dates], columns=["point_id", "date", "var"])
    truth["obs"] = rng.gamma(0.7, 14, len(truth))
    return fc, truth.sample(frac=0.9, random_state=seed + 1)


@pytest.mark.parametrize("lead", [1, 3])
def test_vectorised_ledger_matches_live_ledger(lead):
    fc, truth = synthetic()
    feats = ledger_features(fc, truth)
    checked = 0
    for date in pd.to_datetime(["2024-06-15", "2024-07-20", "2024-09-10"]):
        live = ledger(fc, truth, date - pd.Timedelta(days=lead))
        live = live[live["lead"] == lead].set_index(["source", "point_id"])
        rows = feats[(feats["date"] == date) & (feats["lead"] == lead)].set_index(["source", "point_id"])
        for key, r in rows.iterrows():
            if key not in live.index:
                assert pd.isna(r["mae"])
                continue
            L = live.loc[key]
            assert r["scope"] == L["scope"]
            for c in ("n", "mae", "bias", "sum_fc", "sum_obs"):
                assert r[c] == pytest.approx(L[c], rel=1e-9, abs=1e-9), c
            checked += 1
    assert checked > 10


def test_ledger_features_ignore_truth_after_the_issue_date():
    """Changing observations on or after V - L + 1 must not change the features of (V, L)."""
    fc, truth = synthetic(seed=3)
    date, lead = pd.Timestamp("2024-08-01"), 3
    base = ledger_features(fc, truth)
    future = truth["date"] > date - pd.Timedelta(days=lead)
    tampered = truth.copy()
    tampered.loc[future, "obs"] = tampered.loc[future, "obs"] * 10 + 100
    after = ledger_features(fc, tampered)
    key = (base["date"] == date) & (base["lead"] == lead)
    pd.testing.assert_frame_equal(base[key].reset_index(drop=True), after[key].reset_index(drop=True))


def test_regime_labels_are_causal_and_need_a_run(monkeypatch):
    from ml.features import regimes

    monkeypatch.setattr(regimes, "config", lambda: {"regimes": {"min_run_days": 3, "active_z": 1.0, "break_z": -1.0,
                                                                "season_months": [6, 7, 8, 9]}})
    dates = pd.date_range("2024-07-01", periods=8, freq="D")
    z = pd.Series([2, 2, 2, 0, -2, -2, -2, 2], index=dates, dtype=float)
    got = regimes.label(z, pd.Series(dates.month, index=dates)).tolist()
    assert got == ["normal", "normal", "active", "normal", "normal", "normal", "break", "normal"]
    # the label of day t does not change when later days change
    z2 = z.copy()
    z2.iloc[3:] = 5.0
    assert regimes.label(z2, pd.Series(dates.month, index=dates)).tolist()[:3] == got[:3]
    off = regimes.label(z, pd.Series(np.full(8, 1), index=dates)).tolist()
    assert set(off) == {"off_season"}

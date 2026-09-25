"""Verification scores (standard operational definitions; formulas cited per function).

All functions take NumPy arrays of matched forecast/observation pairs; NaNs must be removed by the caller.
"""

from __future__ import annotations

import math

import numpy as np


def continuous(f: np.ndarray, o: np.ndarray) -> dict[str, float]:
    e = f - o
    return {
        "n": int(len(f)),
        "mae": float(np.mean(np.abs(e))),
        "rmse": float(np.sqrt(np.mean(e ** 2))),
        "bias": float(np.mean(e)),
        "corr": float(np.corrcoef(f, o)[0, 1]) if len(f) > 2 and np.std(f) > 0 and np.std(o) > 0 else float("nan"),
    }


def contingency(f: np.ndarray, o: np.ndarray, t: float) -> tuple[int, int, int, int]:
    """(hits, false alarms, misses, correct negatives) for the event value >= t."""
    fe, oe = f >= t, o >= t
    return int((fe & oe).sum()), int((fe & ~oe).sum()), int((~fe & oe).sum()), int((~fe & ~oe).sum())


def categorical(f: np.ndarray, o: np.ndarray, t: float) -> dict[str, float | None]:
    """POD, FAR, CSI, ETS, frequency bias and SEDI (Ferro and Stephenson 2011) for value >= t."""
    a, b, c, d = contingency(f, o, t)
    n = a + b + c + d
    pod = a / (a + c) if a + c else None
    far = b / (a + b) if a + b else None
    csi = a / (a + b + c) if a + b + c else None
    rand = (a + b) * (a + c) / n if n else 0.0
    ets = (a - rand) / (a + b + c - rand) if (a + b + c - rand) else None
    fbias = (a + b) / (a + c) if a + c else None
    pofd = b / (b + d) if b + d else None
    sedi = None
    if pod is not None and pofd is not None and 0 < pod < 1 and 0 < pofd < 1:
        lf, lh, l1f, l1h = math.log(pofd), math.log(pod), math.log(1 - pofd), math.log(1 - pod)
        sedi = (lf - lh - l1f + l1h) / (lf + lh + l1f + l1h)
    return {"events": a + c, "hits": a, "false_alarms": b, "misses": c,
            "pod": pod, "far": far, "csi": csi, "ets": ets, "freq_bias": fbias, "sedi": sedi}


def brier(p: np.ndarray, y: np.ndarray) -> float:
    return float(np.mean((p - y) ** 2))


def brier_skill(p: np.ndarray, p_ref: np.ndarray, y: np.ndarray) -> float | None:
    """BSS = 1 - BS / BS_ref (reference: climatological probability for each day and place)."""
    ref = brier(p_ref, y)
    return 1 - brier(p, y) / ref if ref > 0 else None


def reliability(p: np.ndarray, y: np.ndarray, bins: int = 10) -> dict:
    """Reliability-diagram table and the Murphy (1973) decomposition BS = REL - RES + UNC."""
    edges = np.linspace(0, 1, bins + 1)
    idx = np.clip(np.digitize(p, edges[1:-1]), 0, bins - 1)
    base = float(np.mean(y))
    rel = res = 0.0
    table = []
    for k in range(bins):
        m = idx == k
        if not m.any():
            continue
        pk, ok, nk = float(p[m].mean()), float(y[m].mean()), int(m.sum())
        rel += nk * (pk - ok) ** 2
        res += nk * (ok - base) ** 2
        table.append({"bin_lo": float(edges[k]), "bin_hi": float(edges[k + 1]), "mean_p": pk, "obs_freq": ok, "n": nk})
    n = len(p)
    return {"table": table, "reliability": rel / n, "resolution": res / n, "uncertainty": base * (1 - base)}


def quantile_score(q: dict[float, np.ndarray], o: np.ndarray) -> float:
    """Mean pinball loss over the given quantile levels (lower is better; ~CRPS/levels for dense sets)."""
    losses = []
    for tau, qv in q.items():
        d = o - qv
        losses.append(np.mean(np.maximum(tau * d, (tau - 1) * d)))
    return float(np.mean(losses))


def crps_normal(mu: np.ndarray, sigma: np.ndarray, o: np.ndarray) -> float:
    """Closed-form CRPS of N(mu, sigma^2) (Gneiting et al. 2005)."""
    from scipy.stats import norm

    s = np.maximum(sigma, 1e-6)
    z = (o - mu) / s
    return float(np.mean(s * (z * (2 * norm.cdf(z) - 1) + 2 * norm.pdf(z) - 1 / math.sqrt(math.pi))))


def block_bootstrap_diff(dates: np.ndarray, loss_a: np.ndarray, loss_b: np.ndarray, block_days: int = 5,
                         n_boot: int = 1000, seed: int = 26081, stat: str = "mean") -> dict[str, float]:
    """95% interval of mean(loss_a) - mean(loss_b) resampling blocks of consecutive dates (paired).

    With stat='rmse', losses are squared errors and the difference is sqrt(mean a) - sqrt(mean b).
    """
    rng = np.random.default_rng(seed)
    uniq = np.unique(dates)
    block_of = {d: i // block_days for i, d in enumerate(uniq)}
    bid = np.array([block_of[d] for d in dates])
    nb = bid.max() + 1
    sa, sb, cnt = np.bincount(bid, loss_a, nb), np.bincount(bid, loss_b, nb), np.bincount(bid, None, nb)

    def value(a, b, c):
        ma, mb = a / c, b / c
        return (math.sqrt(ma) - math.sqrt(mb)) if stat == "rmse" else (ma - mb)

    point = value(sa.sum(), sb.sum(), cnt.sum())
    idx = rng.integers(0, nb, size=(n_boot, nb))
    boot = np.array([value(sa[i].sum(), sb[i].sum(), cnt[i].sum()) for i in idx])
    lo, hi = np.percentile(boot, [2.5, 97.5])
    return {"diff": float(point), "lo": float(lo), "hi": float(hi), "blocks": int(nb)}


def relative_economic_value(p: np.ndarray, y: np.ndarray, cost_loss: np.ndarray) -> np.ndarray:
    """Relative economic value (Richardson 2000) of acting when p >= C/L, for each cost/loss ratio.

    Expense per case (loss L = 1, cost C = a): forecast a*(hits + false alarms)/n + misses/n;
    climatology min(a, s); perfect a*s, with s the base rate. REV = (E_clim - E_fc) / (E_clim - E_perf).
    """
    s = float(np.mean(y))
    out = []
    for a in cost_loss:
        act = p >= a
        e_fc = a * np.mean(act) + np.mean(~act & (y == 1))
        e_clim, e_perf = min(a, s), a * s
        out.append((e_clim - e_fc) / (e_clim - e_perf) if e_clim > e_perf else np.nan)
    return np.array(out)

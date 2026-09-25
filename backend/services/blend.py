"""
AtmosFusion Blending Engine
Implements skill-weighted dynamic multi-model consensus,
monotonic parametric uncertainty quantiles, and structured IMD alerting.
Formula: w_{m,s} = (MAE_{m,s} + eps)^(-p) / sum((MAE_{k,s} + eps)^(-p))
"""

import math
from typing import Dict, Iterable, List, Literal, Optional
from pydantic import BaseModel

MODEL_FAMILIES = {
    "gfs": "Physics NWP",
    "ncum": "Physics NWP",
    "wrf": "Physics NWP",
    "ecmwf": "Physics NWP",
    "graphcast": "AI / ML",
    "aifs": "AI / ML",
}

MODEL_LABELS = {
    "gfs": "GFS / BharatFS",
    "ncum": "NCUM",
    "wrf": "WRF (3km)",
    "ecmwf": "ECMWF IFS HRES",
    "graphcast": "Google GraphCast",
    "aifs": "ECMWF AIFS",
}


AlertLevel = Literal["Yellow", "Orange", "Red"]


def norm_cdf(x: float) -> float:
    """Standard normal cumulative distribution function."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def lead_day_factor(lead_day: int) -> float:
    """Lead-time decay applied to model QPF (mirrors leadDayFactor in blendEngine.ts)."""
    return max(0.2, 1.0 - 0.08 * (lead_day - 1))


def round_half_up(x: float, ndigits: int = 0) -> float:
    """Rounding identical to JavaScript's Math.round(x * 10^n) / 10^n."""
    factor = 10 ** ndigits
    return math.floor(x * factor + 0.5) / factor


def js_sum(values: Iterable[float]) -> float:
    """Plain left-to-right float sum, as in JavaScript.
    Python 3.12+ sum() uses compensated summation, which can flip x.x5 roundings."""
    total = 0.0
    for v in values:
        total += v
    return total


def fmt(x: float) -> str:
    """Format like JavaScript's Number#toString for our value range (152.0 -> '152')."""
    return f"{x:g}"


def pct(p: float) -> int:
    """Half-up percentage, matching JavaScript's Math.round (Python's round() is half-to-even)."""
    return int(math.floor(p * 100 + 0.5))


class StructuredAlert(BaseModel):
    level: AlertLevel
    hazard: str
    threshold_mm: float
    probability: float
    headline: str
    message: str


class QuantilePoint(BaseModel):
    lead_day: int
    p10: float
    p50: float
    p90: float
    simple_avg: float


class FullStationComputation(BaseModel):
    assigned_weights: Dict[str, float]
    consensus_blend: float
    simple_average: float
    worst_case_90th: float
    disagreement_index: float
    spread_std: float
    p_heavy_rain: float
    p_very_heavy: float
    p_extremely_heavy: float
    dominant_model: str
    dominant_family: str
    active_alert: Optional[str]
    alert_level: Optional[AlertLevel]
    alert_details: Optional[StructuredAlert]
    shap_explanation: str
    quantile_curve: List[QuantilePoint]


def calculate_weights(
    recent_mae: Dict[str, float],
    power: float = 2.0,
    epsilon: float = 0.1,
) -> Dict[str, float]:
    """
    Skill-weighted formulation from audit section 8.2:
    w_{m,s} = (MAE_{m,s} + epsilon)^(-p) / sum_k (MAE_{k,s} + epsilon)^(-p)
    """
    inv_skills = {
        m: (mae + epsilon) ** (-power)
        for m, mae in recent_mae.items()
    }
    total_inv = js_sum(inv_skills.values())
    if total_inv <= 0:
        n = len(recent_mae)
        return {m: round_half_up(1.0 / n, 3) for m in recent_mae}
    
    # Normalize and round so sum is exactly 1.000
    raw_weights = {m: val / total_inv for m, val in inv_skills.items()}
    rounded = {m: round_half_up(w, 3) for m, w in raw_weights.items()}
    # Adjust largest weight for rounding drift
    diff = round_half_up(1.0 - js_sum(rounded.values()), 3)
    if diff != 0:
        max_m = max(rounded, key=lambda k: rounded[k])
        rounded[max_m] = round_half_up(rounded[max_m] + diff, 3)
    return rounded


def compute_station_metrics(
    station_id: str,
    station_name: str,
    terrain_type: str,
    predictions: Dict[str, float],
    recent_mae: Dict[str, float],
) -> FullStationComputation:
    """
    Computes all derived metrics deterministically from inputs.
    Guarantees:
      - Blend = sum(weight * prediction)
      - Dominant model = argmax(weight)
      - P10 <= P50 <= P90
      - P(heavy) >= P(very_heavy) >= P(extreme)
      - If threshold >= P90, then P(rain >= threshold) <= 0.10
    """
    # 1. Weights from skill
    weights = calculate_weights(recent_mae, power=2.0, epsilon=0.1)

    # 2. Consensus blend and simple average
    consensus = js_sum(predictions[m] * weights.get(m, 0.0) for m in predictions)
    consensus = round_half_up(consensus, 1)
    
    avg = js_sum(predictions.values()) / len(predictions) if predictions else 0.0
    avg = round_half_up(avg, 1)

    # 3. Disagreement index (spread) and weighted standard deviation
    spread = max(predictions.values()) - min(predictions.values()) if predictions else 0.0
    spread = round_half_up(spread, 1)

    variance = js_sum(
        weights.get(m, 0.0) * ((predictions[m] - consensus) ** 2)
        for m in predictions
    )
    # std deviation floor to model natural residual atmospheric uncertainty
    sigma = max(4.0, math.sqrt(variance))

    # 4. Monotonic percentiles from single coherent distribution
    # Z-scores: P10 = -1.282, P50 = 0, P90 = +1.282
    p10 = max(0.0, round_half_up(consensus - 1.28155 * sigma, 1))
    p50 = round_half_up(consensus, 1)
    p90 = round_half_up(consensus + 1.28155 * sigma, 1)

    # 5. Exceedance probabilities directly from CDF
    # P(rain >= T) = 1 - CDF(T)
    def calc_exceedance(threshold: float) -> float:
        z = (threshold - consensus) / sigma
        prob = 1.0 - norm_cdf(z)
        return round_half_up(max(0.01, min(0.99, prob)), 2)

    p_heavy = calc_exceedance(64.5)
    p_very_heavy = calc_exceedance(115.6)
    p_extreme = calc_exceedance(204.5)

    # 6. Dominant model & family
    top_model = max(weights, key=lambda m: weights[m])
    dominant_model_label = MODEL_LABELS.get(top_model, top_model.upper())
    dominant_family = MODEL_FAMILIES.get(top_model, "Physics NWP")

    # 7. Automated Explainability
    sorted_weights = sorted(weights.items(), key=lambda x: x[1], reverse=True)
    top1, top2 = sorted_weights[0], sorted_weights[1]
    top1_name = MODEL_LABELS.get(top1[0], top1[0].upper())
    top2_name = MODEL_LABELS.get(top2[0], top2[0].upper())
    lowest_mae = min(recent_mae.items(), key=lambda x: x[1])
    lowest_mae_name = MODEL_LABELS.get(lowest_mae[0], lowest_mae[0].upper())

    explanation = (
        f"{top1_name} ({pct(top1[1])}%) and {top2_name} ({pct(top2[1])}%) lead weighting "
        f"for {terrain_type}. {lowest_mae_name} achieved lowest 48h error ({fmt(recent_mae[lowest_mae[0]])} mm). "
        f"Consensus preserves {fmt(consensus)} mm vs flat average {fmt(avg)} mm (spread {fmt(spread)} mm)."
    )

    # 8. Structured Alerting (wording mirrors blendEngine.ts so both engines emit identical text)
    alert_details = None
    if consensus >= 204.5 or p_extreme >= 0.25 or (consensus >= 150 and p_very_heavy >= 0.75):
        alert_details = StructuredAlert(
            level="Red",
            hazard="Flash Flood / Cloudburst Threat",
            threshold_mm=204.5,
            probability=p_extreme if p_extreme >= 0.25 else p_very_heavy,
            headline=f"RED ALERT: Extreme Precipitation at {station_name}",
            message=(
                f"RED ALERT: Flash flood threat at {station_name}. Consensus {fmt(consensus)} mm "
                f"(90th: {fmt(p90)} mm, P≥204.5mm: {pct(p_extreme)}%). Immediate catchment monitoring advised."
            ),
        )
    elif consensus >= 115.6 or p_very_heavy >= 0.40:
        alert_details = StructuredAlert(
            level="Orange",
            hazard="Very Heavy Rainfall Threat",
            threshold_mm=115.6,
            probability=p_very_heavy,
            headline=f"ORANGE ALERT: Very Heavy Rainfall at {station_name}",
            message=(
                f"ORANGE ALERT: Very heavy rain at {station_name}. Consensus {fmt(consensus)} mm "
                f"(P≥115.6mm: {pct(p_very_heavy)}%). Reservoir inflow monitoring advised."
            ),
        )
    elif consensus >= 64.5 or p_heavy >= 0.45:
        alert_details = StructuredAlert(
            level="Yellow",
            hazard="Heavy Rainfall Watch",
            threshold_mm=64.5,
            probability=p_heavy,
            headline=f"YELLOW WATCH: Heavy Rainfall at {station_name}",
            message=(
                f"YELLOW WATCH: Heavy rainfall at {station_name}. Consensus {fmt(consensus)} mm "
                f"(P≥64.5mm: {pct(p_heavy)}%). Waterlogging possible in low-lying sectors."
            ),
        )

    # 9. Coherent 10-day Quantile Curves
    curve: List[QuantilePoint] = []
    for d in range(1, 11):
        lead_factor = lead_day_factor(d)  # decay toward climatology
        lead_sigma = sigma * (1.0 + 0.15 * (d - 1))
        lead_mean = round_half_up(max(4.0, consensus * lead_factor), 1)
        lead_p10 = max(0.0, round_half_up(lead_mean - 1.28155 * lead_sigma, 1))
        lead_p50 = round_half_up(lead_mean, 1)
        lead_p90 = round_half_up(lead_mean + 1.28155 * lead_sigma, 1)
        lead_avg = round_half_up(max(3.0, avg * lead_factor), 1)
        curve.append(
            QuantilePoint(
                lead_day=d,
                p10=lead_p10,
                p50=lead_p50,
                p90=lead_p90,
                simple_avg=lead_avg,
            )
        )

    return FullStationComputation(
        assigned_weights=weights,
        consensus_blend=consensus,
        simple_average=avg,
        worst_case_90th=p90,
        disagreement_index=spread,
        spread_std=round_half_up(sigma, 1),
        p_heavy_rain=p_heavy,
        p_very_heavy=p_very_heavy,
        p_extremely_heavy=p_extreme,
        dominant_model=dominant_model_label,
        dominant_family=dominant_family,
        active_alert=alert_details.message if alert_details else None,
        alert_level=alert_details.level if alert_details else None,
        alert_details=alert_details,
        shap_explanation=explanation,
        quantile_curve=curve,
    )

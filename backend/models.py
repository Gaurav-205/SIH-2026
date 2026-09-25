"""
AtmosFusion: Hybrid AI–NWP Multi-Model Forecast Blending System
Pydantic Schema Definitions — NCMRWF / MoES / SIH26081
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Literal, Optional


class WeatherStation(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    elevation_m: int
    terrain_type: str
    coverage_radius_km: int = 12
    observed_rain_24h: float
    observed_temp_c: float = 27.5
    observed_humidity: float = 85.0
    observed_wind_kmh: float = 18.0
    observed_pressure: float = 952.0
    
    # Model predictions for different atmospheric variables
    model_predictions: Dict[str, float]
    model_temp: Dict[str, float] = Field(default_factory=dict)
    model_humidity: Dict[str, float] = Field(default_factory=dict)
    model_wind: Dict[str, float] = Field(default_factory=dict)

    assigned_weights: Dict[str, float]
    recent_mae_48h: Dict[str, float]
    
    # Consensus blended outputs
    consensus_blend: float
    consensus_temp: float = 27.5
    consensus_humidity: float = 85.0
    consensus_wind: float = 18.0
    
    simple_average: float
    worst_case_90th: float
    p_heavy_rain: float       # P(Rain >= 64.5 mm)
    p_very_heavy: float       # P(Rain >= 115.6 mm)
    p_extremely_heavy: float  # P(Rain >= 204.5 mm)
    active_alert: Optional[str] = None
    alert_level: Optional[Literal["Yellow", "Orange", "Red"]] = None
    dominant_model: str
    dominant_family: str       # "Physics NWP", "AI / ML"
    shap_explanation: str
    disagreement_index: float  # max - min across models (mm)
    spread_std: float  # weighted ensemble standard deviation σ (mm)


class RegionForecast(BaseModel):
    region_id: str
    region_name: str
    regime: str
    regime_confidence: float
    season: str
    lead_day: int
    stations: List[WeatherStation]
    grid_summary: Dict[str, float]


class VerificationRow(BaseModel):
    model_name: str
    model_type: str
    day1_rmse: float
    day3_rmse: float
    heavy_rain_ets: float
    extreme_rain_csi: float
    crps_score: float


class QuantileCurvePoint(BaseModel):
    lead_day: int
    p10: float
    p50: float
    p90: float
    simple_avg: float


class HealthResponse(BaseModel):
    status: str
    service: str
    grid_cells_synced: int
    mesh_resolution: str
    regime_engine: str
    last_cycle: str

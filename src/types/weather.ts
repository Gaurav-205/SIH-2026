/**
 * AtmosFusion: Hybrid AI–NWP Multi-Model Forecast Blending System
 * TypeScript interfaces — mirrors backend/models.py
 */

export interface WeatherStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  elevation_m: number;
  terrain_type: string;
  coverage_radius_km: number; // For map coverage rendering
  // Current observations
  observed_rain_24h: number;
  observed_temp_c: number;
  observed_humidity: number;
  observed_wind_kmh: number;
  observed_pressure: number;
  
  // Model predictions for different variables
  model_predictions: Record<string, number>; // Rain
  model_temp: Record<string, number>;
  model_humidity: Record<string, number>;
  model_wind: Record<string, number>;

  assigned_weights: Record<string, number>;
  recent_mae_48h: Record<string, number>;
  
  // Blended consensus outputs
  consensus_blend: number; // Rain
  consensus_temp: number;
  consensus_humidity: number;
  consensus_wind: number;
  
  simple_average: number; // Rain
  worst_case_90th: number; // Rain
  
  p_heavy_rain: number;
  p_very_heavy: number;
  p_extremely_heavy: number;
  active_alert: string | null;
  alert_level: AlertLevel | null;
  dominant_model: string;
  dominant_family: string;
  shap_explanation: string;
  disagreement_index: number; // max − min across models (mm)
  spread_std: number; // weighted ensemble standard deviation σ (mm)
}

export type AlertLevel = "Yellow" | "Orange" | "Red";

export interface RegionForecast {
  region_id: string;
  region_name: string;
  regime: string;
  regime_confidence: number;
  season: string;
  lead_day: number;
  stations: WeatherStation[];
  grid_summary: Record<string, number>;
}

export interface VerificationRow {
  model_name: string;
  model_type: string;
  day1_rmse: number;
  day3_rmse: number;
  heavy_rain_ets: number;
  extreme_rain_csi: number;
  crps_score: number;
}

export interface QuantileCurvePoint {
  lead_day: number;
  p10: number;
  p50: number;
  p90: number;
  simple_avg: number;
}

export interface HealthResponse {
  status: string;
  service: string;
  grid_cells_synced: number;
  mesh_resolution: string;
  regime_engine: string;
  last_cycle: string;
}

export const LEAD_DAYS = [1, 2, 3, 5, 7, 10];

export type LayerMode = "consensus" | "trust" | "disagreement" | "risk" | "coverage";

export const MODEL_LABELS: Record<string, string> = {
  gfs: "GFS / BharatFS",
  ncum: "NCUM",
  wrf: "WRF (3km)",
  ecmwf: "ECMWF IFS HRES",
  graphcast: "Google GraphCast",
  aifs: "ECMWF AIFS",
};

export const MODEL_FAMILIES: Record<string, string> = {
  gfs: "Physics NWP",
  ncum: "Physics NWP",
  wrf: "Physics NWP",
  ecmwf: "Physics NWP",
  graphcast: "AI / ML",
  aifs: "AI / ML",
};

export const FAMILY_COLORS: Record<string, string> = {
  Physics: "#3A86FF",
  Ensemble: "#8338EC",
  AI: "#06D6A0",
};

export const RAINFALL_THRESHOLDS = {
  light: 7.5,
  moderate: 35.5,
  heavy: 64.5,
  very_heavy: 115.6,
  extremely_heavy: 204.5,
} as const;

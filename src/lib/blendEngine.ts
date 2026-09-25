/**
 * AtmosFusion Blending Engine (Client-side mirror of backend/services/blend.py)
 * Implements skill-weighted dynamic multi-model consensus,
 * monotonic parametric uncertainty quantiles, and structured IMD alerting.
 * Formula: w_{m,s} = (MAE_{m,s} + eps)^(-p) / sum((MAE_{k,s} + eps)^(-p))
 */

import type {
  WeatherStation,
  RegionForecast,
  QuantileCurvePoint,
  VerificationRow,
  AlertLevel,
} from "@/types/weather";
import { MODEL_LABELS, MODEL_FAMILIES } from "@/types/weather";

// Okabe-Ito color-blind safe palette
export const MODEL_OKABE_ITO: Record<string, string> = {
  ecmwf: "#0072B2",     // Deep Blue (Physics)
  graphcast: "#009E73", // Bluish Green (AI)
  wrf: "#CC79A7",       // Reddish Purple (Physics 3km)
  aifs: "#56B4E9",      // Sky Blue (AI)
  gfs: "#E69F00",       // Orange (Physics)
  ncum: "#D55E00",      // Vermillion (Physics)
};

// IMD 24h rainfall categories (mm) — single source for thresholds, colors and labels
export const IMD_CATEGORIES = [
  { min: 204.5, label: "Extremely Heavy", color: "#ef4444" },
  { min: 115.6, label: "Very Heavy", color: "#f97316" },
  { min: 64.5, label: "Heavy", color: "#eab308" },
  { min: 35.5, label: "Moderate", color: "#3b82f6" },
  { min: 7.5, label: "Light", color: "#10b981" },
  { min: 0, label: "Very Light", color: "#06b6d4" },
] as const;

export function getImdCategory(mm: number) {
  return IMD_CATEGORIES.find((c) => mm >= c.min) ?? IMD_CATEGORIES[IMD_CATEGORIES.length - 1];
}

export function getImdRainColor(mm: number): string {
  return getImdCategory(mm).color;
}

export const ALERT_COLORS: Record<AlertLevel, string> = {
  Red: "#ef4444",
  Orange: "#f97316",
  Yellow: "#eab308",
};

// Lead-day decay applied to raw model QPF (mirrors backend/main.py)
export function leadDayFactor(leadDay: number): number {
  return Math.max(0.2, 1.0 - 0.08 * (leadDay - 1));
}

const round1 = (x: number) => Math.round(x * 10) / 10;

// Error function approximation for normal CDF
function erf(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

function normCdf(x: number): number {
  return 0.5 * (1.0 + erf(x / Math.sqrt(2.0)));
}

/**
 * Compute weights dynamically from rolling MAE:
 * w_{m,s} = (MAE + eps)^(-p) / sum(...)
 */
export function calculateWeights(
  recentMae: Record<string, number>,
  power = 2.0,
  epsilon = 0.1
): Record<string, number> {
  const invSkills: Record<string, number> = {};
  let totalInv = 0;

  for (const [m, mae] of Object.entries(recentMae)) {
    const inv = Math.pow(mae + epsilon, -power);
    invSkills[m] = inv;
    totalInv += inv;
  }

  if (totalInv <= 0) {
    const keys = Object.keys(recentMae);
    const uniform = Math.round((1.0 / keys.length) * 1000) / 1000;
    return Object.fromEntries(keys.map(k => [k, uniform]));
  }

  const rounded: Record<string, number> = {};
  let sum = 0;
  for (const [m, inv] of Object.entries(invSkills)) {
    const w = Math.round((inv / totalInv) * 1000) / 1000;
    rounded[m] = w;
    sum += w;
  }

  // Adjust largest weight for rounding drift so sum is exactly 1.000
  const diff = Math.round((1.0 - sum) * 1000) / 1000;
  if (diff !== 0) {
    let maxKey = Object.keys(rounded)[0];
    for (const k of Object.keys(rounded)) {
      if (rounded[k] > rounded[maxKey]) maxKey = k;
    }
    rounded[maxKey] = Math.round((rounded[maxKey] + diff) * 1000) / 1000;
  }

  return rounded;
}

export interface RawStationInput {
  id: string;
  name: string;
  lat: number;
  lng: number;
  elevation_m: number;
  terrain_type: string;
  coverage_radius_km: number;
  observed_rain_24h: number;
  observed_temp_c: number;
  observed_humidity: number;
  observed_wind_kmh: number;
  observed_pressure: number;
  model_predictions: Record<string, number>;
  model_temp: Record<string, number>;
  model_humidity: Record<string, number>;
  model_wind: Record<string, number>;
  recent_mae_48h: Record<string, number>;
}

export function computeStation(input: RawStationInput): WeatherStation {
  const weights = calculateWeights(input.recent_mae_48h, 2.0, 0.1);

  // 1. Blend calculations
  let blendSum = 0;
  let tempSum = 0;
  let humSum = 0;
  let windSum = 0;

  for (const [m, p] of Object.entries(input.model_predictions)) {
    const w = weights[m] || 0;
    blendSum += p * w;
    tempSum += (input.model_temp[m] ?? input.observed_temp_c) * w;
    humSum += (input.model_humidity[m] ?? input.observed_humidity) * w;
    windSum += (input.model_wind[m] ?? input.observed_wind_kmh) * w;
  }

  const consensusBlend = Math.round(blendSum * 10) / 10;
  const consensusTemp = Math.round(tempSum * 10) / 10;
  const consensusHumidity = Math.round(Math.min(100, humSum) * 10) / 10;
  const consensusWind = Math.round(windSum * 10) / 10;

  // Simple average
  const preds = Object.values(input.model_predictions);
  const simpleAvg = Math.round((preds.reduce((a, b) => a + b, 0) / (preds.length || 1)) * 10) / 10;

  // Spread & Disagreement
  const minVal = Math.min(...preds);
  const maxVal = Math.max(...preds);
  const disagreement = Math.round((maxVal - minVal) * 10) / 10;

  let variance = 0;
  for (const [m, p] of Object.entries(input.model_predictions)) {
    const w = weights[m] || 0;
    variance += w * Math.pow(p - consensusBlend, 2);
  }
  const sigma = Math.max(4.0, Math.sqrt(variance));

  // Coherent quantiles & probabilities
  const p90 = Math.round((consensusBlend + 1.28155 * sigma) * 10) / 10;

  const calcExceedance = (threshold: number) => {
    const z = (threshold - consensusBlend) / sigma;
    const prob = 1.0 - normCdf(z);
    return Math.round(Math.max(0.01, Math.min(0.99, prob)) * 100) / 100;
  };

  const pHeavy = calcExceedance(64.5);
  const pVeryHeavy = calcExceedance(115.6);
  const pExtreme = calcExceedance(204.5);

  // Dominant model & family
  let topModel = Object.keys(weights)[0];
  for (const [m, w] of Object.entries(weights)) {
    if (w > (weights[topModel] || 0)) topModel = m;
  }
  const dominantModel = MODEL_LABELS[topModel] || topModel.toUpperCase();
  const dominantFamily = MODEL_FAMILIES[topModel] || "Physics NWP";

  // Automated explainability
  const sortedWeights = Object.entries(weights).sort(([, a], [, b]) => b - a);
  const top1 = sortedWeights[0];
  const top2 = sortedWeights[1];
  const top1Label = MODEL_LABELS[top1[0]] || top1[0].toUpperCase();
  const top2Label = MODEL_LABELS[top2[0]] || top2[0].toUpperCase();

  const lowestMae = Object.entries(input.recent_mae_48h).sort(([, a], [, b]) => a - b)[0];
  const lowestMaeLabel = MODEL_LABELS[lowestMae[0]] || lowestMae[0].toUpperCase();

  const shapExplanation =
    `${top1Label} (${Math.round(top1[1] * 100)}%) and ${top2Label} (${Math.round(top2[1] * 100)}%) lead weighting ` +
    `for ${input.terrain_type}. ${lowestMaeLabel} achieved lowest 48h error (${input.recent_mae_48h[lowestMae[0]]} mm). ` +
    `Consensus preserves ${consensusBlend} mm vs flat average ${simpleAvg} mm (spread ${disagreement} mm).`;

  // Structured IMD Alerting (wording mirrors backend/services/blend.py)
  let alertLevel: AlertLevel | null = null;
  let activeAlert: string | null = null;
  if (consensusBlend >= 204.5 || pExtreme >= 0.25 || (consensusBlend >= 150 && pVeryHeavy >= 0.75)) {
    alertLevel = "Red";
    activeAlert = `RED ALERT: Flash flood threat at ${input.name}. Consensus ${consensusBlend} mm (90th: ${p90} mm, P≥204.5mm: ${Math.round(pExtreme * 100)}%). Immediate catchment monitoring advised.`;
  } else if (consensusBlend >= 115.6 || pVeryHeavy >= 0.40) {
    alertLevel = "Orange";
    activeAlert = `ORANGE ALERT: Very heavy rain at ${input.name}. Consensus ${consensusBlend} mm (P≥115.6mm: ${Math.round(pVeryHeavy * 100)}%). Reservoir inflow monitoring advised.`;
  } else if (consensusBlend >= 64.5 || pHeavy >= 0.45) {
    alertLevel = "Yellow";
    activeAlert = `YELLOW WATCH: Heavy rainfall at ${input.name}. Consensus ${consensusBlend} mm (P≥64.5mm: ${Math.round(pHeavy * 100)}%). Waterlogging possible in low-lying sectors.`;
  }

  return {
    id: input.id,
    name: input.name,
    lat: input.lat,
    lng: input.lng,
    elevation_m: input.elevation_m,
    terrain_type: input.terrain_type,
    coverage_radius_km: input.coverage_radius_km,
    observed_rain_24h: input.observed_rain_24h,
    observed_temp_c: input.observed_temp_c,
    observed_humidity: input.observed_humidity,
    observed_wind_kmh: input.observed_wind_kmh,
    observed_pressure: input.observed_pressure,
    model_predictions: input.model_predictions,
    model_temp: input.model_temp,
    model_humidity: input.model_humidity,
    model_wind: input.model_wind,
    assigned_weights: weights,
    recent_mae_48h: input.recent_mae_48h,
    consensus_blend: consensusBlend,
    consensus_temp: consensusTemp,
    consensus_humidity: consensusHumidity,
    consensus_wind: consensusWind,
    simple_average: simpleAvg,
    worst_case_90th: p90,
    p_heavy_rain: pHeavy,
    p_very_heavy: pVeryHeavy,
    p_extremely_heavy: pExtreme,
    active_alert: activeAlert,
    alert_level: alertLevel,
    dominant_model: dominantModel,
    dominant_family: dominantFamily,
    shap_explanation: shapExplanation,
    disagreement_index: disagreement,
    spread_std: round1(sigma),
  };
}

export const PUNE_RAW_STATIONS: RawStationInput[] = [
  {
    id: "pune-shivajinagar",
    name: "Pune Shivajinagar",
    lat: 18.5314,
    lng: 73.8446,
    elevation_m: 560,
    terrain_type: "Valley / Urban Core",
    coverage_radius_km: 12,
    observed_rain_24h: 45.2,
    observed_temp_c: 28.1,
    observed_humidity: 84,
    observed_wind_kmh: 18,
    observed_pressure: 954,
    model_predictions: {
      gfs: 42, ncum: 38, wrf: 58, ecmwf: 48, graphcast: 50, aifs: 46
    },
    model_temp: {
      gfs: 29.2, ncum: 28.8, wrf: 27.4, ecmwf: 27.9, graphcast: 28.0, aifs: 28.3
    },
    model_humidity: {
      gfs: 80, ncum: 82, wrf: 88, ecmwf: 85, graphcast: 84, aifs: 83
    },
    model_wind: {
      gfs: 22, ncum: 20, wrf: 17, ecmwf: 18, graphcast: 18, aifs: 19
    },
    recent_mae_48h: {
      ecmwf: 6.1, graphcast: 6.8, aifs: 8.2, wrf: 9.5, gfs: 14.2, ncum: 16.8
    },
  },
  {
    id: "pune-pashan",
    name: "Pashan IMD Observatory",
    lat: 18.5388,
    lng: 73.7915,
    elevation_m: 575,
    terrain_type: "Valley Base / Observatory",
    coverage_radius_km: 10,
    observed_rain_24h: 50.8,
    observed_temp_c: 27.4,
    observed_humidity: 88,
    observed_wind_kmh: 16,
    observed_pressure: 952,
    model_predictions: {
      gfs: 35, ncum: 30, wrf: 62, ecmwf: 52, graphcast: 54, aifs: 48
    },
    model_temp: {
      gfs: 28.5, ncum: 28.0, wrf: 26.8, ecmwf: 27.2, graphcast: 27.3, aifs: 27.6
    },
    model_humidity: {
      gfs: 82, ncum: 84, wrf: 91, ecmwf: 88, graphcast: 87, aifs: 86
    },
    model_wind: {
      gfs: 19, ncum: 18, wrf: 15, ecmwf: 16, graphcast: 16, aifs: 17
    },
    recent_mae_48h: {
      ecmwf: 5.9, graphcast: 6.5, aifs: 7.9, wrf: 8.8, gfs: 15.1, ncum: 17.4
    },
  },
  {
    id: "pune-lohagaon",
    name: "Lohagaon Airport AWS",
    lat: 18.5822,
    lng: 73.9197,
    elevation_m: 590,
    terrain_type: "Plateau Rain-Shadow",
    coverage_radius_km: 14,
    observed_rain_24h: 22.5,
    observed_temp_c: 29.5,
    observed_humidity: 76,
    observed_wind_kmh: 24,
    observed_pressure: 951,
    model_predictions: {
      gfs: 55, ncum: 45, wrf: 22, ecmwf: 28, graphcast: 25, aifs: 24
    },
    model_temp: {
      gfs: 30.8, ncum: 30.2, wrf: 29.0, ecmwf: 29.4, graphcast: 29.3, aifs: 29.7
    },
    model_humidity: {
      gfs: 71, ncum: 73, wrf: 78, ecmwf: 76, graphcast: 75, aifs: 75
    },
    model_wind: {
      gfs: 27, ncum: 25, wrf: 23, ecmwf: 24, graphcast: 23, aifs: 24
    },
    recent_mae_48h: {
      wrf: 4.2, graphcast: 5.0, aifs: 5.8, ecmwf: 7.1, ncum: 18.6, gfs: 22.5
    },
  },
  {
    id: "pune-lavasa",
    name: "Lavasa / Temghar Ghat",
    lat: 18.4116,
    lng: 73.5074,
    elevation_m: 890,
    terrain_type: "Orographic Ghats Escarpment",
    coverage_radius_km: 16,
    observed_rain_24h: 162.0,
    observed_temp_c: 22.8,
    observed_humidity: 97,
    observed_wind_kmh: 32,
    observed_pressure: 918,
    model_predictions: {
      gfs: 45, ncum: 60, wrf: 175, ecmwf: 110, graphcast: 165, aifs: 130
    },
    model_temp: {
      gfs: 24.5, ncum: 24.0, wrf: 22.1, ecmwf: 22.8, graphcast: 22.5, aifs: 23.0
    },
    model_humidity: {
      gfs: 91, ncum: 93, wrf: 99, ecmwf: 96, graphcast: 98, aifs: 95
    },
    model_wind: {
      gfs: 28, ncum: 29, wrf: 34, ecmwf: 31, graphcast: 32, aifs: 30
    },
    recent_mae_48h: {
      wrf: 8.2, graphcast: 9.1, aifs: 12.8, ecmwf: 14.5, ncum: 32.1, gfs: 38.5
    },
  },
  {
    id: "pune-khadakwasla",
    name: "NDA Khadakwasla Catchment",
    lat: 18.4358,
    lng: 73.7631,
    elevation_m: 610,
    terrain_type: "Reservoir Basin / Semi-Arid Transition",
    coverage_radius_km: 12,
    observed_rain_24h: 68.5,
    observed_temp_c: 26.2,
    observed_humidity: 89,
    observed_wind_kmh: 21,
    observed_pressure: 948,
    model_predictions: {
      gfs: 40, ncum: 48, wrf: 95, ecmwf: 72, graphcast: 82, aifs: 68
    },
    model_temp: {
      gfs: 27.5, ncum: 27.0, wrf: 25.8, ecmwf: 26.1, graphcast: 26.0, aifs: 26.5
    },
    model_humidity: {
      gfs: 84, ncum: 86, wrf: 92, ecmwf: 89, graphcast: 90, aifs: 88
    },
    model_wind: {
      gfs: 23, ncum: 22, wrf: 20, ecmwf: 21, graphcast: 21, aifs: 21
    },
    recent_mae_48h: {
      graphcast: 7.2, wrf: 7.8, ecmwf: 8.4, aifs: 9.1, ncum: 15.5, gfs: 18.2
    },
  },
];

/**
 * 10-day plume anchored on the lead-day-1 station state.
 * Mean decays with lead time while spread grows 15%/day (mirrors backend).
 */
export function computeQuantileCurve(day1Station: WeatherStation): QuantileCurvePoint[] {
  const curve: QuantileCurvePoint[] = [];
  let variance = 0;
  for (const [m, p] of Object.entries(day1Station.model_predictions)) {
    variance += (day1Station.assigned_weights[m] || 0) * Math.pow(p - day1Station.consensus_blend, 2);
  }
  const baseSigma = Math.max(4.0, Math.sqrt(variance));

  for (let d = 1; d <= 10; d++) {
    const factor = leadDayFactor(d);
    const leadSigma = baseSigma * (1.0 + 0.15 * (d - 1));
    const mean = round1(Math.max(4.0, day1Station.consensus_blend * factor));
    curve.push({
      lead_day: d,
      p10: Math.max(0, round1(mean - 1.28155 * leadSigma)),
      p50: mean,
      p90: round1(mean + 1.28155 * leadSigma),
      simple_avg: round1(Math.max(3.0, day1Station.simple_average * factor)),
    });
  }
  return curve;
}

/** Offline equivalent of GET /api/v1/quantile-curve?station_id=… */
export function computeQuantileCurveForStation(stationId: string): QuantileCurvePoint[] {
  const raw = PUNE_RAW_STATIONS.find((r) => r.id === stationId);
  return raw ? computeQuantileCurve(computeStation(raw)) : [];
}

export function generateForecast(leadDay = 1): RegionForecast {
  const factor = leadDay > 1 ? leadDayFactor(leadDay) : 1.0;
  const stations = PUNE_RAW_STATIONS.map((raw) => {
    const modPredictions: Record<string, number> = {};
    for (const [m, val] of Object.entries(raw.model_predictions)) {
      modPredictions[m] = round1(val * factor);
    }
    return computeStation({ ...raw, model_predictions: modPredictions });
  });

  const blends = stations.map(s => s.consensus_blend);
  const minRain = Math.min(...blends);
  const maxRain = Math.max(...blends);
  const meanConsensus = Math.round((blends.reduce((a, b) => a + b, 0) / blends.length) * 10) / 10;
  const alertCount = stations.filter(s => !!s.active_alert).length;
  const maxDisagreement = Math.max(...stations.map(s => s.disagreement_index));

  return {
    region_id: "pune-metro",
    region_name: "Pune Metropolitan & Western Ghats",
    regime: "Active Orographic Monsoon",
    regime_confidence: 0.94,
    season: "Southwest Monsoon (JJAS)",
    lead_day: leadDay,
    stations,
    grid_summary: {
      min_rainfall_mm: minRain,
      max_rainfall_mm: maxRain,
      mean_consensus_mm: meanConsensus,
      stations_under_alert: alertCount,
      max_disagreement_mm: maxDisagreement,
    },
  };
}

export const VERIFICATION_SCORECARD: VerificationRow[] = [
  {
    model_name: "AtmosFusion Blend",
    model_type: "Hybrid AI + NWP (Dynamic)",
    day1_rmse: 11.2,
    day3_rmse: 13.1,
    heavy_rain_ets: 0.48,
    extreme_rain_csi: 0.41,
    crps_score: 4.8,
  },
  {
    model_name: "IMD Static MME",
    model_type: "Operational Ensemble",
    day1_rmse: 12.7,
    day3_rmse: 15.4,
    heavy_rain_ets: 0.38,
    extreme_rain_csi: 0.31,
    crps_score: 6.2,
  },
  {
    model_name: "Google GraphCast",
    model_type: "AI / ML Global",
    day1_rmse: 13.8,
    day3_rmse: 15.9,
    heavy_rain_ets: 0.36,
    extreme_rain_csi: 0.30,
    crps_score: 5.5,
  },
  {
    model_name: "ECMWF IFS HRES",
    model_type: "Physics NWP (9km)",
    day1_rmse: 14.1,
    day3_rmse: 16.2,
    heavy_rain_ets: 0.35,
    extreme_rain_csi: 0.28,
    crps_score: 5.8,
  },
  {
    model_name: "WRF (3km Meso)",
    model_type: "Physics NWP (High-Res)",
    day1_rmse: 14.5,
    day3_rmse: 16.8,
    heavy_rain_ets: 0.37,
    extreme_rain_csi: 0.33,
    crps_score: 5.9,
  },
  {
    model_name: "GFS / BharatFS",
    model_type: "Physics NWP (13km)",
    day1_rmse: 15.2,
    day3_rmse: 17.5,
    heavy_rain_ets: 0.32,
    extreme_rain_csi: 0.25,
    crps_score: 6.8,
  },
  {
    model_name: "NCUM",
    model_type: "Physics NWP (12km)",
    day1_rmse: 16.6,
    day3_rmse: 18.2,
    heavy_rain_ets: 0.31,
    extreme_rain_csi: 0.22,
    crps_score: 7.1,
  },
];

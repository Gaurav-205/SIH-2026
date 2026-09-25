export type Family = "physics" | "ensemble" | "ai";
export type RegionId = "konkan" | "kerala";
export type View = "p10" | "p50" | "p90" | "obs";

export interface Source { id: string; name: string; family: Family; note: string }

export interface Region {
  id: RegionId; name: string;
  lat0: number; lon0: number; nLat: number; nLon: number; step: number;
  districts: { name: string; lat: number; lon: number }[];
}

export interface Reason { text: string; effect: "up" | "down" }

/** One forecast cycle for a region, date and lead day. Arrays are row-major [lat][lon] flattened. */
export interface Cycle {
  region: Region; date: string; lead: number;
  regime: string; regimeConfidence: number;
  elevation: Float32Array;
  district: Int16Array;
  obs: Float32Array;
  sources: Record<string, Float32Array>;
  weights: Record<string, Float32Array>;
  blend: Float32Array; p10: Float32Array; p90: Float32Array; equal: Float32Array;
  spread: Float32Array;
  prob: Record<number, Float32Array>;
  reasons: (cell: number, sourceId: string) => Reason[];
}

export interface ScoreRow { lead: number; method: string; rmse: number; ets: number }

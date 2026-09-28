import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
export interface Product { status: "available" | "unavailable" | "not_applicable"; source: string; kind: "modelled"; valid_at?: string; fetched_at?: string; units?: Record<string, string> }
export interface TelemetryData {
  point_id: string; name: string; lat: number; lon: number; is_coastal: boolean; fetched_at: string;
  products: Record<"air_quality" | "surface" | "marine", Product>;
  air_quality: { time?: string; pm2_5?: number | null; pm10?: number | null; european_aqi?: number | null; uv_index?: number | null } | null;
  surface: { time?: string; relative_humidity_2m?: number | null; surface_pressure?: number | null; soil_moisture_0_to_1cm?: number | null } | null;
  marine: { time?: string; wave_height?: number | null; wave_direction?: number | null; wave_period?: number | null } | null;
}
export function useTelemetry(pointId: string) {
  return useQuery({ queryKey: ["telemetry", pointId], queryFn: () => apiRequest<TelemetryData>("GET", `/api/v1/telemetry?point_id=${encodeURIComponent(pointId)}`, { timeoutMs: 12000 }), staleTime: 300_000, retry: false });
}

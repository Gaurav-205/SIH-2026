/**
 * View state and data hooks for the signed-in app.
 * Region, date and lead day live in the URL (so every view can be shared) and default to
 * the user's saved preferences.
 */
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DATES, REGIONS } from "./meta";
import { getCycle } from "./demo";
import type { RegionId } from "./types";
import { useSession } from "@/auth/session";
import { fetchApi } from "@/lib/api";
import { computeQuantileCurveForStation, generateForecast, VERIFICATION_SCORECARD } from "@/lib/blendEngine";
import type { QuantileCurvePoint, RegionForecast, VerificationRow } from "@/types/weather";

export const LEADS = [1, 2, 3, 4, 5] as const;
export const DEFAULT_DATE = DATES[2].date;

export function useView() {
  const [params, setParams] = useSearchParams();
  const user = useSession((s) => s.user);
  const regionParam = params.get("region");
  const region: RegionId = regionParam && regionParam in REGIONS ? (regionParam as RegionId) : user?.home_region ?? "konkan";
  const date = DATES.some((d) => d.date === params.get("date")) ? params.get("date")! : DEFAULT_DATE;
  const leadParam = Number(params.get("lead"));
  const lead = leadParam >= 1 && leadParam <= 5 ? Math.round(leadParam) : Math.min(5, Math.max(1, user?.lead_day ?? 1));
  const set = (patch: Partial<{ region: RegionId; date: string; lead: number }>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => next.set(k, String(v)));
    setParams(next, { replace: true });
  };
  return { region, date, lead, set, query: params.toString() };
}

/** Gridded regional forecast cycle (deterministic demo generator, computed in the browser). */
export function useCycle() {
  const { region, date, lead } = useView();
  return useMemo(() => getCycle(region, date, lead), [region, date, lead]);
}

/** Pune station forecast: FastAPI when reachable, otherwise the identical in-browser engine. */
export function useStations(lead: number) {
  return useQuery({
    queryKey: ["stations", lead],
    queryFn: async () => {
      const live = await fetchApi<RegionForecast>(`/api/v1/regions/pune/forecast?lead_day=${lead}`);
      return live ? { data: live, live: true } : { data: generateForecast(lead), live: false };
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useQuantileCurve(stationId: string | null) {
  return useQuery({
    queryKey: ["quantile-curve", stationId],
    enabled: !!stationId,
    queryFn: async () =>
      (await fetchApi<QuantileCurvePoint[]>(`/api/v1/quantile-curve?station_id=${encodeURIComponent(stationId!)}`)) ??
      computeQuantileCurveForStation(stationId!),
    staleTime: 60_000,
  });
}

export function useBenchmark() {
  return useQuery({
    queryKey: ["benchmark"],
    queryFn: async () => (await fetchApi<VerificationRow[]>("/api/v1/scorecard")) ?? VERIFICATION_SCORECARD,
    staleTime: 60_000,
  });
}

/**
 * Live forecast cycle and scorecard, produced by the ML pipeline (ml/daily/run_cycle.py) and served by
 * the backend. Types mirror the exported JSON exactly; the app never fabricates values.
 */
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { parseCycle } from "@/features/forecast/contract";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/api";
import type { AlertLevel } from "@/lib/imd";
import type { RegionId } from "./regions";

export type Family = "physics" | "ai" | "ensemble";
export type Var = "rain" | "tmax" | "wind";

export interface Source {
  id: string;
  label: string;
  family: Family;
  live: boolean;
  run_init_utc: string | null;
}

export interface Point {
  id: string;
  name: string;
  region: RegionId;
  lat: number;
  lon: number;
  elevation_m: number | null;
}

export interface SkillStat {
  mae: number;
  bias: number;
  n: number;
  scope: "point" | "region";
}

export interface Reason {
  effect: "up" | "down";
  text: string;
}

export interface ForecastRec {
  point_id: string;
  lead: number;
  date: string;
  var: Var;
  blend: number;
  p10: number;
  p90: number;
  sigma: number;
  equal_mean: number;
  spread_sd: number;
  method: "stage_a" | "equal_weights_no_verified_history";
  weights: Record<string, number>;
  values: Record<string, number>;
  corrected: Record<string, number>;
  skill: Record<string, SkillStat>;
  prob?: Record<string, number>;
  alert_level?: AlertLevel | null;
  reasons?: Record<string, Reason[]>;
}

export interface Cycle {
  version: number;
  generated_at: string;
  issue: { init_utc: string; lead_dates: Record<string, string> };
  method: { name: string; half_life_days: number; window_days: number; min_pairs: number };
  truth: { rain: string; tmax: string; wind: string; latest_rain_truth_date: string | null; ledger_as_of: string };
  sources: Source[];
  regions: { id: RegionId; name: string }[];
  points: Point[];
  thresholds_mm: number[];
  forecasts: ForecastRec[];
  attribution: string;
}

export interface ScoreRow {
  period: "test_monsoon_2025" | "all_verified";
  lead: number;
  method: string;
  label: string;
  family: string;
  n: number;
  mae: number;
  rmse: number;
  rmse_lo: number | null;
  rmse_hi: number | null;
  bias: number;
  pod_64_5: number | null;
  far_64_5: number | null;
  ets_64_5: number | null;
  observed_heavy_days: number;
}

export interface Scorecard {
  generated_at: string;
  variable: string;
  unit: string;
  truth: string;
  points: number;
  periods: Record<string, { start: string; end: string }>;
  truth_days: Record<string, number>;
  stage_a_fallback_share: number | null;
  rows: ScoreRow[];
  note?: string;
}

export function useCycle() {
  const [params] = useSearchParams();
  const candidate = params.get("issue");
  const issue = candidate && /^\d{8}T\d{2}$/.test(candidate) ? candidate : null;
  return useQuery({
    queryKey: ["cycle", issue],
    queryFn: async () => parseCycle(await apiRequest<unknown>("GET", `/api/v1/cycle${issue ? `?issue=${issue}` : ""}`, { timeoutMs: 15000 })),
    staleTime: 5 * 60_000,
    retry: (count, err) => !(err instanceof ApiError && err.status === 503) && count < 2,
  });
}

export function useScorecard() {
  return useQuery({
    queryKey: ["scorecard"],
    queryFn: () => apiRequest<Scorecard>("GET", "/api/v1/scorecard", { timeoutMs: 15000 }),
    staleTime: 30 * 60_000,
    retry: (count, err) => !(err instanceof ApiError && err.status === 503) && count < 2,
  });
}

/** Out-of-fold validation of every method and ablation (ml.evaluate.validation), for the Verification page. */
export interface ValidationScore {
  lead: number;
  method: string;
  kind: "blend" | "source";
  n: number;
  rmse: number;
  mae: number;
  bias: number;
  ets_64_5: number | null;
  pod_64_5: number | null;
  far_64_5: number | null;
  ets_115_6: number | null;
}

export interface Validation {
  generated_at: string;
  git_commit: string | null;
  period: { start: string; end: string };
  truth: string;
  points: number;
  sources: string[];
  chosen_stage_b: string;
  scores: ValidationScore[];
  bootstrap: { lead: number; b: string; metric: "rmse" | "crps"; diff: number; lo: number; hi: number }[];
  brier: { threshold: number; method: string; n: number; events: number; bss_vs_climatology: number | null }[];
  probabilistic: { lead: number; method: string; crps_normal: number | null; quantile_score: number; coverage_10_90: number }[];
  importance: { feature: string; gain_share: number }[];
}

export function useValidation() {
  return useQuery({
    queryKey: ["validation"],
    queryFn: () => apiRequest<Validation>("GET", "/api/v1/validation", { timeoutMs: 15000 }),
    staleTime: 30 * 60_000,
    retry: (count, err) => !(err instanceof ApiError && err.status === 503) && count < 2,
  });
}

/** Fast lookups over one cycle. */
export function useCycleIndex(cycle: Cycle | undefined) {
  return useMemo(() => {
    const byKey = new Map<string, ForecastRec>();
    for (const f of cycle?.forecasts ?? []) byKey.set(`${f.point_id}|${f.lead}|${f.var}`, f);
    const sourceIndex = new Map((cycle?.sources ?? []).map((s, i) => [s.id, i] as const));
    const sourceById = new Map((cycle?.sources ?? []).map((s) => [s.id, s] as const));
    return {
      get: (pointId: string, lead: number, v: Var) => byKey.get(`${pointId}|${lead}|${v}`),
      sourceIndex: (id: string) => sourceIndex.get(id) ?? 0,
      source: (id: string) => sourceById.get(id),
    };
  }, [cycle]);
}

export { useTelemetry } from "@/features/environment/api";
export type { TelemetryData } from "@/features/environment/api";

export const fmtRunTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false });
export const fmtDay = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function useCycleHistory() {
  return useQuery({ queryKey: ["cycle-history"], queryFn: () => apiRequest<{ issues: string[] }>("GET", "/api/v1/cycles"), staleTime: 300_000, retry: false });
}

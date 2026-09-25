/**
 * Unified alert list: Pune station alerts (blending engine) + district alerts (regional grid),
 * with per-user acknowledgements stored on the server (accounts) or in the browser (demo).
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/auth/session";
import { apiRequest } from "@/lib/api";
import { byDistrict } from "./aggregate";
import { THRESHOLDS } from "./meta";
import type { Cycle } from "./types";
import type { AlertLevel, RegionForecast } from "@/types/weather";
import { useCycle, useStations, useView } from "./state";

export interface AppAlert {
  id: string;
  level: AlertLevel;
  source: "station" | "district";
  place: string;
  headline: string;
  detail: string;
  valueMm: number;
  lat?: number;
  lng?: number;
}

const LEVEL_RANK: Record<AlertLevel, number> = { Red: 3, Orange: 2, Yellow: 1 };
const THRESHOLD_LEVEL: Record<number, AlertLevel> = { 64.5: "Yellow", 115.6: "Orange", 204.5: "Red" };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function buildAlerts(
  stations: RegionForecast | undefined,
  cycle: Cycle,
  threshold: number,
  lead: number
): AppAlert[] {
  const out: AppAlert[] = [];

  for (const s of stations?.stations ?? []) {
    if (!s.alert_level) continue;
    out.push({
      id: `station:${s.id}:D${lead}`,
      level: s.alert_level,
      source: "station",
      place: s.name,
      headline: `${s.consensus_blend} mm expected at ${s.name.split(" / ")[0]}`,
      detail: `Worst case ${s.worst_case_90th} mm · ${Math.round(s.p_very_heavy * 100)}% chance of ≥115.6 mm`,
      valueMm: s.consensus_blend,
      lat: s.lat,
      lng: s.lng,
    });
  }

  const t = THRESHOLDS.find((x) => x.mm === threshold) ?? THRESHOLDS[1];
  const worst = byDistrict(cycle, cycle.p90);
  for (const d of byDistrict(cycle, cycle.prob[t.mm])) {
    if (d.max < 0.5) continue;
    const p90 = worst.find((w) => w.name === d.name)?.max ?? 0;
    out.push({
      id: `district:${cycle.region.id}:${slug(d.name)}:${cycle.date}:D${lead}:${t.mm}`,
      level: THRESHOLD_LEVEL[t.mm],
      source: "district",
      place: `${d.name}, ${cycle.region.name}`,
      headline: `${Math.round(d.max * 100)}% chance of ${t.label.toLowerCase()} rain in ${d.name}`,
      detail: `Threshold ${t.mm} mm/day · worst case ${Math.round(p90)} mm`,
      valueMm: p90,
    });
  }

  return out.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || b.valueMm - a.valueMm);
}

/* ── Acknowledgements ───────────────────────────────────── */

const DEMO_KEY = "atmosfusion.demo-acks";

function readDemoAcks(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeDemoAcks(acks: Record<string, string>) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(acks));
  } catch {
    /* storage unavailable — acks just won't persist */
  }
}

export function useAcks() {
  const mode = useSession((s) => s.mode);
  const token = useSession((s) => s.token);
  const userId = useSession((s) => s.user?.id);
  const qc = useQueryClient();
  const key = ["acks", mode, userId];

  const query = useQuery({
    queryKey: key,
    enabled: !!mode,
    queryFn: async (): Promise<Record<string, string>> => {
      if (mode === "demo") return readDemoAcks();
      const rows = await apiRequest<{ alert_id: string; acked_at: string }[]>("GET", "/api/v1/alerts/acks", { token });
      return Object.fromEntries(rows.map((r) => [r.alert_id, r.acked_at]));
    },
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: async ({ id, ack }: { id: string; ack: boolean }) => {
      if (mode === "demo") {
        const acks = readDemoAcks();
        if (ack) acks[id] = new Date().toISOString();
        else delete acks[id];
        writeDemoAcks(acks);
        return;
      }
      const path = `/api/v1/alerts/acks/${encodeURIComponent(id)}`;
      await apiRequest(ack ? "PUT" : "DELETE", path, { token });
    },
    onMutate: async ({ id, ack }) => {
      // Optimistic update so the list responds instantly
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Record<string, string>>(key);
      const next = { ...(prev ?? {}) };
      if (ack) next[id] = new Date().toISOString();
      else delete next[id];
      qc.setQueryData(key, next);
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(key, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const acks = useMemo(() => query.data ?? {}, [query.data]);
  return {
    acks,
    error: query.error ?? mutation.error,
    toggle: (id: string, ack: boolean) => mutation.mutate({ id, ack }),
  };
}

/** Alerts for the current view (lead day, region, date) and the user's threshold, with ack state. */
export function useAlerts() {
  const { lead } = useView();
  const cycle = useCycle();
  const threshold = useSession((s) => s.user?.alert_threshold ?? 115.6);
  const stations = useStations(lead);
  const { acks, toggle, error } = useAcks();
  const alerts = useMemo(() => buildAlerts(stations.data?.data, cycle, threshold, lead), [stations.data, cycle, threshold, lead]);
  const open = alerts.filter((a) => !acks[a.id]);
  return { alerts, open, acks, toggle, error, loading: stations.isLoading, cycle, threshold, stations: stations.data };
}

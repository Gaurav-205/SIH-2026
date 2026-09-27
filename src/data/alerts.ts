/**
 * Alerts from the live cycle: every district whose blended rain for the selected lead day reaches an
 * IMD alert level, or whose chance of crossing the user's threshold is at least even. Acknowledgements
 * are stored per user on the server (accounts) or in this browser (demo).
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/auth/session";
import { apiRequest } from "@/lib/api";
import type { AlertLevel } from "@/lib/imd";
import { useCycle, type Cycle } from "./cycle";
import { useView } from "./state";

export interface AppAlert {
  id: string;
  level: AlertLevel;
  pointId: string;
  place: string;
  region: string;
  date: string;
  headline: string;
  detail: string;
  valueMm: number;
  lat: number;
  lng: number;
}

const LEVEL_RANK: Record<AlertLevel, number> = { Red: 3, Orange: 2, Yellow: 1 };
const THRESHOLD_LEVEL: Record<string, AlertLevel> = { "64.5": "Yellow", "115.6": "Orange", "204.5": "Red" };

export function issueId(cycle: Cycle): string {
  return cycle.issue.init_utc.slice(0, 13).replace(/[-:]/g, "");
}

export function buildAlerts(cycle: Cycle | undefined, lead: number, threshold: number): AppAlert[] {
  if (!cycle) return [];
  const points = new Map(cycle.points.map((p) => [p.id, p]));
  const regionName = new Map(cycle.regions.map((r) => [r.id, r.name]));
  const key = String(threshold);
  const out: AppAlert[] = [];
  for (const f of cycle.forecasts) {
    if (f.var !== "rain" || f.lead !== lead) continue;
    const pUser = f.prob?.[key] ?? 0;
    const level: AlertLevel | null = f.alert_level ?? (pUser >= 0.5 ? THRESHOLD_LEVEL[key] : null);
    if (!level) continue;
    const p = points.get(f.point_id);
    if (!p) continue;
    out.push({
      id: `district:${f.point_id}:${issueId(cycle)}:D${lead}`,
      level,
      pointId: f.point_id,
      place: p.name,
      region: regionName.get(p.region) ?? p.region,
      date: f.date,
      headline: `${Math.round(f.blend)} mm expected in ${p.name}`,
      detail: `Range ${Math.round(f.p10)}–${Math.round(f.p90)} mm · ${Math.round(pUser * 100)}% chance of ≥${threshold} mm`,
      valueMm: f.blend,
      lat: p.lat,
      lng: p.lon,
    });
  }
  return out.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || b.valueMm - a.valueMm);
}

/* ── Acknowledgements ───────────────────────────────────── */

const DEMO_KEY = "bharosa.demo-acks";
const DEMO_KEY_LEGACY = "atmosfusion.demo-acks";

function readDemoAcks(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) || localStorage.getItem(DEMO_KEY_LEGACY) || "{}");
  } catch {
    return {};
  }
}

function writeDemoAcks(acks: Record<string, string>) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(acks));
  } catch {
    /* storage unavailable: acknowledgements just won't persist */
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
      await apiRequest(ack ? "PUT" : "DELETE", `/api/v1/alerts/acks/${encodeURIComponent(id)}`, { token });
    },
    onMutate: async ({ id, ack }) => {
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
  return { acks, error: query.error ?? mutation.error, toggle: (id: string, ack: boolean) => mutation.mutate({ id, ack }) };
}

/** Alerts for the current lead day and the user's threshold, with acknowledgement state. */
export function useAlerts() {
  const { lead } = useView();
  const threshold = useSession((s) => s.user?.alert_threshold ?? 115.6);
  const cycle = useCycle();
  const { acks, toggle, error } = useAcks();
  const alerts = useMemo(() => buildAlerts(cycle.data, lead, threshold), [cycle.data, lead, threshold]);
  const open = alerts.filter((a) => !acks[a.id]);
  return { alerts, open, acks, toggle, error, cycle, threshold, lead };
}

import type { Cycle } from "../../data/cycle";
export const FRESHNESS_HOURS = 24;
export function forecastFreshness(cycle: Pick<Cycle, "issue" | "generated_at"> | undefined, now: number) {
  if (!cycle) return { state: "missing", label: "Awaiting forecast", ageHours: null } as const;
  const issue = Date.parse(cycle.issue.init_utc);
  const publication = Date.parse(cycle.generated_at);
  const ageHours = Math.max(now - issue, now - publication) / 3_600_000;
  if (!Number.isFinite(ageHours) || issue > now + 900_000 || publication > now + 900_000) return { state: "unknown", label: "Time unverified", ageHours: null } as const;
  return ageHours > FRESHNESS_HOURS
    ? { state: "stale", label: "Older forecast", ageHours } as const
    : { state: "current", label: "Latest available", ageHours } as const;
}
export function selectDistrict(cycle: Cycle | undefined, region: string, requested: string | null) {
  const points = cycle?.points.filter((p) => p.region === region) ?? [];
  return points.find((p) => p.id === requested) ?? points[0];
}
export function districtLink(region: string, district: string, lead: number) {
  return `/app/districts?${new URLSearchParams({ region, district, lead: String(lead) })}`;
}

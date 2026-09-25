/**
 * View state for the signed-in app. Region and lead day live in the URL (so every view can be shared)
 * and default to the user's saved preferences. The forecast itself always comes from the live cycle.
 */
import { useSearchParams } from "react-router-dom";
import { useSession } from "@/auth/session";
import { REGIONS, type RegionId } from "./regions";

export const LEADS = [1, 2, 3, 4, 5] as const;

export function useView() {
  const [params, setParams] = useSearchParams();
  const user = useSession((s) => s.user);
  const regionParam = params.get("region");
  const region: RegionId = regionParam && regionParam in REGIONS ? (regionParam as RegionId) : user?.home_region ?? "konkan";
  const leadParam = Number(params.get("lead"));
  const lead = leadParam >= 1 && leadParam <= 5 ? Math.round(leadParam) : Math.min(5, Math.max(1, user?.lead_day ?? 1));
  const set = (patch: Partial<{ region: RegionId; lead: number }>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => next.set(k, String(v)));
    setParams(next, { replace: true });
  };
  return { region, lead, set, query: params.toString() };
}

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/auth/session";
export interface Operations {
  status: string; checked_at: string; freshness_limit_hours: number;
  cycle: null | { init_utc: string; generated_at: string; issue_age_hours: number | null; publication_age_hours: number | null; points: number; records: number; live_sources: number; latest_rain_truth_date: string | null };
  sources: { id: string; label: string; family: string; live: boolean; run_init_utc: string | null; record_count: number; status: string }[];
  users: { total: number; onboarded: number; acknowledgements: number };
  exports: { cycles: number; scorecard: boolean; validation: boolean };
  note: string;
}
export function useOperations() {
  const token = useSession((s) => s.token);
  const userId = useSession((s) => s.user?.id);
  return useQuery({ queryKey: ["operations", userId], queryFn: () => apiRequest<Operations>("GET", "/api/v1/admin/overview", { token }), enabled: !!token, retry: false, staleTime: 0, refetchInterval: 60_000 });
}

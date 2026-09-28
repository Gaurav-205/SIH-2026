import type { ReactNode } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { Spinner } from "./ui";
export default function LiveState({ loading, error, children, what = "the forecast", hasData = false, onRetry }: { loading: boolean; error: unknown; children: ReactNode; what?: string; hasData?: boolean; onRetry?: () => void }) {
  const qc = useQueryClient();
  if (loading) return <Spinner label={`Loading ${what}`} />;
  if (!error) return <>{children}</>;
  const missing = error instanceof ApiError && error.status === 503;
  const retry = onRetry ?? (() => { void qc.invalidateQueries(); });
  if (hasData) return <><div role="status" className="mb-4 rounded-xl border border-warn/30 bg-warn-soft p-4 text-sm text-warn">The latest update could not be retrieved. Showing the last available forecast. <button type="button" className="ml-2 underline" onClick={retry}>Try again</button></div>{children}</>;
  return <section className="empty-forecast" aria-labelledby="empty-title">
    <div className="empty-orbit" aria-hidden="true"><CloudOff size={34} /></div><p className="eyebrow mt-7">A CLEAR PICTURE NEEDS GOOD DATA</p>
    <h2 id="empty-title" className="mt-3 text-2xl font-semibold">{missing ? "The next outlook is on its way." : "We couldn’t retrieve the outlook."}</h2>
    <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">{missing ? "There isn’t a readable publication available yet. Check back after the next update. Missing forecasts are never replaced with estimated placeholders." : "The forecast service is temporarily unavailable. Try again in a moment, or consult the latest official advisories."}</p>
    <div className="mt-6 flex flex-wrap justify-center gap-3"><button type="button" onClick={retry} className="spatial-toggle"><RefreshCw size={16} />Try again</button><a href="https://mausam.imd.gov.in/" target="_blank" rel="noreferrer" className="spatial-toggle">Official IMD advisories ↗</a></div>
    <p className="mt-8 text-xs text-muted">Bharosa · District rainfall forecasts for Konkan, Goa and Kerala</p>
  </section>;
}

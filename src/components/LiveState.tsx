import type { ReactNode } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { cx } from "@/lib/cx";
import { Spinner } from "./ui";

/**
 * Loading / error / empty wrapper for anything read from the pipeline exports.
 * `what` names the publication ("the forecast", "the scorecard", …) so the empty state says what is missing.
 * `compact` is for secondary panels that sit below a page's main content.
 */
export default function LiveState({
  loading,
  error,
  children,
  what = "the forecast",
  hasData = false,
  onRetry,
  compact = false,
}: {
  loading: boolean;
  error: unknown;
  children: ReactNode;
  what?: string;
  hasData?: boolean;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  if (loading) return <Spinner label={`Loading ${what}`} />;
  if (!error) return <>{children}</>;
  const missing = error instanceof ApiError && error.status === 503;
  const retry = onRetry ?? (() => void qc.invalidateQueries());
  if (hasData)
    return (
      <>
        <div role="status" className="notice notice-warn mb-4">
          The latest update could not be retrieved. Showing the last available version of {what}.
          <button type="button" className="ml-2 font-semibold underline" onClick={retry}>
            Try again
          </button>
        </div>
        {children}
      </>
    );
  const Heading = compact ? "h3" : "h2";
  return (
    <section className={cx("empty-state", compact && "empty-state-compact")} aria-label={missing ? `${what} not published` : `${what} unavailable`}>
      <div className="empty-orbit" aria-hidden="true">
        <CloudOff size={compact ? 24 : 32} />
      </div>
      <Heading className={cx("font-semibold tracking-tight", compact ? "mt-4 text-lg" : "mt-6 text-2xl")}>
        {missing ? `${capitalise(what)} hasn’t been published yet.` : `We couldn’t retrieve ${what}.`}
      </Heading>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {missing
          ? "It appears after the next pipeline run. Missing data is never replaced with estimated placeholders."
          : "The forecast service is temporarily unavailable. Try again in a moment, or consult the latest official advisories."}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={retry} className="btn-outline">
          <RefreshCw size={15} aria-hidden="true" />
          Try again
        </button>
        {!compact && (
          <a href="https://mausam.imd.gov.in/" target="_blank" rel="noreferrer" className="btn-outline">
            Official IMD advisories ↗
          </a>
        )}
      </div>
    </section>
  );
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

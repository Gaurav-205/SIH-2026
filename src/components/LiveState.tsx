import type { ReactNode } from "react";
import { CloudOff, Hourglass, TriangleAlert } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Spinner } from "./ui";

/** The command the backend's 503 message names ("... Run the pipeline: <command>"). */
function pipelineCommand(error: unknown): string {
  const m = error instanceof Error ? /Run the pipeline: (.+)$/.exec(error.message) : null;
  return m ? m[1] : "python -m ml.daily.run_cycle";
}

/**
 * Loading and error states for pages backed by the live pipeline. There is no offline fallback:
 * without the backend there is no data to show, and the page says exactly why.
 */
export default function LiveState({ loading, error, children, what = "the live forecast" }: { loading: boolean; error: unknown; children: ReactNode; what?: string }) {
  if (loading) return <Spinner label={`Loading ${what}`} />;
  if (!error) return <>{children}</>;
  const status = error instanceof ApiError ? error.status : -1;
  const [Icon, title, body, cmd] =
    status === 0
      ? [CloudOff, "Backend not reachable", "Live data comes from the AtmosFusion backend. Start it, then reload:", "cd backend && uvicorn main:app --port 8000"]
      : status === 503
      ? [Hourglass, `No ${what.replace(/^the /, "")} yet`, "The backend is running but the pipeline hasn't produced this yet. Run:", pipelineCommand(error)]
      : [TriangleAlert, "Couldn't load live data", error instanceof Error ? error.message : "Unexpected error", null];
  return (
    <div className="card mx-auto mt-8 max-w-lg p-8 text-center">
      <Icon className="mx-auto h-8 w-8 text-muted" />
      <h2 className="mt-4 text-lg font-semibold text-fg">{title}</h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
      {cmd && <pre className="mt-4 overflow-x-auto rounded-lg bg-subtle px-4 py-3 text-left text-xs text-fg">{cmd}</pre>}
    </div>
  );
}

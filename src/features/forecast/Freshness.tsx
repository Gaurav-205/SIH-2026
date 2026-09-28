import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import type { Cycle } from "@/data/cycle";
import { forecastFreshness } from "./domain";
export default function Freshness({ cycle }: { cycle: Cycle | undefined }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);
  const state = forecastFreshness(cycle, now);
  return <span className={`inline-flex items-center gap-1.5 text-xs ${state.state === "stale" || state.state === "unknown" ? "text-warn" : "text-muted"}`}>
    <Clock3 size={14} aria-hidden="true" />{state.label}
    {state.ageHours !== null && <span>· {Math.max(0, Math.floor(state.ageHours))}h since run</span>}
  </span>;
}

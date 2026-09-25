import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bell, CheckCircle2, CloudRain, Cpu } from "lucide-react";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import AlertItem from "@/components/AlertItem";
import DistrictMap from "@/components/DistrictMap";
import LiveState from "@/components/LiveState";
import { firstName, useSession } from "@/auth/session";
import { useAlerts } from "@/data/alerts";
import { fmtDay, fmtRunTime, useCycleIndex } from "@/data/cycle";
import { REGIONS } from "@/data/regions";
import { useView } from "@/data/state";
import { imdCategory } from "@/lib/imd";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Overview() {
  const user = useSession((s) => s.user)!;
  const mode = useSession((s) => s.mode);
  const { region, lead, query } = useView();
  const { alerts, open, acks, toggle, cycle } = useAlerts();
  const idx = useCycleIndex(cycle.data);
  const c = cycle.data;

  const rows = useMemo(() => {
    if (!c) return [];
    return c.points
      .filter((p) => p.region === region)
      .map((p) => ({ p, f: idx.get(p.id, lead, "rain") }))
      .filter((r) => r.f)
      .sort((a, b) => b.f!.blend - a.f!.blend);
  }, [c, idx, region, lead]);

  const live = c?.sources.filter((s) => s.live) ?? [];
  const ai = live.filter((s) => s.family === "ai");
  const weighted = rows.filter((r) => r.f!.method === "stage_a").length;
  const regionOpen = open.filter((a) => rows.some((r) => r.p.id === a.pointId));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={mode === "demo" ? `${greeting()} — welcome to the demo` : `${greeting()}, ${firstName(user)}`}
        description={
          c ? (
            <>
              {REGIONS[region].name} · rain day ending 08:30 IST {fmtDay.format(new Date(c.issue.lead_dates[String(lead)]))} (day {lead}) · models run{" "}
              {fmtRunTime.format(new Date(c.issue.init_utc))} UTC
            </>
          ) : undefined
        }
      />
      <LiveState loading={cycle.isLoading} error={cycle.error}>
        {c && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <Stat
                label="Open alerts"
                value={regionOpen.length}
                sub={`${alerts.length - open.length} of ${alerts.length} acknowledged (both regions)`}
                tone={regionOpen.some((a) => a.level === "Red") ? "danger" : regionOpen.length ? "warn" : "ok"}
                icon={<Bell className="h-4 w-4" />}
              />
              <Stat
                label="Wettest district"
                value={rows[0] ? `${Math.round(rows[0].f!.blend)} mm` : "—"}
                sub={rows[0] ? `${rows[0].p.name} · up to ${Math.round(rows[0].f!.p90)} mm worst case` : undefined}
                tone="accent"
                icon={<CloudRain className="h-4 w-4" />}
              />
              <Stat
                label="Models blended"
                value={live.length}
                sub={`${ai.length} AI (${ai.map((s) => s.label).join(", ")}) · rest physics/ensemble`}
                icon={<Cpu className="h-4 w-4" />}
              />
              <Stat
                label="Skill-weighted districts"
                value={`${weighted}/${rows.length}`}
                sub={c.truth.latest_rain_truth_date ? `IMD rain verified to ${c.truth.latest_rain_truth_date}` : "No verified rain yet"}
                tone={weighted ? "ok" : "warn"}
                icon={<CheckCircle2 className="h-4 w-4" />}
              />
            </div>
            {weighted < rows.length && (
              <p className="mt-3 rounded-lg border border-warn/25 bg-warn-soft px-3 py-2 text-sm text-warn">
                {rows.length - weighted} districts are shown as an equal-weight mean: their models don't yet have {c.method.min_pairs} verified
                days in the last {c.method.window_days}. They switch to skill weighting as archived forecasts and IMD truth accumulate.
              </p>
            )}

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
              <Card
                title={`Rainfall, ${REGIONS[region].name}`}
                description="Blended 24-hour forecast per district"
                action={
                  <Link to={{ pathname: "/app/forecast", search: query }} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                    Open forecast <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                }
              >
                <DistrictMap
                  points={rows.map((r) => ({ ...r.p, alert: r.f!.alert_level }))}
                  colorOf={(p) => imdCategory(idx.get(p.id, lead, "rain")!.blend).color}
                  valueOf={(p) => `${Math.round(idx.get(p.id, lead, "rain")!.blend)} mm`}
                  tooltip={(p) => {
                    const f = idx.get(p.id, lead, "rain")!;
                    return `${f.blend.toFixed(1)} mm (range ${f.p10.toFixed(0)}–${f.p90.toFixed(0)}) · equal mean ${f.equal_mean.toFixed(1)} mm`;
                  }}
                  className="h-[380px]"
                />
              </Card>

              <Card
                title="Needs attention"
                description={`IMD alert levels, or ≥50% chance of ${user.alert_threshold} mm (your threshold)`}
                action={
                  <Link to={{ pathname: "/app/alerts", search: query }} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                    All alerts <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                }
                bodyClassName="py-1"
              >
                {regionOpen.length === 0 ? (
                  <div className="grid min-h-[140px] place-items-center text-center">
                    <div>
                      <p className="font-medium text-fg">All clear</p>
                      <p className="mt-1 text-sm text-muted">No open alerts in {REGIONS[region].name} for day {lead}.</p>
                    </div>
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {regionOpen.slice(0, 5).map((a) => (
                      <AlertItem key={a.id} alert={a} ackedAt={acks[a.id]} onToggle={(ack) => toggle(a.id, ack)} compact />
                    ))}
                  </ul>
                )}
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="border-t border-line text-left text-xs text-muted">
                      <th className="pb-1 pt-3 font-medium">Wettest districts</th>
                      <th className="pb-1 pt-3 text-right font-medium">Blend</th>
                      <th className="pb-1 pt-3 text-right font-medium">Worst</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.slice(0, 5).map(({ p, f }) => (
                      <tr key={p.id}>
                        <td className="py-2 text-fg">
                          <Link to={{ pathname: "/app/districts", search: `${query}${query ? "&" : ""}district=${p.id}` }} className="hover:underline">
                            {p.name}
                          </Link>{" "}
                          {f!.alert_level && <Badge tone={f!.alert_level === "Red" ? "danger" : "warn"}>{f!.alert_level}</Badge>}
                        </td>
                        <td className="num py-2 text-right font-medium text-fg">{f!.blend.toFixed(1)}</td>
                        <td className="num py-2 text-right text-muted">{f!.p90.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
            <p className="mt-6 text-xs text-muted">{c.attribution}</p>
          </>
        )}
      </LiveState>
    </div>
  );
}

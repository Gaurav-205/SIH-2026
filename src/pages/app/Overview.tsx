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

            {/* Pune & Mumbai Meteorological Spotlight */}
            <div className="mt-6 rounded-2xl border border-line bg-gradient-to-br from-subtle/80 via-surface to-surface p-5 shadow-xs">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-fg animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-fg">Maharashtra Focus Hub</span>
                  </div>
                  <h3 className="mt-1 text-base font-semibold text-fg">Pune & Mumbai Microclimate Intelligence</h3>
                  <p className="text-xs text-muted">
                    High-resolution multi-model blending targeting Pune's dual orographic zones (Ghats vs Plains) and Mumbai coastal MMR.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={{ pathname: "/app/districts", search: `${query}${query ? "&" : ""}district=pune-ghats` }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg hover:bg-subtle transition shadow-xs"
                  >
                    Pune Ghats <ArrowRight className="h-3 w-3" />
                  </Link>
                  <Link
                    to={{ pathname: "/app/districts", search: `${query}${query ? "&" : ""}district=pune-plains` }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg hover:bg-subtle transition shadow-xs"
                  >
                    Pune Plains <ArrowRight className="h-3 w-3" />
                  </Link>
                  <Link
                    to={{ pathname: "/app/districts", search: `${query}${query ? "&" : ""}district=mumbai` }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg hover:bg-subtle transition shadow-xs"
                  >
                    Mumbai MMR <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {/* Sub-cards */}
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  {
                    id: "pune-ghats",
                    name: "Pune Ghats (Catchment)",
                    tag: "Catchment Basin",
                    sub: "Lonavala / Mulshi / Khadakwasla dams",
                  },
                  {
                    id: "pune-plains",
                    name: "Pune City & Plains",
                    tag: "Urban Core",
                    sub: "Shivajinagar / Haveli / Pune Urban",
                  },
                  {
                    id: "mumbai",
                    name: "Mumbai Metropolitan",
                    tag: "Coastal MMR",
                    sub: "Colaba / Santacruz / Harbour",
                  },
                ].map((item) => {
                  const data = idx.get(item.id, lead, "rain");
                  return (
                    <Link
                      key={item.id}
                      to={{ pathname: "/app/districts", search: `${query}${query ? "&" : ""}district=${item.id}` }}
                      className="group block rounded-xl border border-line bg-surface p-4 transition-all hover:border-fg/40 hover:shadow-card"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="rounded bg-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                          {item.tag}
                        </span>
                        {data?.alert_level ? (
                          <Badge tone={data.alert_level === "Red" ? "danger" : "warn"}>{data.alert_level}</Badge>
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5 text-muted opacity-0 transition group-hover:opacity-100 group-hover:text-fg" />
                        )}
                      </div>
                      <h4 className="mt-2 text-sm font-semibold text-fg group-hover:text-fg transition-colors">
                        {item.name}
                      </h4>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold tracking-tight text-fg">
                          {data ? data.blend.toFixed(1) : "—"}
                        </span>
                        <span className="text-xs font-medium text-muted">mm/24h</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted">
                        <span>Range: <b className="text-fg">{data ? `${data.p10.toFixed(0)}–${data.p90.toFixed(0)}` : "—"}</b> mm</span>
                        <span>Equal: <b className="text-fg">{data ? data.equal_mean.toFixed(1) : "—"}</b> mm</span>
                      </div>
                      <p className="mt-2 border-t border-line/60 pt-2 text-[11px] text-muted truncate">
                        {item.sub}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
              <Card
                title={`Rainfall Map · ${REGIONS[region].name}`}
                description="Blended 24-hour forecast distribution per district"
                action={
                  <Link to={{ pathname: "/app/forecast", search: query }} className="inline-flex items-center gap-1 text-xs font-semibold text-fg hover:underline">
                    Detailed forecast <ArrowRight className="h-3 w-3" />
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
                  className="h-[400px]"
                />
              </Card>

              <div className="flex flex-col gap-6">
                <Card
                  title="Needs attention"
                  description={`IMD alerts or ≥50% chance of exceeding ${user.alert_threshold} mm`}
                  action={
                    <Link to={{ pathname: "/app/alerts", search: query }} className="inline-flex items-center gap-1 text-xs font-semibold text-fg hover:underline">
                      All alerts ({regionOpen.length}) <ArrowRight className="h-3 w-3" />
                    </Link>
                  }
                  badge={regionOpen.length > 0 ? <Badge tone="warn">{regionOpen.length} active</Badge> : undefined}
                  bodyClassName="py-1"
                >
                  {regionOpen.length === 0 ? (
                    <div className="flex items-center justify-center gap-3 py-6 text-center">
                      <CheckCircle2 className="h-5 w-5 text-fg flex-shrink-0" />
                      <div className="text-left">
                        <p className="text-sm font-semibold text-fg">All clear</p>
                        <p className="text-xs text-muted">No open alerts in {REGIONS[region].name} for day {lead}.</p>
                      </div>
                    </div>
                  ) : (
                    <ul className="divide-y divide-line">
                      {regionOpen.slice(0, 4).map((a) => (
                        <AlertItem key={a.id} alert={a} ackedAt={acks[a.id]} onToggle={(ack) => toggle(a.id, ack)} compact />
                      ))}
                    </ul>
                  )}
                </Card>

                <Card
                  title="Wettest Districts"
                  description="Top districts ranked by blended 24h precipitation"
                  action={
                    <Link to={{ pathname: "/app/forecast", search: query }} className="inline-flex items-center gap-1 text-xs font-semibold text-fg hover:underline">
                      Full rankings <ArrowRight className="h-3 w-3" />
                    </Link>
                  }
                  bodyClassName="p-0"
                >
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-line bg-subtle/50 text-left text-muted">
                        <th className="py-2.5 pl-4 pr-2 font-semibold">#</th>
                        <th className="py-2.5 px-2 font-semibold">District</th>
                        <th className="py-2.5 px-2 text-right font-semibold">Blend</th>
                        <th className="py-2.5 pr-4 pl-2 text-right font-semibold">Worst (P90)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {rows.slice(0, 5).map(({ p, f }, rank) => (
                        <tr key={p.id} className="hover:bg-subtle/50 transition-colors">
                          <td className="py-2 pl-4 pr-2 font-semibold text-muted">#{rank + 1}</td>
                          <td className="py-2 px-2 text-fg">
                            <Link to={{ pathname: "/app/districts", search: `${query}${query ? "&" : ""}district=${p.id}` }} className="font-medium hover:underline">
                              {p.name}
                            </Link>{" "}
                            {f!.alert_level && <Badge tone={f!.alert_level === "Red" ? "danger" : "warn"}>{f!.alert_level}</Badge>}
                          </td>
                          <td className="num py-2 px-2 text-right font-bold text-fg">{f!.blend.toFixed(1)} mm</td>
                          <td className="num py-2 pr-4 pl-2 text-right text-muted">{f!.p90.toFixed(0)} mm</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            </div>
            <p className="mt-6 text-xs text-muted">{c.attribution}</p>
          </>
        )}
      </LiveState>
    </div>
  );
}

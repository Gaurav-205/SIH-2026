import { useMemo, useState } from "react";
import { Card, PageHeader, Segmented } from "@/components/ui";
import DistrictMap from "@/components/DistrictMap";
import LiveState from "@/components/LiveState";
import { useCycle, useCycleIndex, type Cycle, type ForecastRec } from "@/data/cycle";
import { REGIONS } from "@/data/regions";
import { useView } from "@/data/state";
import { FAMILY_LABEL, sourceColor } from "@/lib/imd";

function topSource(f: ForecastRec): [string, number] | null {
  const e = Object.entries(f.weights);
  return e.length ? e.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;
}

function spreadColor(sd: number) {
  return sd >= 40 ? "#09090b" : sd >= 20 ? "#3f3f46" : sd >= 10 ? "#71717a" : "#d4d4d8";
}

export default function Models() {
  const { region, lead } = useView();
  const cycle = useCycle();
  const c: Cycle | undefined = cycle.data;
  const idx = useCycleIndex(c);
  const [tab, setTab] = useState<"trust" | "spread">("trust");

  const rows = useMemo(
    () =>
      (c?.points ?? [])
        .filter((p) => p.region === region)
        .map((p) => ({ p, f: idx.get(p.id, lead, "rain")! }))
        .filter((r) => r.f),
    [c, idx, region, lead]
  );
  const live = (c?.sources ?? []).filter((s) => s.live);
  const weighted = rows.filter((r) => r.f.method === "stage_a");

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Models"
        description={`How ${live.length} live physics, ensemble and AI models were weighted for day-${lead} rain over ${REGIONS[region].name}, and where they disagree.`}
        actions={<Segmented label="Models view" value={tab} onChange={setTab} options={[{ value: "trust", label: "Trust Map" }, { value: "spread", label: "Disagreement" }]} />}
      />
      <LiveState loading={cycle.isLoading} error={cycle.error}>
        {c && tab === "trust" && (
          <div className="space-y-6">
            {weighted.length === 0 && (
              <p className="rounded-lg border border-warn/25 bg-warn-soft px-3 py-2 text-sm text-warn">
                No district has enough verified history yet, so every model has equal weight. The Trust Map fills in as archived forecasts are
                verified against IMD rain.
              </p>
            )}
            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <Card title="Trust Map" description="Colour = the model with the largest weight in each district">
                <DistrictMap
                  points={rows.map((r) => r.p)}
                  colorOf={(p) => {
                    const t = topSource(idx.get(p.id, lead, "rain")!);
                    return t ? sourceColor(idx.sourceIndex(t[0])) : "#a1a1aa";
                  }}
                  valueOf={(p) => {
                    const f = idx.get(p.id, lead, "rain")!;
                    const t = topSource(f);
                    return f.method === "stage_a" && t ? `${idx.source(t[0])?.label ?? t[0]} ${Math.round(t[1] * 100)}%` : "equal";
                  }}
                  className="h-[460px]"
                />
              </Card>
              <Card title="Live models" description="Run times come from each provider's metadata" bodyClassName="p-0">
                <ul className="divide-y divide-line text-sm">
                  {c.sources.map((s, i) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-subtle/30 transition-colors">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full border border-line" style={{ background: sourceColor(i) }} />
                        <span className={s.live ? "font-medium text-fg" : "text-muted line-through"}>{s.label}</span>
                        <span className="text-xs text-muted">{FAMILY_LABEL[s.family]}</span>
                      </span>
                      <span className="num text-xs text-muted">
                        {s.live ? (s.run_init_utc ? `${s.run_init_utc.slice(0, 16).replace("T", " ")} UTC` : "run time n/a") : "discontinued"}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
            <Card title="Weight matrix" description="Share of the blend each model earned, per district (blank = not weighted)" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line bg-subtle/50 text-left text-muted">
                      <th className="sticky left-0 bg-surface px-4 py-2.5 font-semibold z-10 border-r border-line/40">District</th>
                      {live.map((s) => (
                        <th key={s.id} className="px-2.5 py-2.5 text-right font-semibold" title={s.label}>
                          {s.label.replace(/^(ECMWF|NCEP|DWD|JMA|CMA|ECCC|Météo-France|UK Met Office|BOM) /, "")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map(({ p, f }) => (
                      <tr key={p.id} className="hover:bg-subtle/30 transition-colors">
                        <td className="sticky left-0 bg-surface px-4 py-2 font-medium text-fg z-10 border-r border-line/40">{p.name}</td>
                        {live.map((s) => {
                          const w = f.weights[s.id];
                          return (
                            <td
                              key={s.id}
                              className="num px-2.5 py-2 text-right transition-colors"
                              style={
                                w !== undefined
                                  ? {
                                      background: `rgb(var(--fg) / ${Math.min(0.85, w * 1.6)})`,
                                      color: w > 0.3 ? "rgb(var(--surface))" : undefined,
                                    }
                                  : undefined
                              }
                            >
                              {w !== undefined ? Math.round(w * 100) : ""}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {c && tab === "spread" && (
          <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
            <Card title="Spread between models" description="Standard deviation of the live model forecasts (mm)">
              <DistrictMap
                points={rows.map((r) => r.p)}
                colorOf={(p) => spreadColor(idx.get(p.id, lead, "rain")!.spread_sd)}
                valueOf={(p) => `±${idx.get(p.id, lead, "rain")!.spread_sd.toFixed(0)}`}
                className="h-[460px]"
              />
            </Card>
            <Card title="Each model on its own" description="Raw day-lead rain forecast per district (mm), before bias correction" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line bg-subtle/50 text-left text-muted">
                      <th className="sticky left-0 bg-surface px-4 py-2.5 font-semibold z-10 border-r border-line/40">District</th>
                      {live.map((s) => (
                        <th key={s.id} className="px-2.5 py-2.5 text-right font-semibold" title={s.label}>
                          {s.label.replace(/^(ECMWF|NCEP|DWD|JMA|CMA|ECCC|Météo-France|UK Met Office|BOM) /, "")}
                        </th>
                      ))}
                      <th className="px-4 py-2.5 text-right font-semibold">± SD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {[...rows].sort((a, b) => b.f.spread_sd - a.f.spread_sd).map(({ p, f }) => (
                      <tr key={p.id} className="hover:bg-subtle/30 transition-colors">
                        <td className="sticky left-0 bg-surface px-4 py-2 font-medium text-fg z-10 border-r border-line/40">{p.name}</td>
                        {live.map((s) => (
                          <td key={s.id} className="num px-2.5 py-2 text-right text-fg">{f.values[s.id] !== undefined ? f.values[s.id].toFixed(1) : "—"}</td>
                        ))}
                        <td className="num px-4 py-2 text-right font-bold text-fg">{f.spread_sd.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </LiveState>
    </div>
  );
}

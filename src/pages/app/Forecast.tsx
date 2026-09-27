import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Card, PageHeader, Segmented } from "@/components/ui";
import DistrictMap from "@/components/DistrictMap";
import LiveState from "@/components/LiveState";
import { cx } from "@/lib/cx";
import { fmtDay, useCycle, useCycleIndex, type ForecastRec } from "@/data/cycle";
import { REGIONS } from "@/data/regions";
import { useView } from "@/data/state";
import { IMD_CATEGORIES, imdCategory } from "@/lib/imd";

type View = "p10" | "blend" | "p90" | "equal_mean";

const VIEWS: { value: View; label: string; help: string }[] = [
  { value: "p10", label: "Best case", help: "10th percentile: 9 in 10 chance of more rain than this" },
  { value: "blend", label: "Most likely", help: "The Bharosa blend" },
  { value: "p90", label: "Worst case", help: "90th percentile: 1 in 10 chance of more rain than this" },
  { value: "equal_mean", label: "Equal mean", help: "Plain average of all live models, for comparison" },
];

export default function Forecast() {
  const { region, lead, query } = useView();
  const cycle = useCycle();
  const c = cycle.data;
  const idx = useCycleIndex(c);
  const [view, setView] = useState<View>("blend");
  const viewInfo = VIEWS.find((x) => x.value === view)!;

  const rows = useMemo(
    () =>
      (c?.points ?? [])
        .filter((p) => p.region === region)
        .map((p) => ({ p, f: idx.get(p.id, lead, "rain") as ForecastRec }))
        .filter((r) => r.f)
        .sort((a, b) => b.f.blend - a.f.blend),
    [c, idx, region, lead]
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Rainfall forecast, ${REGIONS[region].name}`}
        description={
          c ? `24-hour rain ending 08:30 IST on ${fmtDay.format(new Date(c.issue.lead_dates[String(lead)]))} (day ${lead}), blended from ${c.sources.filter((s) => s.live).length} live models. ${viewInfo.help}.` : undefined
        }
      />
      <LiveState loading={cycle.isLoading} error={cycle.error}>
        {c && (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <Card title={viewInfo.label} action={<Segmented size="sm" label="Which forecast" value={view} onChange={setView} options={VIEWS.map((x) => ({ value: x.value, label: x.label, title: x.help }))} />}>
              <DistrictMap
                points={rows.map((r) => ({ ...r.p, alert: r.f.alert_level }))}
                colorOf={(p) => imdCategory(idx.get(p.id, lead, "rain")![view]).color}
                valueOf={(p) => `${Math.round(idx.get(p.id, lead, "rain")![view])} mm`}
                tooltip={(p) => {
                  const f = idx.get(p.id, lead, "rain")!;
                  return `Best ${f.p10.toFixed(0)} · likely ${f.blend.toFixed(1)} · worst ${f.p90.toFixed(0)} mm`;
                }}
                className="h-[520px]"
              />
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="IMD rainfall categories">
                {[...IMD_CATEGORIES].reverse().map((cat) => (
                  <li key={cat.label} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full border border-line" style={{ background: cat.color }} />
                    {cat.label} {cat.min > 0 ? `≥ ${cat.min}` : ""}
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="By district" description="mm per 24 h; sorted by the blend" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line bg-subtle/50 text-left text-muted">
                      <th className="px-4 py-2.5 font-semibold">District</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Best (P10)</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Blend</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Worst (P90)</th>
                      <th className="py-2.5 pl-2 pr-4 text-right font-semibold">Equal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map(({ p, f }) => (
                      <tr key={p.id} className="hover:bg-subtle/40 transition-colors">
                        <td className="px-4 py-2.5 text-fg">
                          <Link to={{ pathname: "/app/districts", search: `${query}${query ? "&" : ""}district=${p.id}` }} className="font-medium hover:text-accent hover:underline">
                            {p.name}
                          </Link>
                          {f.alert_level && <Badge tone={f.alert_level === "Red" ? "danger" : "warn"} className="ml-1.5">{f.alert_level}</Badge>}
                          {f.method !== "stage_a" && <span className="ml-1 text-xs text-muted" title="Equal weights: no verified history yet">*</span>}
                        </td>
                        <td className="num px-2 py-2.5 text-right text-muted">{f.p10.toFixed(0)}</td>
                        <td className="num px-2 py-2.5 text-right font-bold text-fg">{f.blend.toFixed(1)}</td>
                        <td className={cx("num px-2 py-2.5 text-right font-semibold", f.p90 >= 204.5 ? "font-bold text-fg underline decoration-line/80" : f.p90 >= 115.6 ? "text-fg" : "text-muted")}>{f.p90.toFixed(0)}</td>
                        <td className="num py-2.5 pl-2 pr-4 text-right text-muted">{f.equal_mean.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.some((r) => r.f.method !== "stage_a") && <p className="px-4 py-3 text-xs text-muted border-t border-line/60">* Equal weights: its models don't have enough verified days here yet.</p>}
            </Card>
          </div>
        )}
      </LiveState>
    </div>
  );
}

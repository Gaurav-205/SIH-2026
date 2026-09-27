import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { Badge, Card, PageHeader, Segmented, Stat } from "@/components/ui";
import LiveState from "@/components/LiveState";
import { cx } from "@/lib/cx";
import { useCycle, useScorecard, type ScoreRow } from "@/data/cycle";
import ValidationPanel from "./ValidationPanel";

const BLEND = "Bharosa (Stage A)";
const BLEND_ALT = "AtmosFusion (Stage A)";
const EQUAL = "Equal-weight mean";
const num = (v: number | null | undefined, d = 1) => (v == null || Number.isNaN(v) ? "—" : v.toFixed(d));
type Period = "test_monsoon_2025" | "all_verified";

function Check({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  return (
    <li className="flex items-start gap-3 py-3">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-ok" /> : <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">{title}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
      <Badge tone={ok ? "ok" : "danger"}>{ok ? "Pass" : "Fail"}</Badge>
    </li>
  );
}

export default function Verification() {
  const card = useScorecard();
  const cycle = useCycle();
  const s = card.data;
  const [period, setPeriod] = useState<Period>("test_monsoon_2025");
  const [lead, setLead] = useState(1);

  const rows = useMemo(() => (s?.rows ?? []).filter((r) => r.period === period), [s, period]);
  const methods = useMemo(() => {
    const by = new Map<string, ScoreRow>();
    rows.filter((r) => r.lead === lead).forEach((r) => by.set(r.method, r));
    return [...by.values()].sort((a, b) => a.rmse - b.rmse);
  }, [rows, lead]);
  const blend = methods.find((m) => m.method === BLEND || m.method === BLEND_ALT);
  const blendKey = blend?.method ?? BLEND;
  const singles = methods.filter((m) => m.family !== "blend");
  const best = singles[0];
  const equal = methods.find((m) => m.method === EQUAL);
  const chartMethods = [blendKey, EQUAL, ...singles.slice(0, 4).map((m) => m.method)];
  const chart = [1, 2, 3, 4, 5].map((l) => {
    const o: Record<string, number | string> = { lead: l };
    rows.filter((r) => r.lead === l && chartMethods.includes(r.method)).forEach((r) => (o[r.method] = r.rmse));
    return o;
  });
  const labelOf = (m: string) => rows.find((r) => r.method === m)?.label ?? m;

  const checks = useMemo(() => {
    const f = cycle.data?.forecasts ?? [];
    return [
      { ok: f.every((x) => Math.abs(Object.values(x.weights).reduce((a, b) => a + b, 0) - 1) < 1e-3), title: "Weights add up to one", detail: "Every district, lead day and variable in the live cycle" },
      { ok: f.every((x) => x.p10 <= x.blend + 1e-9 && x.blend <= x.p90 + 1e-9), title: "Percentiles are ordered", detail: "P10 ≤ blend ≤ P90" },
      { ok: f.filter((x) => x.prob).every((x) => x.prob!["64.5"] >= x.prob!["115.6"] && x.prob!["115.6"] >= x.prob!["204.5"]), title: "Exceedance chances are ordered", detail: "P(≥64.5) ≥ P(≥115.6) ≥ P(≥204.5)" },
      { ok: f.filter((x) => x.var !== "tmax").every((x) => x.blend >= 0 && x.p10 >= 0), title: "No negative rain or wind", detail: "Blend and lower bound are never below zero" },
    ];
  }, [cycle.data]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Verification"
        description="Is the blend actually better? Every live model, an equal-weight mean and Bharosa, scored on archived forecasts against IMD rain."
        actions={
          <>
            <Segmented label="Period" value={period} onChange={setPeriod} options={[{ value: "test_monsoon_2025", label: "Monsoon 2025 (test)" }, { value: "all_verified", label: "All verified" }]} />
            <Segmented label="Lead day" size="sm" value={lead} onChange={setLead} options={[1, 2, 3, 4, 5].map((l) => ({ value: l, label: `D${l}` }))} />
          </>
        }
      />
      <LiveState loading={card.isLoading} error={card.error} what="the scorecard">
        {s && (
          <>
            <div className="mb-6 flex gap-2 rounded-lg border border-line bg-subtle px-4 py-3 text-sm text-muted">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>
                Truth: {s.truth}. Period {s.periods[period]?.start} to {s.periods[period]?.end}, {s.points} districts. Bharosa uses only errors known before each
                forecast was issued, and its settings are the plan's defaults (nothing tuned on this data). Each method is scored on the days it has archived forecasts
                (n below); 95% intervals from a 5-day block bootstrap. Generated {s.generated_at.slice(0, 16).replace("T", " ")} UTC.
              </p>
            </div>

            {methods.length === 0 ? (
              <Card>
                <p className="py-8 text-center text-sm text-muted">
                  No verified forecasts for this period yet. The archive backfill is still downloading{period === "test_monsoon_2025" ? " 2025" : ""}; this page fills in as it
                  completes.
                </p>
              </Card>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Stat
                    label="Bharosa RMSE"
                    value={`${num(blend?.rmse)} mm`}
                    sub={blend ? `95% CI ${num(blend.rmse_lo)}–${num(blend.rmse_hi)} · n = ${blend.n}` : "Not enough data"}
                    tone="accent"
                  />
                  <Stat
                    label={`Best single model: ${best?.label ?? "—"}`}
                    value={`${num(best?.rmse)} mm`}
                    sub={best ? `95% CI ${num(best.rmse_lo)}–${num(best.rmse_hi)} · n = ${best.n}` : undefined}
                  />
                  <Stat
                    label="Heavy-rain skill (ETS ≥ 64.5 mm)"
                    value={num(blend?.ets_64_5, 2)}
                    sub={`Equal mean ${num(equal?.ets_64_5, 2)} · best single ${num(best?.ets_64_5, 2)}`}
                  />
                </div>

                <Card className="mt-6" title="Error by lead day" description="RMSE in mm/day, lower is better (blend, equal mean, and the four best single models)">
                  <div className="h-[340px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chart} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                        <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
                        <XAxis dataKey="lead" tickFormatter={(v) => `Day ${v}`} tick={{ fill: "rgb(var(--muted))", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "rgb(var(--muted))", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Legend formatter={(v) => <span className="text-xs text-muted">{labelOf(String(v))}</span>} />
                        <Tooltip formatter={(v, n) => [`${Number(v).toFixed(2)} mm/day`, labelOf(String(n))]} labelFormatter={(l) => `Day ${l}`}
                          contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--line))", borderRadius: 8, fontSize: 12 }} />
                        {chartMethods.map((m, i) => (
                          <Line key={m} type="monotone" dataKey={m} isAnimationActive={false} connectNulls
                            stroke={m === BLEND ? "rgb(var(--fg))" : m === EQUAL ? "rgb(var(--muted))" : ["#71717a", "#a1a1aa", "#52525b", "#3f3f46"][i % 4]}
                            strokeWidth={m === BLEND ? 3 : 1.5} strokeDasharray={m === EQUAL ? "4 4" : undefined} dot={{ r: m === BLEND ? 3.5 : 2 }} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="mt-6" title={`All methods, day ${lead}`} bodyClassName="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[44rem] text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs text-muted">
                          <th className="px-5 py-2.5 font-medium">Method</th>
                          <th className="px-2 py-2.5 text-right font-medium">n</th>
                          <th className="px-2 py-2.5 text-right font-medium">MAE</th>
                          <th className="px-2 py-2.5 text-right font-medium">RMSE (95% CI)</th>
                          <th className="px-2 py-2.5 text-right font-medium">Bias</th>
                          <th className="px-2 py-2.5 text-right font-medium">ETS</th>
                          <th className="px-2 py-2.5 text-right font-medium">POD</th>
                          <th className="py-2.5 pl-2 pr-5 text-right font-medium">FAR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {methods.map((m) => (
                          <tr key={m.method} className={cx(m.method === BLEND && "bg-subtle font-bold text-fg")}>
                            <td className="px-5 py-2">{m.label}</td>
                            <td className="num px-2 py-2 text-right">{m.n}</td>
                            <td className="num px-2 py-2 text-right">{num(m.mae, 2)}</td>
                            <td className="num px-2 py-2 text-right">{num(m.rmse, 2)} <span className="text-xs font-normal text-muted">({num(m.rmse_lo)}–{num(m.rmse_hi)})</span></td>
                            <td className="num px-2 py-2 text-right">{num(m.bias, 2)}</td>
                            <td className="num px-2 py-2 text-right">{num(m.ets_64_5, 2)}</td>
                            <td className="num px-2 py-2 text-right">{num(m.pod_64_5, 2)}</td>
                            <td className="num py-2 pl-2 pr-5 text-right">{num(m.far_64_5, 2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="px-5 py-3 text-xs text-muted">
                    ETS/POD/FAR at 64.5 mm (IMD heavy rain); {blend?.observed_heavy_days ?? 0} observed heavy-rain district-days in this sample. Overlapping intervals mean a
                    difference is not yet statistically clear.
                  </p>
                </Card>
              </>
            )}
          </>
        )}
      </LiveState>

      <ValidationPanel lead={lead} labelOf={(id) => cycle.data?.sources.find((x) => x.id === id)?.label ?? labelOf(id)} />

      {cycle.data && (
        <Card className="mt-6" title="Consistency checks" description="Recomputed in your browser on the live cycle" bodyClassName="py-1">
          <ul className="divide-y divide-line">{checks.map((c) => <Check key={c.title} {...c} />)}</ul>
        </Card>
      )}
    </div>
  );
}

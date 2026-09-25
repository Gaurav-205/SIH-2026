import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { Badge, Card, PageHeader, Spinner, Stat } from "@/components/ui";
import { cx } from "@/lib/cx";
import { getScorecard } from "@/data/demo";
import { SOURCE_COLOR, SOURCES } from "@/data/meta";
import { useBenchmark, useCycle, useStations, useView } from "@/data/state";
import { pct } from "@/components/scales";

const EXTRA: Record<string, { color: string; dash?: string; width: number }> = {
  "Equal mean": { color: "#98A2B3", dash: "4 4", width: 1.5 },
  "Static MME": { color: "#475467", dash: "6 3", width: 1.8 },
  AtmosFusion: { color: "rgb(var(--accent))", width: 3.5 },
};
const num = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });
const two = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const label = (m: string) => SOURCES.find((s) => s.id === m)?.name ?? m;

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
  const rows = useMemo(() => getScorecard(), []);
  const { lead } = useView();
  const cycle = useCycle();
  const stationData = useStations(lead).data;
  const stations = useMemo(() => stationData?.data.stations ?? [], [stationData]);
  const benchmark = useBenchmark().data;

  const methods = [...SOURCES.map((s) => s.id), "Equal mean", "Static MME", "AtmosFusion"];
  const chart = [1, 2, 3, 4, 5].map((l) => {
    const o: Record<string, number> = { lead: l };
    rows.filter((r) => r.lead === l).forEach((r) => (o[r.method] = r.rmse));
    return o;
  });
  const avg = (m: string, k: "rmse" | "ets") => rows.filter((r) => r.method === m).reduce((a, r) => a + r[k], 0) / 5;
  const bestSingle = Math.min(...SOURCES.map((s) => avg(s.id, "rmse")));
  const gain = 1 - avg("AtmosFusion", "rmse") / bestSingle;
  const gainMme = 1 - avg("AtmosFusion", "rmse") / avg("Static MME", "rmse");

  // Live physical-consistency checks on the current forecasts
  const checks = useMemo(() => {
    const n = cycle.blend.length;
    let weightsOk = true, quantOk = true, probOk = true, nonNeg = true;
    for (let c = 0; c < n; c++) {
      let w = 0;
      for (const s of SOURCES) w += cycle.weights[s.id][c];
      if (Math.abs(w - 1) > 1e-4) weightsOk = false;
      if (!(cycle.p10[c] <= cycle.blend[c] + 1e-6 && cycle.blend[c] <= cycle.p90[c] + 1e-6)) quantOk = false;
      if (!(cycle.prob[64.5][c] >= cycle.prob[115.6][c] - 1e-6 && cycle.prob[115.6][c] >= cycle.prob[204.5][c] - 1e-6)) probOk = false;
      if (cycle.blend[c] < 0) nonNeg = false;
    }
    const st = stations;
    return [
      { ok: weightsOk && st.every((s) => Math.abs(Object.values(s.assigned_weights).reduce((a, b) => a + b, 0) - 1) < 0.001), title: "Weights add up to one", detail: "Every grid cell and every station" },
      { ok: quantOk && st.every((s) => s.worst_case_90th >= s.consensus_blend), title: "Percentiles are ordered", detail: "P10 ≤ P50 ≤ P90 everywhere" },
      { ok: probOk && st.every((s) => s.p_heavy_rain >= s.p_very_heavy && s.p_very_heavy >= s.p_extremely_heavy), title: "Exceedance chances are ordered", detail: "P(≥64.5) ≥ P(≥115.6) ≥ P(≥204.5)" },
      { ok: nonNeg && st.every((s) => s.consensus_blend >= 0), title: "No negative rainfall", detail: "Blended rainfall is never below zero" },
      { ok: st.every((s) => s.consensus_humidity <= 100), title: "Humidity within bounds", detail: "Blended relative humidity ≤ 100% at stations" },
    ];
  }, [cycle, stations]);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Verification" description="Is the blend actually better? Error by lead day for every model, a static ensemble and AtmosFusion, plus live consistency checks." />

      <div className="mb-6 flex gap-2 rounded-lg border border-warn/25 bg-warn-soft px-4 py-3 text-sm text-warn">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>
          The scorecard below is computed over every demo cycle. The simulated skill record is partly informed by each day's own errors, so it shows how
          the page works, not how much better AtmosFusion is. Real results come from a frozen backtest on held-out 2022 data.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Lower error than best single model" value={pct.format(gain)} sub="RMSE, averaged over days 1–5" tone="accent" />
        <Stat label="Lower error than static ensemble" value={pct.format(gainMme)} sub="IMD-style fixed weights" tone="accent" />
        <Stat label="Heavy-rain skill (ETS)" value={two.format(avg("AtmosFusion", "ets"))} sub={`Static ensemble: ${two.format(avg("Static MME", "ets"))}`} />
      </div>

      <Card className="mt-6" title="Error by lead day" description="RMSE in mm/day, lower is better">
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
              <XAxis dataKey="lead" tickFormatter={(v) => `Day ${v}`} tick={{ fill: "rgb(var(--muted))", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgb(var(--muted))", fontSize: 12 }} tickFormatter={(v) => num.format(v)} axisLine={false} tickLine={false} />
              <Legend formatter={(v) => <span className="text-xs text-muted">{label(String(v))}</span>} />
              <Tooltip
                formatter={(v, n) => [`${num.format(Number(v))} mm/day`, label(String(n))]}
                labelFormatter={(l) => `Day ${l}`}
                contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--line))", borderRadius: 8, fontSize: 12 }}
              />
              {methods.map((m) => (
                <Line key={m} type="monotone" dataKey={m} dot={{ r: m === "AtmosFusion" ? 4 : 2 }} stroke={EXTRA[m]?.color ?? SOURCE_COLOR[m]} strokeWidth={EXTRA[m]?.width ?? 1.4} strokeDasharray={EXTRA[m]?.dash} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 font-medium">Method</th>
                {[1, 2, 3, 4, 5].map((l) => <th key={l} className="py-2 text-right font-medium">Day {l}</th>)}
                <th className="py-2 text-right font-medium">ETS ≥ 64.5</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {methods.map((m) => (
                <tr key={m} className={cx(m === "AtmosFusion" && "bg-accent-soft/60 font-semibold text-accent")}>
                  <td className="py-2 pl-1">{label(m)}</td>
                  {[1, 2, 3, 4, 5].map((l) => <td key={l} className="num py-2 text-right">{num.format(rows.find((r) => r.lead === l && r.method === m)!.rmse)}</td>)}
                  <td className="num py-2 pr-1 text-right">{two.format(avg(m, "ets"))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Consistency checks" description={`Recomputed live for ${cycle.region.name}, day ${lead}, and the Pune stations`} bodyClassName="py-1">
          <ul className="divide-y divide-line">{checks.map((c) => <Check key={c.title} {...c} />)}</ul>
        </Card>
        <Card title="Pune district benchmark" description="Reference figures bundled with the prototype, not computed here" bodyClassName="p-0">
          {!benchmark ? (
            <Spinner />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-5 py-2.5 font-medium">Model</th>
                    <th className="px-2 py-2.5 text-right font-medium">D1 RMSE</th>
                    <th className="px-2 py-2.5 text-right font-medium">D3 RMSE</th>
                    <th className="px-2 py-2.5 text-right font-medium">ETS</th>
                    <th className="py-2.5 pl-2 pr-5 text-right font-medium">CRPS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {benchmark.map((r) => (
                    <tr key={r.model_name} className={cx(r.model_name.includes("AtmosFusion") && "font-semibold text-accent")}>
                      <td className="px-5 py-2.5">{r.model_name}</td>
                      <td className="num px-2 py-2.5 text-right">{r.day1_rmse.toFixed(1)}</td>
                      <td className="num px-2 py-2.5 text-right">{r.day3_rmse.toFixed(1)}</td>
                      <td className="num px-2 py-2.5 text-right">{r.heavy_rain_ets.toFixed(2)}</td>
                      <td className="num py-2.5 pl-2 pr-5 text-right">{r.crps_score.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

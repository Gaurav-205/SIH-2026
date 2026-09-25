import { useCallback, useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, PageHeader, Segmented } from "@/components/ui";
import GridMap from "@/components/GridMap";
import Legend from "@/components/Legend";
import { useCycle } from "@/data/state";
import { byDistrict, districtName } from "@/data/aggregate";
import { FAMILY_LABEL, SOURCE_COLOR, SOURCES } from "@/data/meta";
import { fmt, pct, rainColor, rgb, spreadColor } from "@/components/scales";
import type { Cycle, Reason } from "@/data/types";

function explain(rs: Reason[], want: "up" | "down"): Reason[] {
  const main = rs.filter((r) => r.effect === want);
  if (main.length) return [...main, ...rs.filter((r) => r.effect !== want)].slice(0, 3);
  return [{ text: want === "up" ? "Smallest recent errors in this area" : "Larger recent errors here than the others", effect: want }, ...rs].slice(0, 3);
}

function TrustTab({ cycle }: { cycle: Cycle }) {
  const dominant = useMemo(() => {
    const out = new Int8Array(cycle.blend.length);
    const top = new Float32Array(cycle.blend.length);
    for (let c = 0; c < out.length; c++) {
      let best = 0;
      SOURCES.forEach((s, k) => {
        if (cycle.weights[s.id][c] > cycle.weights[SOURCES[best].id][c]) best = k;
      });
      out[c] = best;
      top[c] = cycle.weights[SOURCES[best].id][c];
    }
    return { out, top };
  }, [cycle]);

  const firstCellOfDistrict = useMemo(() => {
    const m = new Map<number, number>();
    for (let c = 0; c < cycle.district.length; c++) if (cycle.district[c] >= 0 && !m.has(cycle.district[c])) m.set(cycle.district[c], c);
    return m;
  }, [cycle]);

  const [cell, setCell] = useState<number | null>(null);
  const sel = cell !== null && cycle.district[cell] >= 0 ? cell : firstCellOfDistrict.values().next().value ?? 0;

  const color = useCallback(
    (c: number) => {
      const hex = SOURCE_COLOR[SOURCES[dominant.out[c]].id];
      const a = 0.45 + 0.55 * Math.min(1, (dominant.top[c] - 0.12) / 0.3);
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a.toFixed(2)})`;
    },
    [dominant]
  );

  const ranked = SOURCES.map((s) => ({ ...s, w: cycle.weights[s.id][sel], f: cycle.sources[s.id][sel] })).sort((a, b) => b.w - a.w);
  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
      <Card title="Trust Map" description="Each cell shows the model with the largest weight. Paler means trust was shared more evenly. Click a cell.">
        <div className="flex justify-center">
          <GridMap
            cycle={cycle}
            color={color}
            selected={sel}
            onSelect={setCell}
            label={`Trust Map of ${cycle.region.name}: the most trusted model per grid cell`}
            describe={(c) => `${districtName(cycle, c)}: ${SOURCES[dominant.out[c]].name}, ${pct.format(dominant.top[c])}`}
          />
        </div>
        <div className="mt-4">
          <Legend title="Most trusted model" items={SOURCES.map((s) => ({ color: SOURCE_COLOR[s.id], label: `${s.name} (${FAMILY_LABEL[s.family]})` }))} />
        </div>
      </Card>

      <div className="space-y-6">
        <Card title={`Weights in ${districtName(cycle, sel)}`} description="For the selected grid cell">
          <label className="mb-4 block text-xs font-medium text-muted">
            Jump to district
            <select
              value={cycle.district[sel]}
              onChange={(e) => setCell(firstCellOfDistrict.get(Number(e.target.value)) ?? null)}
              className="mt-1 block h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm text-fg focus:border-accent focus:outline-none"
            >
              {[...firstCellOfDistrict.keys()].map((k) => (
                <option key={k} value={k}>{cycle.region.districts[k].name}</option>
              ))}
            </select>
          </label>
          <ul className="space-y-3" aria-live="polite">
            {ranked.map((s) => (
              <li key={s.id} className="text-sm">
                <div className="flex justify-between">
                  <span className="text-fg">{s.name}</span>
                  <span className="num font-semibold text-fg">{pct.format(s.w)}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-subtle">
                  <div className="h-1.5 rounded-full" style={{ width: `${s.w * 100}%`, background: SOURCE_COLOR[s.id] }} />
                </div>
                <p className="num mt-1 text-xs text-muted">Forecast {fmt.format(s.f)} mm</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Why">
          {[
            { s: top, title: `${top.name} leads here`, want: "up" as const },
            { s: bottom, title: `${bottom.name} counts least`, want: "down" as const },
          ].map(({ s, title, want }) => (
            <div key={s.id} className="mb-4 last:mb-0">
              <h3 className="text-sm font-semibold text-fg">{title}</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {explain(cycle.reasons(sel, s.id), want).map((r) => (
                  <li key={r.text} className="flex gap-2 text-muted">
                    {r.effect === "up" ? <ArrowUp className="mt-0.5 h-4 w-4 flex-shrink-0 text-ok" aria-label="raises trust" /> : <ArrowDown className="mt-0.5 h-4 w-4 flex-shrink-0 text-warn" aria-label="lowers trust" />}
                    <span>{r.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function SourceMap({ cycle, id }: { cycle: Cycle; id: string }) {
  const field = id === "obs" ? cycle.obs : cycle.sources[id];
  const color = useCallback((c: number) => rgb(rainColor(field[c])), [field]);
  const source = SOURCES.find((s) => s.id === id);
  const name = source?.name ?? "What fell (demo)";
  return (
    <figure className="rounded-xl border border-line p-3">
      <GridMap compact cycle={cycle} color={color} label={`${name} rainfall`} describe={(c) => `${districtName(cycle, c)}: ${fmt.format(field[c])} mm`} />
      <figcaption className="mt-2 flex items-center gap-2 text-sm">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: source ? SOURCE_COLOR[id] : "rgb(var(--fg))" }} />
        <span className="font-medium text-fg">{name}</span>
        {source && <span className="text-xs text-muted">{FAMILY_LABEL[source.family]}</span>}
      </figcaption>
    </figure>
  );
}

function DisagreementTab({ cycle }: { cycle: Cycle }) {
  const color = useCallback((c: number) => rgb(spreadColor(cycle.spread[c])), [cycle]);
  const top = byDistrict(cycle, cycle.spread).slice(0, 5);
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card title="Spread between the six models" description="Darker violet means the models disagree more (standard deviation, mm/day). Check the Trust Map there before relying on the blend.">
          <div className="flex justify-center">
            <GridMap cycle={cycle} color={color} label="Disagreement between models" describe={(c) => `${districtName(cycle, c)}: models differ by ±${fmt.format(cycle.spread[c])} mm`} />
          </div>
          <div className="mt-4 flex items-center gap-3 text-xs text-muted" aria-hidden="true">
            <span>Agree</span>
            <span className="h-2.5 w-40 rounded-full" style={{ background: "linear-gradient(90deg,#F4F3F8,#D7CCEE,#A083E0,#5B3FA0,#2F1F63)" }} />
            <span>Disagree</span>
          </div>
        </Card>
        <Card title="Biggest disagreement" bodyClassName="p-0">
          <ul className="divide-y divide-line text-sm">
            {top.map((d) => (
              <li key={d.name} className="flex justify-between px-5 py-3">
                <span className="text-fg">{d.name}</span>
                <span className="num text-muted">±{fmt.format(d.max)} mm</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card title="Each model on its own" description="Same colour scale as the Forecast page">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SOURCES.map((s) => (
            <SourceMap key={s.id} cycle={cycle} id={s.id} />
          ))}
          <SourceMap cycle={cycle} id="obs" />
        </div>
      </Card>
    </div>
  );
}

export default function Models() {
  const cycle = useCycle();
  const [tab, setTab] = useState<"trust" | "spread">("trust");
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Models"
        description={`How the six physics, ensemble and AI models were weighted over ${cycle.region.name}, and where they disagree.`}
        actions={<Segmented label="Models view" value={tab} onChange={setTab} options={[{ value: "trust", label: "Trust Map" }, { value: "spread", label: "Disagreement" }]} />}
      />
      {tab === "trust" ? <TrustTab cycle={cycle} /> : <DisagreementTab cycle={cycle} />}
    </div>
  );
}

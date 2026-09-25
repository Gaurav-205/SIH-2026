import { useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Info } from "lucide-react";
import { Badge, Button, Card, PageHeader, Segmented, Spinner } from "@/components/ui";
import StationMap from "@/components/StationMap";
import { cx } from "@/lib/cx";
import { useQuantileCurve, useStations, useView } from "@/data/state";
import { getImdRainColor, MODEL_OKABE_ITO } from "@/lib/blendEngine";
import { exportCsv, exportGeoJson } from "@/lib/exportUtils";
import { MODEL_FAMILIES, MODEL_LABELS, type WeatherStation } from "@/types/weather";

type Layer = "blend" | "p90" | "spread" | "trust";

const LAYERS: { value: Layer; label: string }[] = [
  { value: "blend", label: "Rainfall" },
  { value: "p90", label: "Worst case" },
  { value: "spread", label: "Spread" },
  { value: "trust", label: "Top model" },
];

function colorOf(layer: Layer) {
  return (s: WeatherStation) => {
    if (layer === "blend") return getImdRainColor(s.consensus_blend);
    if (layer === "p90") return s.worst_case_90th >= 115.6 ? "#D92D20" : s.worst_case_90th >= 64.5 ? "#DC6803" : "#039855";
    if (layer === "spread") return s.disagreement_index >= 100 ? "#D92D20" : s.disagreement_index >= 50 ? "#DC6803" : s.disagreement_index >= 25 ? "#CA8A04" : "#039855";
    const top = Object.entries(s.assigned_weights).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    return MODEL_OKABE_ITO[top];
  };
}

function valueOf(layer: Layer) {
  return (s: WeatherStation) => {
    if (layer === "blend") return `${s.consensus_blend} mm`;
    if (layer === "p90") return `${s.worst_case_90th} mm`;
    if (layer === "spread") return `±${s.disagreement_index} mm`;
    const [k, w] = Object.entries(s.assigned_weights).reduce((a, b) => (b[1] > a[1] ? b : a));
    return `${k.toUpperCase()} ${Math.round(w * 100)}%`;
  };
}

const LEGENDS: Record<Layer, { color: string; label: string }[]> = {
  blend: [
    { color: "#ef4444", label: "≥ 204.5 mm" },
    { color: "#f97316", label: "115.6–204.4" },
    { color: "#eab308", label: "64.5–115.5" },
    { color: "#3b82f6", label: "35.5–64.4" },
    { color: "#10b981", label: "< 35.5" },
  ],
  p90: [
    { color: "#D92D20", label: "P90 ≥ 115.6 mm" },
    { color: "#DC6803", label: "64.5–115.5" },
    { color: "#039855", label: "< 64.5" },
  ],
  spread: [
    { color: "#D92D20", label: "≥ 100 mm" },
    { color: "#DC6803", label: "50–99" },
    { color: "#CA8A04", label: "25–49" },
    { color: "#039855", label: "< 25 (models agree)" },
  ],
  trust: Object.entries(MODEL_LABELS).map(([k, l]) => ({ color: MODEL_OKABE_ITO[k], label: l })),
};

function Plume({ stationId, lead }: { stationId: string; lead: number }) {
  const { data } = useQuantileCurve(stationId);
  if (!data?.length) return <Spinner label="Loading plume" />;
  const rows = data.map((p) => ({ day: `D${p.lead_day}`, p10: p.p10, band: Math.round((p.p90 - p.p10) * 10) / 10, p50: p.p50, p90: p.p90, avg: p.simple_avg }));
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: "rgb(var(--muted))", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={{ fill: "rgb(var(--muted))", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            content={({ active, payload, label }) => {
              const p = payload?.[0]?.payload as (typeof rows)[number] | undefined;
              if (!active || !p) return null;
              return (
                <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
                  <p className="font-semibold text-fg">{label}</p>
                  <p className="num text-muted">P90 {p.p90} · P50 <b className="text-fg">{p.p50}</b> · P10 {p.p10} mm</p>
                  <p className="num text-muted">Flat average {p.avg} mm</p>
                </div>
              );
            }}
          />
          <ReferenceLine x={`D${lead}`} stroke="rgb(var(--accent))" strokeDasharray="3 3" />
          <Area dataKey="p10" stackId="b" stroke="none" fill="transparent" isAnimationActive={false} />
          <Area dataKey="band" stackId="b" stroke="none" fill="rgb(var(--accent))" fillOpacity={0.14} isAnimationActive={false} />
          <Line dataKey="avg" stroke="rgb(var(--muted))" strokeDasharray="4 4" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          <Line dataKey="p50" stroke="rgb(var(--accent))" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function Detail({ s, lead }: { s: WeatherStation; lead: number }) {
  const weights = Object.entries(s.assigned_weights).sort(([, a], [, b]) => b - a);
  const blendErr = Math.round(Math.abs(s.consensus_blend - s.observed_rain_24h) * 10) / 10;
  const avgErr = Math.round(Math.abs(s.simple_average - s.observed_rain_24h) * 10) / 10;
  const probs = [
    { label: "Heavy", mm: 64.5, p: s.p_heavy_rain, color: "#eab308" },
    { label: "Very heavy", mm: 115.6, p: s.p_very_heavy, color: "#f97316" },
    { label: "Extremely heavy", mm: 204.5, p: s.p_extremely_heavy, color: "#ef4444" },
  ];
  return (
    <div className="space-y-6">
      <Card
        title={
          <span className="flex items-center gap-2">
            {s.name} {s.alert_level && <Badge tone={s.alert_level === "Red" ? "danger" : "warn"}>{s.alert_level} alert</Badge>}
          </span>
        }
        description={`${s.terrain_type} · ${s.elevation_m} m`}
      >
        <dl className="grid grid-cols-3 gap-3">
          {[
            { k: "AtmosFusion blend", v: s.consensus_blend, cls: "text-accent" },
            { k: "Flat average", v: s.simple_average, cls: "text-muted" },
            { k: "Observed", v: lead === 1 ? s.observed_rain_24h : null, cls: "text-fg" },
          ].map((x) => (
            <div key={x.k} className="rounded-lg bg-subtle p-3">
              <dt className="text-xs text-muted">{x.k}</dt>
              <dd className={cx("num mt-1 text-lg font-semibold", x.cls)}>{x.v === null ? "—" : `${x.v} mm`}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-muted">
          {lead === 1 ? (
            <>
              Against what fell, the blend misses by <b className="num text-fg">{blendErr} mm</b> and the flat average by <b className="num text-fg">{avgErr} mm</b>.
            </>
          ) : (
            "Observations are available for day 1 only."
          )}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <p className="text-muted">Worst case (P90): <b className="num text-fg">{s.worst_case_90th} mm</b></p>
          <p className="text-muted">Model spread: <b className="num text-fg">{s.disagreement_index} mm</b></p>
        </div>
      </Card>

      <Card title="Model weights" description="w ∝ (48-hour MAE + 0.1)⁻² — lower recent error earns more trust">
        <ul className="space-y-3">
          {weights.map(([k, w]) => {
            const mae = s.recent_mae_48h[k];
            return (
              <li key={k}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: MODEL_OKABE_ITO[k] }} />
                    <span className="truncate text-fg">{MODEL_LABELS[k]}</span>
                    <span className="hidden text-xs text-muted sm:inline">{MODEL_FAMILIES[k]}</span>
                  </span>
                  <span className="num font-semibold text-fg">{(w * 100).toFixed(1)}%</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-subtle">
                  <div className="h-1.5 rounded-full" style={{ width: `${w * 100}%`, background: MODEL_OKABE_ITO[k] }} />
                </div>
                <p className="num mt-1 text-xs text-muted">Forecast {s.model_predictions[k]} mm · recent error {mae} mm</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 flex gap-2 rounded-lg bg-subtle p-3 text-xs text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          {s.shap_explanation}
        </p>
      </Card>

      <Card title="Chance of exceeding IMD thresholds">
        <ul className="space-y-3">
          {probs.map((p) => (
            <li key={p.mm}>
              <div className="flex justify-between text-sm">
                <span className="text-fg">
                  {p.label} <span className="text-xs text-muted">≥ {p.mm} mm</span>
                </span>
                <span className="num font-semibold text-fg">{Math.round(p.p * 100)}%</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-subtle">
                <div className="h-1.5 rounded-full" style={{ width: `${p.p * 100}%`, background: p.color }} />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="10-day outlook" description="Blended median with the 10th–90th percentile band; dashed line is the flat average">
        <Plume stationId={s.id} lead={lead} />
      </Card>
    </div>
  );
}

export default function Stations() {
  const { lead } = useView();
  const { data, isLoading } = useStations(lead);
  const [layer, setLayer] = useState<Layer>("blend");
  const [selected, setSelected] = useState<string | null>(null);

  if (isLoading || !data) return <Spinner label="Loading stations" />;
  const stations = data.data.stations;
  const peak = stations.reduce((a, b) => (b.consensus_blend > a.consensus_blend ? b : a));
  const current = stations.find((s) => s.id === selected) ?? peak;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Pune station network"
        description="Five automatic weather stations. Each model is weighted by its recent error at that station; the blend keeps orographic peaks a flat average would wash out."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => exportCsv(data.data)}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => exportGeoJson(data.data)}>
              <Download className="h-3.5 w-3.5" /> GeoJSON
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented label="Map layer" value={layer} onChange={setLayer} options={LAYERS} />
            <div role="radiogroup" aria-label="Station" className="flex flex-wrap gap-1.5">
              {stations.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={s.id === current.id}
                  onClick={() => setSelected(s.id)}
                  className={cx(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    s.id === current.id ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface text-muted hover:text-fg"
                  )}
                >
                  {s.name.split(" / ")[0].replace(/ (IMD Observatory|Airport AWS|Catchment)$/, "")}
                </button>
              ))}
            </div>
          </div>
          <StationMap stations={stations} selectedId={current.id} onSelect={setSelected} colorOf={colorOf(layer)} valueOf={valueOf(layer)} className="h-[480px]" />
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Map legend">
            {LEGENDS[layer].map((l) => (
              <li key={l.label} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} aria-hidden="true" />
                {l.label}
              </li>
            ))}
          </ul>
        </div>
        <Detail s={current} lead={lead} />
      </div>
    </div>
  );
}

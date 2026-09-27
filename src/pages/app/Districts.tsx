import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDown, ArrowUp, ChevronDown, Download, MapPin } from "lucide-react";
import { Badge, Button, Card, PageHeader, Segmented } from "@/components/ui";
import DistrictMap from "@/components/DistrictMap";
import LiveState from "@/components/LiveState";
import { cx } from "@/lib/cx";
import { fmtDay, useCycle, useCycleIndex, useTelemetry, type Cycle, type ForecastRec, type Var } from "@/data/cycle";
import { REGIONS } from "@/data/regions";
import { LEADS, useView } from "@/data/state";
import { exportDistrictsCsv, exportDistrictsGeoJson } from "@/lib/exportUtils";
import { FAMILY_LABEL, imdCategory, sourceColor } from "@/lib/imd";

const UNITS: Record<Var, string> = { rain: "mm", tmax: "°C", wind: "m/s" };
const VAR_LABEL: Record<Var, string> = { rain: "Rainfall", tmax: "Max temperature", wind: "Wind (daily mean)" };

function ModelTable({ f, cycle, idx }: { f: ForecastRec; cycle: Cycle; idx: ReturnType<typeof useCycleIndex> }) {
  const unit = UNITS[f.var];
  const ids = Object.keys(f.values).sort((a, b) => (f.weights[b] ?? -1) - (f.weights[a] ?? -1));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-xs">
        <thead>
          <tr className="border-b border-line bg-subtle/40 text-left text-muted">
            <th className="py-2.5 pl-3 pr-2 font-semibold">Model</th>
            <th className="py-2.5 px-2 text-right font-semibold">Forecast</th>
            <th className="py-2.5 px-2 text-right font-semibold">Corrected</th>
            <th className="py-2.5 px-2 text-right font-semibold">Recent error</th>
            <th className="py-2.5 px-2 text-right font-semibold">Bias</th>
            <th className="py-2.5 pl-3 pr-3 font-semibold">Weight</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {ids.map((id) => {
            const src = idx.source(id);
            const sk = f.skill[id];
            const w = f.weights[id];
            return (
              <tr key={id} className="hover:bg-subtle/40 transition-colors">
                <td className="py-2.5 pl-3 pr-2">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full border border-line" style={{ background: sourceColor(idx.sourceIndex(id)) }} />
                    <span className="font-medium text-fg">{src?.label ?? id}</span>
                    <span className="hidden text-[11px] text-muted 2xl:inline">{FAMILY_LABEL[src?.family ?? "physics"]}</span>
                  </span>
                </td>
                <td className="num py-2.5 px-2 text-right font-semibold text-fg">{f.values[id].toFixed(1)}</td>
                <td className="num py-2.5 px-2 text-right text-muted">{f.corrected[id] !== undefined ? f.corrected[id].toFixed(1) : "—"}</td>
                <td className="num py-2.5 px-2 text-right text-muted" title={sk ? `${sk.n} verified days (${sk.scope === "region" ? "pooled over region" : "this district"})` : undefined}>
                  {sk ? `${sk.mae.toFixed(1)} ${unit}` : "—"}
                  {sk?.scope === "region" && <span className="ml-1 text-[10px] rounded bg-subtle px-1 py-0.5">R</span>}
                </td>
                <td className="num py-2.5 px-2 text-right text-muted">{sk ? `${sk.bias >= 0 ? "+" : ""}${sk.bias.toFixed(1)}` : "—"}</td>
                <td className="py-2.5 pl-3 pr-3">
                  {w !== undefined ? (
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-20 rounded-full bg-subtle overflow-hidden">
                        <span className="block h-1.5 rounded-full transition-all" style={{ width: `${w * 100}%`, background: sourceColor(idx.sourceIndex(id)) }} />
                      </span>
                      <span className="num w-10 text-right text-xs font-semibold text-fg">{(w * 100).toFixed(0)}%</span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted">not weighted</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2.5 text-xs text-muted">
        {f.method === "stage_a"
          ? `Recent error = decaying-average absolute error against ${f.var === "wind" ? cycle.truth.wind : f.var === "tmax" ? cycle.truth.tmax : cycle.truth.rain}. R = pooled over the region.`
          : "No model has enough verified days here yet, so this is an equal-weight mean."}
      </p>
    </div>
  );
}

function Outlook({ pointId, idx, cycle, lead }: { pointId: string; idx: ReturnType<typeof useCycleIndex>; cycle: Cycle; lead: number }) {
  const rows = LEADS.map((l) => idx.get(pointId, l, "rain"))
    .filter((f): f is ForecastRec => !!f)
    .map((f) => ({ day: `D${f.lead}`, date: f.date, p10: f.p10, band: f.p90 - f.p10, p50: f.blend, p90: f.p90, avg: f.equal_mean }));
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: "rgb(var(--muted))", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "rgb(var(--muted))", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as (typeof rows)[number] | undefined;
              if (!active || !p) return null;
              return (
                <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
                  <p className="font-semibold text-fg">{fmtDay.format(new Date(p.date))}</p>
                  <p className="num text-muted">P90 {p.p90.toFixed(1)} · blend <b className="text-fg">{p.p50.toFixed(1)}</b> · P10 {p.p10.toFixed(1)} mm</p>
                  <p className="num text-muted">Equal mean {p.avg.toFixed(1)} mm</p>
                </div>
              );
            }}
          />
          <ReferenceLine x={`D${lead}`} stroke="rgb(var(--fg))" strokeDasharray="3 3" />
          <Area dataKey="p10" stackId="b" stroke="none" fill="transparent" isAnimationActive={false} />
          <Area dataKey="band" stackId="b" stroke="none" fill="rgb(var(--fg))" fillOpacity={0.08} isAnimationActive={false} />
          <Line dataKey="avg" stroke="rgb(var(--muted))" strokeDasharray="4 4" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          <Line dataKey="p50" stroke="rgb(var(--fg))" strokeWidth={2} dot={{ r: 2, fill: "rgb(var(--fg))" }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="-mt-1 text-xs text-muted">Model run {cycle.issue.init_utc.slice(0, 16).replace("T", " ")} UTC · band = 10th–90th percentile · dashed = equal-weight mean</p>
    </div>
  );
}

function StationTelemetryCard({ pointId }: { pointId: string }) {
  const { data: tel, isLoading } = useTelemetry(pointId);
  if (isLoading) {
    return (
      <Card title="Live Microclimate & Environmental Telemetry" description="Querying live telemetry sensors…">
        <p className="text-xs text-muted">Loading live station sensors…</p>
      </Card>
    );
  }
  if (!tel) return null;

  return (
    <Card
      title="Live Microclimate & Environmental Telemetry"
      description={`Real-time atmospheric composition, catchment moisture & IMD radar nowcasts for ${tel.name}`}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Air Quality */}
        {tel.air_quality && (
          <div className="rounded-lg border border-line bg-subtle/50 p-3">
            <span className="text-xs font-semibold text-fg uppercase tracking-wider">Air Quality (SAFAR)</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-fg">AQI {tel.air_quality.european_aqi ?? "—"}</span>
              <Badge tone={(tel.air_quality.european_aqi ?? 0) > 75 ? "danger" : (tel.air_quality.european_aqi ?? 0) > 50 ? "warn" : "ok"}>
                {(tel.air_quality.european_aqi ?? 0) <= 50 ? "Good" : (tel.air_quality.european_aqi ?? 0) <= 75 ? "Moderate" : "Poor"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted">
              PM2.5: {tel.air_quality.pm2_5?.toFixed(1) ?? "—"} µg/m³ · PM10: {tel.air_quality.pm10?.toFixed(1) ?? "—"} µg/m³
            </p>
            <p className="text-[11px] text-muted">UV Index: {tel.air_quality.uv_index?.toFixed(1) ?? "—"}</p>
          </div>
        )}

        {/* Catchment & Surface */}
        {tel.surface && (
          <div className="rounded-lg border border-line bg-subtle/50 p-3">
            <span className="text-xs font-semibold text-fg uppercase tracking-wider">Catchment & Soil Moisture</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-fg">{tel.surface.relative_humidity_2m ?? "—"}%</span>
              <span className="text-xs font-medium text-muted">Humidity</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Topsoil Saturation: {tel.surface.soil_moisture_0_to_1cm ? `${(tel.surface.soil_moisture_0_to_1cm * 100).toFixed(1)}%` : "—"}
            </p>
            <p className="text-[11px] text-muted">Pressure: {tel.surface.surface_pressure?.toFixed(1) ?? "—"} hPa</p>
          </div>
        )}

        {/* Marine Swells for Coastal */}
        {tel.is_coastal && tel.marine && (
          <div className="rounded-lg border border-line bg-subtle/50 p-3">
            <span className="text-xs font-semibold text-fg uppercase tracking-wider">Arabian Sea Swell</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-fg">{tel.marine.wave_height?.toFixed(2) ?? "—"} m</span>
              <span className="text-xs font-medium text-muted">Wave Height</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Period: {tel.marine.wave_period?.toFixed(1) ?? "—"} s · Direction: {tel.marine.wave_direction ?? "—"}°
            </p>
            <p className="text-[11px] text-muted">Coastal surge alert threshold: 2.5 m</p>
          </div>
        )}
      </div>

      {/* Radar Nowcast Links */}
      <div className="mt-4 border-t border-line pt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted">IMD Radar Nowcasts:</span>
        <a
          href={tel.radar.pune_dwr}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1 text-xs text-fg hover:border-fg transition"
        >
          📡 IMD Pune Doppler Radar (Pashan)
        </a>
        <a
          href={tel.radar.mumbai_dwr}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1 text-xs text-fg hover:border-fg transition"
        >
          📡 IMD Mumbai Doppler Radar (Colaba)
        </a>
        <a
          href={tel.radar.satellite_ir}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1 text-xs text-fg hover:border-fg transition"
        >
          🛰️ INSAT Satellite IR Nowcast
        </a>
      </div>
    </Card>
  );
}

export default function Districts() {
  const { region, lead } = useView();
  const [params, setParams] = useSearchParams();
  const cycle = useCycle();
  const c = cycle.data;
  const idx = useCycleIndex(c);
  const v = (["rain", "tmax", "wind"].includes(params.get("var") ?? "") ? params.get("var") : "rain") as Var;
  const setParam = (k: string, val: string) => {
    const next = new URLSearchParams(params);
    next.set(k, val);
    setParams(next, { replace: true });
  };

  const points = useMemo(() => c?.points.filter((p) => p.region === region) ?? [], [c, region]);
  const selectedId = points.some((p) => p.id === params.get("district"))
    ? params.get("district")!
    : (points.find((p) => p.id === "pune-ghats")?.id ??
       points.find((p) => p.id.includes("pune"))?.id ??
       [...points].sort((a, b) => (idx.get(b.id, lead, "rain")?.blend ?? 0) - (idx.get(a.id, lead, "rain")?.blend ?? 0))[0]?.id);
  const selected = points.find((p) => p.id === selectedId);
  const f = selected ? idx.get(selected.id, lead, v) : undefined;
  const rain = selected ? idx.get(selected.id, lead, "rain") : undefined;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Districts & Stations"
        description="Every model's live forecast for each district, recent verification against IMD, and the adaptive weights assigned."
        actions={
          c && (
            <>
              <Button variant="secondary" size="sm" onClick={() => exportDistrictsCsv(c, lead)}>
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
              <Button variant="secondary" size="sm" onClick={() => exportDistrictsGeoJson(c, lead)}>
                <Download className="h-3.5 w-3.5" /> GeoJSON
              </Button>
            </>
          )
        }
      />
      <LiveState loading={cycle.isLoading} error={cycle.error}>
        {c && selected && (
          <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
            <div className="space-y-4">
              <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative flex-1">
                    <MapPin className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
                    <select
                      aria-label={`Select district in ${REGIONS[region].name}`}
                      value={selected.id}
                      onChange={(e) => setParam("district", e.target.value)}
                      className="block h-9 w-full appearance-none rounded-lg border border-line bg-canvas pl-9 pr-8 text-xs font-semibold text-fg shadow-xs transition-colors hover:border-muted focus:border-fg focus:outline-none"
                    >
                      {points.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted" />
                  </div>
                </div>

                {region === "konkan" && (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-line/60 pt-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted pr-1">Target Focus:</span>
                    <button
                      type="button"
                      onClick={() => setParam("district", "pune-ghats")}
                      className={cx(
                        "rounded-md px-2.5 py-1 text-xs font-medium transition shadow-xs",
                        selected.id === "pune-ghats"
                          ? "bg-fg text-surface"
                          : "border border-line bg-canvas text-muted hover:text-fg hover:border-fg/40"
                      )}
                    >
                      Pune Ghats
                    </button>
                    <button
                      type="button"
                      onClick={() => setParam("district", "pune-plains")}
                      className={cx(
                        "rounded-md px-2.5 py-1 text-xs font-medium transition shadow-xs",
                        selected.id === "pune-plains"
                          ? "bg-fg text-surface"
                          : "border border-line bg-canvas text-muted hover:text-fg hover:border-fg/40"
                      )}
                    >
                      Pune Plains
                    </button>
                    <button
                      type="button"
                      onClick={() => setParam("district", "mumbai")}
                      className={cx(
                        "rounded-md px-2.5 py-1 text-xs font-medium transition shadow-xs",
                        selected.id === "mumbai"
                          ? "bg-fg text-surface"
                          : "border border-line bg-canvas text-muted hover:text-fg hover:border-fg/40"
                      )}
                    >
                      Mumbai MMR
                    </button>
                  </div>
                )}
              </div>

              <DistrictMap
                points={points.map((p) => ({ ...p, alert: idx.get(p.id, lead, "rain")?.alert_level }))}
                selectedId={selected.id}
                onSelect={(id) => setParam("district", id)}
                colorOf={(p) => imdCategory(idx.get(p.id, lead, "rain")?.blend ?? 0).color}
                valueOf={(p) => `${(idx.get(p.id, lead, "rain")?.blend ?? 0).toFixed(0)} mm`}
                className="h-[440px]"
              />

              {rain && (
                <Card title="5-day rain outlook" description={`Confidence band for ${selected.name}`}>
                  <Outlook pointId={selected.id} idx={idx} cycle={c} lead={lead} />
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {selected.name} · day {lead}
                    {rain?.alert_level && <Badge tone={rain.alert_level === "Red" ? "danger" : "warn"}>{rain.alert_level} alert</Badge>}
                    {f?.method !== "stage_a" && <Badge>equal weights</Badge>}
                  </span>
                }
                description={`${selected.lat.toFixed(2)}°N ${selected.lon.toFixed(2)}°E${selected.elevation_m != null ? ` · ${Math.round(selected.elevation_m)} m` : ""} · valid ${fmtDay.format(new Date(c.issue.lead_dates[String(lead)]))}`}
                action={
                  <Segmented size="sm" label="Variable" value={v} onChange={(x) => setParam("var", x)} options={[
                    { value: "rain", label: "Rain" }, { value: "tmax", label: "Tmax" }, { value: "wind", label: "Wind" },
                  ]} />
                }
              >
                {f ? (
                  <>
                    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-line bg-subtle/50 p-3.5 shadow-xs">
                        <dt className="text-xs font-semibold uppercase tracking-wider text-fg">Bharosa Blend</dt>
                        <dd className="num mt-1.5 flex items-baseline gap-1 text-2xl font-bold text-fg">
                          {f.blend.toFixed(1)} <span className="text-xs font-normal text-muted">{UNITS[v]}</span>
                        </dd>
                        <dd className="mt-1 text-[11px] text-muted">Adaptive skill-weighted</dd>
                      </div>

                      <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
                        <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Equal-Weight Mean</dt>
                        <dd className="num mt-1.5 flex items-baseline gap-1 text-2xl font-bold text-fg">
                          {f.equal_mean.toFixed(1)} <span className="text-xs font-normal text-muted">{UNITS[v]}</span>
                        </dd>
                        <dd className="mt-1 text-[11px] text-muted">
                          Delta: <b className="text-fg">{f.blend - f.equal_mean >= 0 ? "+" : ""}{(f.blend - f.equal_mean).toFixed(1)}</b> {UNITS[v]}
                        </dd>
                      </div>

                      <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
                        <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Uncertainty (P10–P90)</dt>
                        <dd className="num mt-1.5 flex items-baseline gap-1 text-2xl font-bold text-fg">
                          {f.p10.toFixed(0)}–{f.p90.toFixed(0)} <span className="text-xs font-normal text-muted">{UNITS[v]}</span>
                        </dd>
                        <dd className="mt-1 text-[11px] text-muted">80% predictive interval</dd>
                      </div>
                    </dl>
                    <h3 className="mb-2 mt-5 text-sm font-semibold text-fg">{VAR_LABEL[v]} by model</h3>
                    <ModelTable f={f} cycle={c} idx={idx} />
                  </>
                ) : (
                  <p className="text-sm text-muted">No live {VAR_LABEL[v].toLowerCase()} forecast for this district and lead day.</p>
                )}
              </Card>

              {v === "rain" && rain?.prob && (
                <Card title="Chance of exceeding IMD thresholds" description="From the blended distribution (provisional until calibration, plan M6)">
                  <ul className="space-y-3">
                    {[["64.5", "Heavy"], ["115.6", "Very heavy"], ["204.5", "Extremely heavy"]].map(([mm, label]) => (
                      <li key={mm}>
                        <div className="flex justify-between text-sm">
                          <span className="text-fg">
                            {label} <span className="text-xs text-muted">≥ {mm} mm</span>
                          </span>
                          <span className="num font-semibold text-fg">{Math.round((rain.prob![mm] ?? 0) * 100)}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-subtle">
                          <div className="h-1.5 rounded-full" style={{ width: `${(rain.prob![mm] ?? 0) * 100}%`, background: imdCategory(Number(mm)).color }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {v === "rain" && rain?.reasons && (
                <Card title="Why the weights look like this" description="Each reason comes from that model's verified record here">
                  <ul className="space-y-3">
                    {Object.entries(rain.reasons)
                      .filter(([, rs]) => rs.length)
                      .sort(([a], [b]) => (rain.weights[b] ?? -1) - (rain.weights[a] ?? -1))
                      .map(([id, rs]) => (
                        <li key={id}>
                          <p className="text-sm font-medium text-fg">{idx.source(id)?.label ?? id}</p>
                          <ul className="mt-1 space-y-1">
                            {rs.map((r) => (
                              <li key={r.text} className="flex gap-2 text-sm text-muted">
                                {r.effect === "up" ? <ArrowUp className="mt-0.5 h-4 w-4 flex-shrink-0 text-ok" aria-label="raises trust" /> : <ArrowDown className="mt-0.5 h-4 w-4 flex-shrink-0 text-warn" aria-label="lowers trust" />}
                                {r.text}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                  </ul>
                </Card>
              )}

              <StationTelemetryCard pointId={selected.id} />
            </div>
          </div>
        )}
      </LiveState>
    </div>
  );
}

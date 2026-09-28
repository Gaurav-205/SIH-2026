import { lazy, Suspense, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDownRight, ArrowRight, Bell, CloudRain, Layers3, MapPin, ShieldCheck } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import LiveState from "@/components/LiveState";
import { fmtDay, useCycle, useCycleIndex, type ForecastRec } from "@/data/cycle";
import { useView } from "@/data/state";
import { REGIONS } from "@/data/regions";
import { imdCategory } from "@/lib/imd";
import { districtLink, selectDistrict } from "@/features/forecast/domain";
import Freshness from "@/features/forecast/Freshness";
const SpatialOutlook = lazy(() => import("@/visualizations/SpatialOutlook"));
export default function Overview() {
  const cycle = useCycle();
  const c = cycle.data;
  const idx = useCycleIndex(c);
  const { region, lead, set, query } = useView();
  const [params, setParams] = useSearchParams();
  const [spatial, setSpatial] = useState(false);
  const points = c?.points.filter((p) => p.region === region) ?? [];
  const point = selectDistrict(c, region, params.get("district"));
  const forecast = point ? idx.get(point.id, lead, "rain") : undefined;
  const outlook = point ? [1, 2, 3, 4, 5].map((d) => idx.get(point.id, d, "rain")).filter((f): f is ForecastRec => !!f) : [];
  const alerts = points.filter((p) => idx.get(p.id, lead, "rain")?.alert_level);
  const choose = (id: string) => { const next = new URLSearchParams(params); next.set("district", id); setParams(next, { replace: true }); };
  return <div className="briefing-page animate-fade-in">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><p className="eyebrow">YOUR RAINFALL BRIEFING</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Understand the rain ahead.</h1><p className="mt-2 text-sm text-muted">A clearer outlook for {REGIONS[region].name}. One place, five days, the evidence behind it.</p></div>
      <Freshness cycle={c} />
    </div>
    <LiveState loading={cycle.isLoading} error={cycle.error} hasData={!!c} onRetry={() => cycle.refetch()}>
      {c && <>
        <section className="forecast-hero" aria-labelledby="place-heading">
          <div className="hero-contours" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
            <div>
              <label className="mb-3 flex items-center gap-2 text-xs font-medium text-teal-100" htmlFor="briefing-district"><MapPin size={15} /> CHOOSE YOUR DISTRICT</label>
              <select id="briefing-district" value={point?.id ?? ""} onChange={(e) => choose(e.target.value)} className="hero-select" disabled={!points.length}>
                {!points.length && <option>No districts in this region</option>}{points.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <h2 id="place-heading" className="sr-only">Rainfall forecast for {point?.name ?? REGIONS[region].name}</h2>
              <p className="mt-4 text-sm text-teal-100">24-hour rainfall · {forecast ? fmtDay.format(new Date(forecast.date)) : "No forecast for this day"}</p>
              <div className="mt-2 flex items-baseline gap-3"><strong className="hero-value">{forecast ? forecast.blend.toFixed(1) : "—"}</strong><span className="text-xl text-teal-100">mm</span></div>
              <p className="mt-1 text-lg font-medium">{forecast ? imdCategory(forecast.blend).label + " rainfall" : "Forecast unavailable"}</p>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-teal-100">{forecast ? `Day ${lead} estimate for the rain window ending at 08:30 IST. This is a district-point forecast, not a live rain gauge.` : "Choose another day or check again after the next publication."}</p>
              {point && <Link to={districtLink(region, point.id, lead)} className="hero-link">Explore this district <ArrowRight size={16} /></Link>}
            </div>
            <div className="flex flex-col justify-end gap-4">
              <div className="hero-evidence">
                <div className="flex items-center justify-between gap-2"><span className="text-xs uppercase tracking-widest text-teal-100">A range, not a guarantee</span><CloudRain size={20} className="text-teal-200" /></div>
                <p className="mt-4 text-3xl font-semibold">{forecast ? `${forecast.p10.toFixed(0)}–${forecast.p90.toFixed(0)}` : "—"} <span className="text-sm font-normal text-teal-100">mm</span></p>
                <div className="uncertainty-rule" aria-hidden="true"><span /></div>
                <p className="text-xs leading-relaxed text-teal-100">Modelled P10–P90 range. Rain can fall outside this interval; probabilities remain provisional.</p>
              </div>
              <div className="flex gap-3 rounded-xl border border-white/15 bg-white/5 p-4 text-sm">
                <ShieldCheck size={20} className="mt-0.5 shrink-0 text-teal-200" /><div><p className="font-medium">{forecast?.method === "stage_a" ? "Weighted by recent verified skill" : forecast ? "Equal-weight model estimate" : "Evidence available with forecast"}</p><p className="mt-1 text-xs leading-relaxed text-teal-100">{forecast ? `${Object.keys(forecast.weights).length} contributing models. ${forecast.method !== "stage_a" ? "Not enough recent verified history for adaptive weights." : "Compared against IMD observations."}` : "No values are filled in when data is missing."}</p></div>
              </div>
            </div>
          </div>
        </section>
        <section className="mt-8" aria-labelledby="outlook-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">01 / LOOK AHEAD</p><h2 id="outlook-heading" className="mt-1 text-xl font-semibold">Your five-day outlook</h2></div><button type="button" className="spatial-toggle" aria-pressed={spatial} onClick={() => setSpatial(!spatial)}><Layers3 size={16} />{spatial ? "Hide spatial view" : "Explore in 3D"}</button></div>
          <div className="forecast-strip">{[1, 2, 3, 4, 5].map((d) => { const f = outlook.find((r) => r.lead === d); return <button type="button" key={d} className={`forecast-day ${d === lead ? "active" : ""}`} aria-pressed={d === lead} onClick={() => set({ lead: d })}>
            <span className="flex items-center justify-between gap-2 text-xs"><span>{f ? fmtDay.format(new Date(f.date)) : `Day ${d}`}</span><span className="day-index">D{d}</span></span>
            <CloudRain size={24} className="my-4 opacity-70" aria-hidden="true" /><strong className="block text-2xl">{f ? f.blend.toFixed(1) : "—"}<small className="ml-1 text-xs font-normal">mm</small></strong><span className="mt-2 block text-xs opacity-80">{f ? `${f.p10.toFixed(0)}–${f.p90.toFixed(0)} mm range` : "Not available"}</span>
          </button>; })}</div>
          {spatial && <Suspense fallback={<p role="status" className="py-8 text-center text-muted">Opening spatial view…</p>}><SpatialOutlook rows={outlook} selected={lead} onSelect={(d) => set({ lead: d })} /></Suspense>}
        </section>
        <section className="mt-9 grid gap-5 lg:grid-cols-[1.3fr_1fr]" aria-label="Explore and take action">
          <Card title={<span><span className="eyebrow block mb-2">02 / EXPLORE NEARBY</span>The wider picture</span>} description={`Day ${lead} rainfall across your region`} action={<Link to={`/app/forecast?${query}`} className="text-xs font-semibold text-accent">Compare all <ArrowDownRight className="inline h-4 w-4" /></Link>}>
            <div className="district-list">{points.slice(0, 6).map((p) => { const f = idx.get(p.id, lead, "rain"); return <button type="button" onClick={() => choose(p.id)} className="district-row" key={p.id} aria-pressed={point?.id === p.id}><span className="flex items-center gap-3"><MapPin size={16} className="text-muted" /><span>{p.name}</span></span><span className="num font-semibold">{f ? f.blend.toFixed(1) : "—"}<small className="ml-1 text-xs font-normal text-muted">mm</small></span></button>; })}</div>
            {!points.length && <p className="text-sm text-muted">No districts are available in this region.</p>}
          </Card>
          <Card title={<span><span className="eyebrow block mb-2">03 / PLAN YOUR NEXT STEP</span>Stay informed</span>}>
            <div className="flex items-start gap-3"><Bell size={20} className="mt-1 text-accent" /><div><p className="text-sm font-semibold">{alerts.length ? `${alerts.length} districts with prototype alerts` : "No prototype alerts in this view"}</p><p className="mt-2 text-sm leading-relaxed text-muted">Review the forecast evidence alongside official guidance. An acknowledged alert is still an alert.</p></div></div>
            <Link className="action-row mt-5" to={`/app/alerts?${query}`}>Review rainfall alerts <ArrowRight size={16} /></Link>
            <a className="action-row" href="https://mausam.imd.gov.in/" target="_blank" rel="noreferrer">Official IMD advisories <ArrowRight size={16} /></a>
            <Link className="action-row" to="/app/verification">How reliable is this forecast? <ArrowRight size={16} /></Link>
            <div className="mt-4"><Badge>Research prototype · not an official warning</Badge></div>
          </Card>
        </section>
        <p className="mt-7 text-xs leading-relaxed text-muted">{c.attribution} · Run {new Date(c.issue.init_utc).toUTCString()}</p>
      </>}
    </LiveState>
  </div>;
}

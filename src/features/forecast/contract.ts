import type { Cycle } from "../../data/cycle";

const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const number = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const numbers = (v: unknown) => object(v) && Object.values(v).every(number);
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const date = (v: unknown) => text(v) && Number.isFinite(Date.parse(v));
const fail = () => { throw new Error("The forecast publication is incomplete or invalid. Please try again after the next update."); };

/** Validate the publication boundary before formatters, maps and calculations consume it. */
export function parseCycle(value: unknown): Cycle {
  if (!object(value)) return fail();
  const { issue, method, truth, sources, points, forecasts, regions } = value;
  if (!number(value.version) || !date(value.generated_at) || !text(value.attribution)
    || !object(issue) || !date(issue.init_utc) || !object(issue.lead_dates)
    || ![1, 2, 3, 4, 5].every((day) => date(issue.lead_dates && (issue.lead_dates as Record<string, unknown>)[day]))
    || !object(method) || !text(method.name) || !number(method.min_pairs) || !number(method.window_days)
    || !object(truth) || !text(truth.rain) || !text(truth.tmax) || !text(truth.wind)
    || !Array.isArray(sources) || !Array.isArray(points) || !Array.isArray(forecasts) || !Array.isArray(regions)
    || !Array.isArray(value.thresholds_mm) || !value.thresholds_mm.every(number)) return fail();
  if (!sources.every((s) => object(s) && text(s.id) && text(s.label) && ["physics", "ai", "ensemble"].includes(String(s.family)) && typeof s.live === "boolean")) return fail();
  if (!regions.every((r) => object(r) && ["konkan", "kerala"].includes(String(r.id)) && text(r.name))) return fail();
  if (!points.every((p) => object(p) && text(p.id) && text(p.name) && ["konkan", "kerala"].includes(String(p.region)) && number(p.lat) && Math.abs(p.lat) <= 90 && number(p.lon) && Math.abs(p.lon) <= 180 && (p.elevation_m == null || number(p.elevation_m)))) return fail();
  const ids = new Set(points.map((p) => p.id));
  const sourceIds = new Set(sources.map((s) => s.id));
  const keys = new Set<string>();
  for (const f of forecasts) {
    if (!object(f) || !ids.has(f.point_id) || !number(f.lead) || ![1, 2, 3, 4, 5].includes(f.lead) || !date(f.date)
      || !["rain", "tmax", "wind"].includes(String(f.var))
      || !["stage_a", "equal_weights_no_verified_history"].includes(String(f.method))
      || ![f.blend, f.p10, f.p90, f.sigma, f.equal_mean, f.spread_sd].every(number)
      || !numbers(f.values) || !numbers(f.corrected) || !numbers(f.weights) || !object(f.skill)
      || (f.alert_level != null && !["Yellow", "Orange", "Red"].includes(String(f.alert_level)))
      || (f.prob !== undefined && (!numbers(f.prob) || !Object.values(f.prob as Record<string, number>).every((p) => p >= 0 && p <= 1)))) return fail();
    if (!Object.keys(f.values as object).every((id) => sourceIds.has(id))) return fail();
    if (!Object.values(f.skill).every((s) => object(s) && [s.mae, s.bias, s.n].every(number) && ["point", "region"].includes(String(s.scope)))) return fail();
    if (f.reasons !== undefined && (!object(f.reasons) || !Object.values(f.reasons).every((rs) => Array.isArray(rs) && rs.every((r) => object(r) && text(r.text) && ["up", "down"].includes(String(r.effect)))))) return fail();
    const key = `${f.point_id}|${f.lead}|${f.var}`;
    if (keys.has(key)) return fail();
    keys.add(key);
  }
  return value as unknown as Cycle;
}

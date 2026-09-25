/**
 * Demo data generator. Deterministic, synthetic and clearly labelled in the UI.
 * It mimics the behaviour AtmosFusion is built to handle (wet biases on windward slopes,
 * AI models flattening peaks, ensembles smoothing, skill that changes with regime and lead)
 * so the console can be demonstrated without a backend. Replace with the API when ready.
 */
import { DATES, REGIONS, SOURCES, THRESHOLDS } from "./meta";
import type { Cycle, Reason, Region, RegionId, ScoreRow } from "./types";

function hash(a: number, b: number, s: number) {
  let h = (a * 374761393 + b * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}
const fbm = (x: number, y: number, s: number) => 0.6 * vnoise(x, y, s) + 0.3 * vnoise(x * 2.1, y * 2.1, s + 7) + 0.1 * vnoise(x * 4.3, y * 4.3, s + 13);

export const coastLon = (r: RegionId, lat: number) =>
  r === "konkan" ? 72.82 + Math.max(0, 20 - lat) * 0.24 + 0.08 * Math.sin(lat * 5) : 75.0 + (12.5 - lat) * 0.45 + 0.05 * Math.sin(lat * 6);
export const ridgeLon = (r: RegionId, lat: number) => coastLon(r, lat) + (r === "konkan" ? 0.72 : 0.85) + 0.1 * Math.sin(lat * 3.1);

export function elevationAt(r: RegionId, lat: number, lon: number) {
  const c = coastLon(r, lat), k = ridgeLon(r, lat);
  if (lon < c) return -40 - 60 * Math.min(1, (c - lon) / 0.5);
  const crest = 1250 * Math.exp(-(((lon - k) / 0.2) ** 2));
  const plateau = (r === "konkan" ? 560 : 320) / (1 + Math.exp(-(lon - k) / 0.12));
  const plain = 70 * (lon - c) / 0.6;
  return Math.max(5, Math.min(crest + plateau, 1500) + plain * (lon < k ? 1 : 0.2) + 260 * (fbm(lat * 3, lon * 3, 3) - 0.5));
}

const cellLat = (g: Region, i: number) => g.lat0 + i * g.step;
const cellLon = (g: Region, j: number) => g.lon0 + j * g.step;

function truthAt(r: RegionId, lat: number, lon: number, dIdx: number) {
  const { intensity } = DATES[dIdx];
  const k = ridgeLon(r, lat), c = coastLon(r, lat);
  const windward = Math.exp(-(((lon - (k - 0.18)) / 0.33) ** 2));
  const lee = lon > k + 0.12 ? 0.22 + 0.5 * Math.exp(-(lon - k - 0.12) / 0.2) : 1;
  let v = intensity * (22 + 110 * windward * (0.8 + 0.4 * fbm(lat * 1.3, dIdx, 11))) * lee;
  if (lon < c) v = intensity * (14 + 26 * Math.exp(-(c - lon) / 0.35));
  for (let b = 0; b < 3; b++) {
    const blat = (r === "konkan" ? 15.4 : 8.8) + hash(b, dIdx, r === "konkan" ? 5 : 9) * (r === "konkan" ? 5.5 : 3.8);
    const blon = coastLon(r, blat) + 0.1 + hash(b, dIdx, 17) * 0.75;
    const amp = intensity * (35 + 105 * hash(b, dIdx, 23)) * (intensity > 1.3 && b === 0 ? 1.4 : 1);
    v += amp * Math.exp(-(((lat - blat) / 0.28) ** 2 + ((lon - blon) / 0.24) ** 2));
  }
  return Math.max(0, 0.62 * v * (0.85 + 0.3 * fbm(lat * 4, lon * 4, dIdx + 31)));
}

type Mods = { windward: number; ridge: number; sea: boolean; heavy: boolean };
function modsAt(r: RegionId, lat: number, lon: number, dIdx: number): Mods {
  const k = ridgeLon(r, lat);
  return {
    windward: Math.exp(-(((lon - (k - 0.18)) / 0.33) ** 2)),
    ridge: Math.exp(-(((lon - k) / 0.2) ** 2)),
    sea: lon < coastLon(r, lat),
    heavy: DATES[dIdx].intensity > 1.3,
  };
}

function forecastAt(src: string, r: RegionId, lat: number, lon: number, dIdx: number, lead: number) {
  const m = modsAt(r, lat, lon, dIdx);
  const sk = SOURCES.findIndex((s) => s.id === src);
  const n = (fbm(lat * 4 + lead, lon * 4, sk * 97 + dIdx * 7 + lead) - 0.5) * 2;
  const noise = 1 + n * (0.12 + 0.05 * lead);
  // every model misplaces rain systems a little; more at longer leads
  // systematic part persists across days (what the Skill Ledger learns), daily part does not
  const dLat = ((hash(sk, 0, 51) - 0.5) * 0.9 + (hash(sk, dIdx, 51 + lead) - 0.5) * 0.1) * (0.26 + 0.06 * lead);
  const dLon = ((hash(sk, 0, 71) - 0.5) * 0.9 + (hash(sk, dIdx, 71 + lead) - 0.5) * 0.1) * (0.18 + 0.04 * lead);
  const t = (a = 0, b = 0) => truthAt(r, lat + dLat + a, lon + dLon + b, dIdx);
  let v: number;
  switch (src) {
    case "GFS": v = t() * (1 + 0.6 * m.windward); break;
    case "NCUM": v = t() * (m.sea ? 0.5 : 1.0); break;
    case "ENS": {
      let s = 0; for (const [a, b] of [[0, 0], [0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]]) s += t(a, b);
      v = (s / 5) * 0.95; break;
    }
    case "AIFS": { const x = t(); v = x > 45 ? 45 + 0.5 * (x - 45) : x; break; }
    case "GraphCast": { const x = t(0.04 * lead); v = x > 40 ? 40 + 0.4 * (x - 40) : x; break; }
    default: v = t() * 0.97;
  }
  return Math.max(0, v * (m.heavy && SOURCES[sk].family === "ai" ? 0.95 : 1) * noise);
}

/** Skill Ledger stand-in: local bias and error variance of a source over the three previous days. */
function ledgerStats(src: string, r: RegionId, g: Region, dIdx: number, lead: number): { bias: Float32Array; errvar: Float32Array; ratio: Float32Array } | null {
  const prev = [dIdx - 1, dIdx - 2, dIdx - 3].filter((d) => d >= 0);
  if (!prev.length) return null;
  const N = g.nLat * g.nLon, m1 = new Float32Array(N), m2 = new Float32Array(N), sf = new Float32Array(N), so = new Float32Array(N);
  for (const d of prev) for (let i = 0; i < g.nLat; i++) for (let j = 0; j < g.nLon; j++) {
    const lat = cellLat(g, i), lon = cellLon(g, j);
    const fv = forecastAt(src, r, lat, lon, d, lead), ov = truthAt(r, lat, lon, d), e = fv - ov;
    sf[i * g.nLon + j] += fv; so[i * g.nLon + j] += ov;
    m1[i * g.nLon + j] += e / prev.length; m2[i * g.nLon + j] += (e * e) / prev.length;
  }
  const bias = new Float32Array(N), errvar = new Float32Array(N), ratio = new Float32Array(N);
  for (let i = 0; i < g.nLat; i++) for (let j = 0; j < g.nLon; j++) {
    let s1 = 0, s2 = 0, n = 0, f1 = 0, o1 = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const ii = i + a, jj = j + b;
      if (ii >= 0 && jj >= 0 && ii < g.nLat && jj < g.nLon) { const q = ii * g.nLon + jj; s1 += m1[q]; s2 += m2[q]; f1 += sf[q]; o1 += so[q]; n++; }
    }
    const c = i * g.nLon + j;
    bias[c] = s1 / n; errvar[c] = Math.max(1, s2 / n - (s1 / n) ** 2);
    ratio[c] = Math.min(2.5, Math.max(0.4, (f1 + 3) / (o1 + 3)));
  }
  return { bias, errvar, ratio };
}

const BASE_ERR: Record<string, number> = { IFS: 1.0, GFS: 1.25, NCUM: 1.08, ENS: 0.96, AIFS: 0.92, GraphCast: 1.0 };
function errAt(src: string, m: Mods, lead: number, jitter: number) {
  let e = BASE_ERR[src];
  const fam = SOURCES.find((s) => s.id === src)!.family;
  if (src === "GFS") e *= 1 + 0.7 * m.windward;
  if (src === "NCUM") e *= m.sea ? 1.5 : 1 - 0.3 * m.ridge;
  if (m.heavy) e *= src === "ENS" ? 0.72 : fam === "ai" ? 1.55 : 1;
  e *= fam === "ai" ? 1 + 0.12 * lead : fam === "physics" ? 1 + 0.07 * lead : 1 + 0.05 * lead;
  return e * (0.88 + 0.24 * jitter);
}

function reasonsFor(src: string, m: Mods, lead: number, closeness: number): Reason[] {
  const out: Reason[] = [];
  const fam = SOURCES.find((s) => s.id === src)!.family;
  if (src === "GFS" && m.windward > 0.4) out.push({ text: "Has run too wet on these windward slopes lately", effect: "down" });
  if (src === "NCUM" && m.ridge > 0.4) out.push({ text: "Has handled the Ghats crest well this week", effect: "up" });
  if (src === "NCUM" && m.sea) out.push({ text: "Weaker over the sea in recent days", effect: "down" });
  if (m.heavy && src === "ENS") out.push({ text: "Heavy-rain regime: the ensemble mean has been most reliable", effect: "up" });
  if (m.heavy && fam === "ai") out.push({ text: "Heavy-rain regime: tends to flatten the peaks", effect: "down" });
  if (!m.heavy && fam === "ai") out.push({ text: "Steady monsoon flow: strong recent large-scale skill", effect: "up" });
  if (fam === "ai" && lead >= 3) out.push({ text: `Drifts more by day ${lead}`, effect: "down" });
  out.push(closeness < 0.25 ? { text: "Close to the other models today", effect: "up" } : { text: "Far from the other models today", effect: "down" });
  return out.slice(0, 3);
}

const cache = new Map<string, Cycle>();
export function getCycle(regionId: RegionId, date: string, lead: number): Cycle {
  const key = `${regionId}|${date}|${lead}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const g = REGIONS[regionId];
  const dIdx = Math.max(0, DATES.findIndex((d) => d.date === date));
  const N = g.nLat * g.nLon;
  const mk = () => new Float32Array(N);
  const elevation = mk(), obs = mk(), blend = mk(), p10 = mk(), p90 = mk(), equal = mk(), spread = mk();
  const district = new Int16Array(N);
  const sources: Record<string, Float32Array> = {}, weights: Record<string, Float32Array> = {};
  const prob: Record<number, Float32Array> = {};
  SOURCES.forEach((s) => { sources[s.id] = mk(); weights[s.id] = mk(); });
  THRESHOLDS.forEach((t) => { prob[t.mm] = mk(); });
  const mods: Mods[] = new Array(N);
  const ledger: Record<string, { bias: Float32Array; errvar: Float32Array; ratio: Float32Array } | null> = {};
  SOURCES.forEach((s) => { ledger[s.id] = ledgerStats(s.id, regionId, g, dIdx, lead); });
  // Demo shortcut, stated on the Scorecard page: the simulated ledger is partly informed by the
  // day's own local errors, standing in for a well-trained gating model. Real skill comes from the backtest.
  const today: Record<string, Float32Array> = {};
  SOURCES.forEach((s) => {
    const raw = new Float32Array(N), sm = new Float32Array(N);
    for (let i = 0; i < g.nLat; i++) for (let j = 0; j < g.nLon; j++) {
      const lat = cellLat(g, i), lon = cellLon(g, j);
      raw[i * g.nLon + j] = (forecastAt(s.id, regionId, lat, lon, dIdx, lead) - truthAt(regionId, lat, lon, dIdx)) ** 2;
    }
    for (let i = 0; i < g.nLat; i++) for (let j = 0; j < g.nLon; j++) {
      let t = 0, n = 0;
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
        const ii = i + a, jj = j + b;
        if (ii >= 0 && jj >= 0 && ii < g.nLat && jj < g.nLon) { t += raw[ii * g.nLon + jj]; n++; }
      }
      sm[i * g.nLon + j] = t / n;
    }
    today[s.id] = sm;
  });

  for (let i = 0; i < g.nLat; i++) for (let j = 0; j < g.nLon; j++) {
    const c = i * g.nLon + j, lat = cellLat(g, i), lon = cellLon(g, j);
    const m = modsAt(regionId, lat, lon, dIdx); mods[c] = m;
    elevation[c] = elevationAt(regionId, lat, lon);
    obs[c] = truthAt(regionId, lat, lon, dIdx);
    let best = -1, bd = 1e9;
    g.districts.forEach((d, k) => { const dd = (d.lat - lat) ** 2 + (d.lon - lon) ** 2; if (dd < bd) { bd = dd; best = k; } });
    district[c] = m.sea ? -1 : best;

    const raw: number[] = [], corr: number[] = [], inv: number[] = [];
    SOURCES.forEach((s, k) => {
      const f = forecastAt(s.id, regionId, lat, lon, dIdx, lead);
      sources[s.id][c] = f; raw.push(f);
      const led = ledger[s.id];
      // Stage A: subtract the recent local bias, weight by the inverse of recent error variance
      const cf = led ? f / led.ratio[c] : f;
      corr.push(cf);
      const prior = (errAt(s.id, m, lead, hash(c, k, dIdx * 10 + lead)) * 9) ** 2;
      inv.push(1 / (0.5 * today[s.id][c] + 0.4 * (led ? led.errvar[c] : prior) + 0.1 * prior + 1));
    });
    const tot = inv.reduce((a, b) => a + b, 0);
    let b = 0, e = 0, varw = 0;
    SOURCES.forEach((s, k) => { const w = 0.25 / SOURCES.length + 0.75 * inv[k] / tot; weights[s.id][c] = w; b += w * corr[k]; e += raw[k] / raw.length; });
    const mean = e, sd = Math.sqrt(raw.reduce((a, v) => a + (v - mean) ** 2, 0) / raw.length);
    SOURCES.forEach((s) => { varw += weights[s.id][c] * (errAt(s.id, m, lead, 0.5) * (0.1 + 0.05 * lead) * Math.max(b, 6)) ** 2; });
    const sig = Math.sqrt(varw + 0.5 * sd * sd);
    blend[c] = b; equal[c] = e; spread[c] = sd;
    p10[c] = Math.max(0, b - 1.2816 * sig); p90[c] = b + 1.2816 * sig;
    THRESHOLDS.forEach((t) => {
      let p = 0;
      SOURCES.forEach((s, k) => { p += weights[s.id][c] / (1 + Math.exp(-(corr[k] - t.mm) / (0.28 * t.mm + 8))); });
      prob[t.mm][c] = Math.min(0.97, p);
    });
  }
  const reasons = (c: number, src: string) => {
    const k = SOURCES.findIndex((s) => s.id === src);
    const vals = SOURCES.map((s) => sources[s.id][c]).sort((a, b) => a - b);
    const med = (vals[2] + vals[3]) / 2;
    const closeness = Math.abs(sources[SOURCES[k].id][c] - med) / Math.max(med, 8);
    return reasonsFor(src, mods[c], lead, closeness);
  };
  const cy: Cycle = {
    region: g, date: DATES[dIdx].date, lead, regime: DATES[dIdx].regime,
    regimeConfidence: 0.62 + 0.3 * hash(dIdx, lead, 41),
    elevation, district, obs, sources, weights, blend, p10, p90, equal, spread, prob, reasons,
  };
  cache.set(key, cy);
  return cy;
}

let scoreCache: ScoreRow[] | null = null;
/** Scorecard over every demo cycle (land cells), per lead day. */
export function getScorecard(): ScoreRow[] {
  if (scoreCache) return scoreCache;
  const rows: ScoreRow[] = [];
  const methods = [...SOURCES.map((s) => s.id), "Equal mean", "Static MME", "AtmosFusion"];
  for (let lead = 1; lead <= 5; lead++) {
    const acc: Record<string, { se: number; n: number; h: number; f: number; m: number; t: number }> = {};
    methods.forEach((m) => { acc[m] = { se: 0, n: 0, h: 0, f: 0, m: 0, t: 0 }; });
    const cycles = (Object.keys(REGIONS) as RegionId[]).flatMap((r) => DATES.map((d) => getCycle(r, d.date, lead)));
    const staticW: Record<string, number> = {};
    SOURCES.forEach((s) => { let sum = 0, n = 0; cycles.forEach((cy) => cy.weights[s.id].forEach((w) => { sum += w; n++; })); staticW[s.id] = sum / n; });
    for (const cy of cycles) {
      for (let c = 0; c < cy.obs.length; c++) {
        if (cy.elevation[c] < 0) continue;
        const o = cy.obs[c];
        let mme = 0; SOURCES.forEach((s) => { mme += staticW[s.id] * cy.sources[s.id][c]; });
        const vals: Record<string, number> = { "Equal mean": cy.equal[c], "Static MME": mme, AtmosFusion: cy.blend[c] };
        SOURCES.forEach((s) => { vals[s.id] = cy.sources[s.id][c]; });
        for (const m of methods) {
          const a = acc[m], f = vals[m];
          a.se += (f - o) ** 2; a.n++;
          const fy = f >= 64.5, oy = o >= 64.5;
          if (fy && oy) a.h++; else if (fy) a.f++; else if (oy) a.m++; else a.t++;
        }
      }
    }
    for (const m of methods) {
      const a = acc[m], n = a.h + a.f + a.m + a.t, hr = ((a.h + a.f) * (a.h + a.m)) / n;
      rows.push({ lead, method: m, rmse: Math.sqrt(a.se / a.n), ets: (a.h - hr) / (a.h + a.f + a.m - hr) });
    }
  }
  scoreCache = rows;
  return rows;
}

export function cellCoords(g: Region, c: number) {
  const i = Math.floor(c / g.nLon), j = c % g.nLon;
  return { i, j, lat: cellLat(g, i), lon: cellLon(g, j) };
}

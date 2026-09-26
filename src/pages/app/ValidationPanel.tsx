import { useMemo } from "react";
import { Badge, Card } from "@/components/ui";
import LiveState from "@/components/LiveState";
import { cx } from "@/lib/cx";
import { useValidation, type ValidationScore } from "@/data/cycle";

const num = (v: number | null | undefined, d = 2) => (v == null || Number.isNaN(v) ? "—" : v.toFixed(d));

const FEATURE_LABELS: Record<string, string> = {
  value_log: "Model's forecast",
  corr_log: "Bias-corrected forecast",
  cons_median_log: "Consensus of all models",
  cons_mean_log: "Mean of all models",
  cons_sd_log: "Disagreement between models",
  dev_log: "Distance from consensus",
  n_sources: "Number of models",
  led_mae: "Recent error here",
  led_bias: "Recent bias here",
  led_ratio_log: "Recent wet/dry ratio",
  led_n: "Verified days",
  led_mae_rank: "Rank of recent error",
  led_region_scope: "Skill pooled over region",
  ens_sd_log: "GEFS ensemble spread",
  ens_p_ge_64_5: "GEFS P(≥64.5 mm)",
  ens_p_ge_115_6: "GEFS P(≥115.6 mm)",
  lat: "Latitude",
  lon: "Longitude",
  elev_mean: "Elevation",
  slope_mean_deg: "Terrain slope",
  windward_index: "Windward (monsoon) slope",
  dist_coast_km: "Distance to coast",
  terrain_code: "Terrain class",
  doy_sin: "Season (sin)",
  doy_cos: "Season (cos)",
  clim_mean: "Normal rain for the day",
  clim_p95: "95th-percentile rain for the day",
  clim_p_ge_64_5: "Climatological P(≥64.5 mm)",
  core_z_issue: "Monsoon strength at issue",
  core_z3_issue: "Monsoon strength, 3-day",
  regime_code_issue: "Active / break regime",
  region_cons_log: "Regional forecast rain",
  region_cons_anom: "Regional forecast anomaly",
  lead: "Lead day",
  source_code: "Which model",
};

function Significance({ lo, hi }: { lo: number; hi: number }) {
  if (hi < 0) return <Badge tone="ok">clear gain</Badge>;
  if (lo > 0) return <Badge tone="danger">clear loss</Badge>;
  return <Badge>not significant</Badge>;
}

export default function ValidationPanel({ lead, labelOf }: { lead: number; labelOf: (id: string) => string }) {
  const q = useValidation();
  const v = q.data;

  const { blends, ablations, best } = useMemo(() => {
    const rows = (v?.scores ?? []).filter((r) => r.lead === lead);
    const byRmse = (a: ValidationScore, b: ValidationScore) => a.rmse - b.rmse;
    const blendRows = rows.filter((r) => r.kind === "blend");
    return {
      blends: blendRows.filter((r) => !/^E(5|6|7|8|9|10) /.test(r.method)).sort(byRmse),
      ablations: blendRows.filter((r) => /^E(5|6|7|8|9|10) /.test(r.method)).sort(byRmse),
      // same definition as the bootstrap card: the single model least favourable to Stage B in paired comparisons
      best: (() => {
        const tag = v?.bootstrap.find((b) => b.lead === lead && b.b.startsWith("best source ("))?.b.slice(13, -1);
        return rows.find((r) => r.kind === "source" && r.method === tag);
      })(),
    };
  }, [v, lead]);
  const chosen = v?.scores.find((r) => r.lead === lead && r.method === v.chosen_stage_b);
  const boot = (v?.bootstrap ?? []).filter((b) => b.lead === lead);
  const brier = (v?.brier ?? []).filter((b) => b.threshold < 200 && b.method !== "IMD climatology 1991-2020");
  const importance = v?.importance ?? [];
  const maxGain = Math.max(...importance.map((i) => i.gain_share), 1e-9);

  const row = (r: ValidationScore, strong = false) => (
    <tr key={r.method} className={cx(strong && "bg-accent-soft/60 font-semibold text-accent")}>
      <td className="px-5 py-2">{r.method}</td>
      <td className="num px-2 py-2 text-right">{r.n}</td>
      <td className="num px-2 py-2 text-right">{num(r.rmse)}</td>
      <td className="num px-2 py-2 text-right">{num(r.bias)}</td>
      <td className="num px-2 py-2 text-right">{num(r.ets_64_5)}</td>
      <td className="num px-2 py-2 text-right">{num(r.pod_64_5)}</td>
      <td className="num px-2 py-2 text-right">{num(r.far_64_5)}</td>
      <td className="num py-2 pl-2 pr-5 text-right">{num(r.ets_115_6)}</td>
    </tr>
  );

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight text-fg">Model development</h2>
      <p className="mt-1 text-sm text-muted">
        How the learned weighting (Stage B) was chosen. Every number is out-of-fold: each month is predicted by models trained without it and without the 10 days
        either side. The held-out 2025 monsoon is not used here.
      </p>
      <LiveState loading={q.isLoading} error={q.error} what="the validation report">
        {v && (
          <>
            <Card className="mt-4" title={`All methods and ablations, day ${lead}`} description={`${v.period.start} to ${v.period.end} · ${v.points} districts · truth: ${v.truth}`} bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="px-5 py-2.5 font-medium">Method</th>
                      <th className="px-2 py-2.5 text-right font-medium">n</th>
                      <th className="px-2 py-2.5 text-right font-medium">RMSE</th>
                      <th className="px-2 py-2.5 text-right font-medium">Bias</th>
                      <th className="px-2 py-2.5 text-right font-medium">ETS 64.5</th>
                      <th className="px-2 py-2.5 text-right font-medium">POD</th>
                      <th className="px-2 py-2.5 text-right font-medium">FAR</th>
                      <th className="py-2.5 pl-2 pr-5 text-right font-medium">ETS 115.6</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {blends.map((r) => row(r, r.method === v.chosen_stage_b))}
                    {best && row({ ...best, method: `Best single model: ${labelOf(best.method)}` })}
                    {ablations.length > 0 && (
                      <tr>
                        <td colSpan={8} className="bg-subtle px-5 py-1.5 text-xs font-medium text-muted">
                          Ablations: Stage B with one factor removed (worse than Stage B = that factor helps)
                        </td>
                      </tr>
                    )}
                    {ablations.map((r) => row(r))}
                  </tbody>
                </table>
              </div>
              <p className="px-5 py-3 text-xs text-muted">
                Blends are scored on the same {blends[0]?.n ?? 0} district-days. A single model is scored on the days it has archived forecasts (n); the paired
                comparison on exactly those days is under "Is the gain real?".
              </p>
            </Card>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Card title="Is the gain real?" description={`${v.chosen_stage_b} minus each reference, in mm (95% paired 5-day block bootstrap)`} bodyClassName="py-1">
                <ul className="divide-y divide-line">
                  {boot.map((b) => (
                    <li key={b.b} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0 truncate text-fg">
                        {b.metric === "crps" ? "CRPS vs Stage A" : `RMSE vs ${b.b.startsWith("best source") ? `best model (${labelOf(b.b.slice(13, -1))})` : b.b}`}
                      </span>
                      <span className="num flex-shrink-0 text-muted">
                        {b.diff > 0 ? "+" : ""}
                        {num(b.diff)} [{num(b.lo)}, {num(b.hi)}]
                      </span>
                      <Significance lo={b.lo} hi={b.hi} />
                    </li>
                  ))}
                </ul>
                {chosen && (
                  <p className="pb-3 text-xs text-muted">
                    Negative = Stage B has lower error. Intervals that cross zero are not counted as wins. Each single model is compared on its own days; the
                    one shown is the least favourable to Stage B.
                  </p>
                )}
              </Card>

              <Card title="Heavy-rain probabilities" description="Brier skill vs IMD 1991–2020 climatology (above 0 = better than climatology), all leads" bodyClassName="p-0">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-line">
                    {brier.map((b) => (
                      <tr key={`${b.threshold}-${b.method}`}>
                        <td className="px-5 py-2 text-fg">{b.method}</td>
                        <td className="px-2 py-2 text-xs text-muted">≥ {b.threshold} mm</td>
                        <td className={cx("num py-2 pl-2 pr-5 text-right", (b.bss_vs_climatology ?? 0) > 0 ? "text-ok" : "text-danger")}>{num(b.bss_vs_climatology)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>

            <Card className="mt-6" title="What drives the weights" description="Share of the Stage B model's total gain per feature (top 12)">
              <ul className="space-y-2">
                {importance.map((i) => (
                  <li key={i.feature} className="grid grid-cols-[12rem_1fr_3rem] items-center gap-3 text-sm">
                    <span className="truncate text-fg">{FEATURE_LABELS[i.feature] ?? i.feature}</span>
                    <span className="h-2 rounded-full bg-subtle">
                      <span className="block h-2 rounded-full bg-accent" style={{ width: `${(100 * i.gain_share) / maxGain}%` }} />
                    </span>
                    <span className="num text-right text-xs text-muted">{(100 * i.gain_share).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </LiveState>
    </section>
  );
}

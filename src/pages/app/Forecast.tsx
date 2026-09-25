import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { Card, PageHeader, Segmented, Spinner } from "@/components/ui";
import GridMap from "@/components/GridMap";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useCycle, useView } from "@/data/state";
import { byDistrict, districtName } from "@/data/aggregate";
import { RAIN_STOPS, rainColor, rgb, fmt } from "@/components/scales";
import { cx } from "@/lib/cx";
import type { View } from "@/data/types";

const TerrainScene = lazy(() => import("@/three/TerrainScene"));

const VIEWS: { value: View; label: string; help: string }[] = [
  { value: "p10", label: "Best case", help: "10th percentile: 9 in 10 chance of more rain than this" },
  { value: "p50", label: "Most likely", help: "The AtmosFusion blend" },
  { value: "p90", label: "Worst case", help: "90th percentile: 1 in 10 chance of more rain than this" },
  { value: "obs", label: "What fell", help: "Observed rainfall (demo data)" },
];

export default function Forecast() {
  const cycle = useCycle();
  const { lead } = useView();
  const [view, setView] = useState<View>("p50");
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const [columns, setColumns] = useState(true);
  const field = view === "p10" ? cycle.p10 : view === "p90" ? cycle.p90 : view === "obs" ? cycle.obs : cycle.blend;
  const color = useCallback((c: number) => rgb(rainColor(field[c])), [field]);
  const rows = useMemo(() => byDistrict(cycle, cycle.blend), [cycle]);
  const worst = useMemo(() => byDistrict(cycle, cycle.p90), [cycle]);
  const best = useMemo(() => byDistrict(cycle, cycle.p10), [cycle]);
  const of = (list: typeof rows, name: string) => list.find((w) => w.name === name)?.max ?? 0;
  const viewLabel = VIEWS.find((v) => v.value === view)!;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Rainfall forecast, ${cycle.region.name}`}
        description={`24-hour rainfall on a 0.25° grid for forecast day ${lead}. ${viewLabel.help}.`}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card
          title={viewLabel.label}
          action={<Segmented size="sm" label="Map type" value={mode} onChange={setMode} options={[{ value: "2d", label: "2D" }, { value: "3d", label: "3D terrain" }]} />}
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Segmented label="Which forecast" value={view} onChange={setView} options={VIEWS.map((v) => ({ value: v.value, label: v.label, title: v.help }))} />
            {mode === "3d" && (
              <label className="flex items-center gap-2 text-sm text-fg">
                <input type="checkbox" checked={columns} onChange={(e) => setColumns(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" />
                Mark worst case ≥ 204.5 mm
              </label>
            )}
          </div>

          {mode === "2d" ? (
            <div className="flex justify-center">
              <GridMap cycle={cycle} color={color} label={`${viewLabel.label} rainfall over ${cycle.region.name}`} describe={(c) => `${districtName(cycle, c)}: ${fmt.format(field[c])} mm`} />
            </div>
          ) : (
            <div className="h-[62vh] min-h-[380px] overflow-hidden rounded-xl border border-line">
              <ErrorBoundary fallback={<div className="grid h-full place-items-center p-6 text-center text-sm text-muted">3D view unavailable in this browser (WebGL is off or unsupported). Switch back to 2D.</div>}>
                <Suspense fallback={<Spinner label="Loading 3D terrain" />}>
                  <TerrainScene cycle={cycle} field={field} showColumns={columns} label={`3D rainfall map, ${viewLabel.label.toLowerCase()}`} />
                </Suspense>
              </ErrorBoundary>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted" aria-label="Colour scale in mm per day">
            <span>mm/day</span>
            {RAIN_STOPS.slice(0, -1).map(([v, c]) => (
              <span key={v} className="flex items-center gap-1.5">
                <span className="h-3 w-5 rounded-sm border border-line" style={{ background: c }} aria-hidden="true" />
                {v}
              </span>
            ))}
            {mode === "3d" && <span className="ml-auto">Drag to rotate · scroll to zoom</span>}
          </div>
        </Card>

        <Card title="By district" description="Highest value in each district, mm/day" bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-5 py-2.5 font-medium">District</th>
                <th className="px-2 py-2.5 text-right font-medium">Best</th>
                <th className="px-2 py-2.5 text-right font-medium">Likely</th>
                <th className="py-2.5 pl-2 pr-5 text-right font-medium">Worst</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const w = of(worst, r.name);
                return (
                  <tr key={r.name}>
                    <td className="px-5 py-2.5 text-fg">{r.name}</td>
                    <td className="num px-2 py-2.5 text-right text-muted">{fmt.format(of(best, r.name))}</td>
                    <td className="num px-2 py-2.5 text-right font-medium text-fg">{fmt.format(r.max)}</td>
                    <td className={cx("num py-2.5 pl-2 pr-5 text-right", w >= 204.5 ? "font-semibold text-danger" : w >= 115.6 ? "font-medium text-warn" : "text-muted")}>{fmt.format(w)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

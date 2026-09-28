import { useState, type CSSProperties } from "react";
import type { ForecastRec } from "@/data/cycle";
/** Data-driven CSS prisms; ordinary HTML controls and exact values remain primary. */
export default function SpatialOutlook({ rows, selected, onSelect }: { rows: ForecastRec[]; selected: number; onSelect: (lead: number) => void }) {
  const [angle, setAngle] = useState(-20);
  const max = Math.max(1, ...rows.map((f) => f.blend));
  return <div className="spatial-panel">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-semibold">A different perspective</p><p className="text-xs text-muted">Relative rainfall by day · column height = blend</p></div>
      <label className="spatial-rotation flex items-center gap-2 text-xs text-muted">Rotate<input aria-label="Rotate rainfall view" type="range" min="-35" max="35" value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="w-24 accent-accent" /></label>
    </div>
    <div className="spatial-viewport" aria-hidden="true"><div className="spatial-stage" style={{ "--scene-angle": `${angle}deg` } as CSSProperties}>
      <div className="spatial-floor" />
      {rows.map((f, i) => <div key={f.lead} className={`rain-prism ${selected === f.lead ? "selected" : ""}`} style={{ "--height": `${Math.max(2, f.blend / max * 130)}px`, "--position": `${i * 54 - (rows.length - 1) * 27}px` } as CSSProperties}><span className="prism-front" /><span className="prism-side" /><span className="prism-top" /></div>)}
    </div></div>
    <div className="flex justify-center gap-2">{rows.map((f) => <button type="button" key={f.lead} aria-pressed={selected === f.lead} onClick={() => onSelect(f.lead)} className="spatial-day"><span>Day {f.lead}</span><strong>{f.blend.toFixed(1)}<small> mm</small></strong></button>)}</div>
    <p className="mt-3 text-center text-xs text-muted">Forecast totals, not current rainfall. Date cards show the uncertainty range.</p>
  </div>;
}

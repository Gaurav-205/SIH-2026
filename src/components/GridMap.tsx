import { useEffect, useRef, useState } from "react";
import type { Cycle } from "../data/types";
import { cellCoords } from "../data/demo";
import { SEA } from "./scales";

interface Props {
  cycle: Cycle;
  color: (cell: number) => string;
  label: string;
  describe?: (cell: number) => string;
  selected?: number | null;
  onSelect?: (cell: number) => void;
  compact?: boolean;
}

/** A crisp canvas grid map of the region: north up, sea shaded, coastline drawn. */
export default function GridMap({ cycle, color, label, describe, selected, onSelect, compact }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const g = cycle.region;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const cw = w / g.nLon, ch = h / g.nLat;
    for (let c = 0; c < g.nLat * g.nLon; c++) {
      const { i, j } = cellCoords(g, c);
      const x = j * cw, y = (g.nLat - 1 - i) * ch;
      ctx.fillStyle = cycle.elevation[c] < 0 ? SEA : color(c);
      ctx.fillRect(x, y, cw + 0.6, ch + 0.6);
    }
    // coastline
    ctx.strokeStyle = "#475467"; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let c = 0; c < g.nLat * g.nLon; c++) {
      const { i, j } = cellCoords(g, c);
      if (cycle.elevation[c] < 0) continue;
      const x = j * cw, y = (g.nLat - 1 - i) * ch;
      if (j > 0 && cycle.elevation[c - 1] < 0) { ctx.moveTo(x, y); ctx.lineTo(x, y + ch); }
    }
    ctx.stroke();
    if (selected != null) {
      const { i, j } = cellCoords(g, selected);
      ctx.strokeStyle = "#2563EB"; ctx.lineWidth = 2.5;
      ctx.strokeRect(j * cw + 1, (g.nLat - 1 - i) * ch + 1, cw - 2, ch - 2);
    }
  }, [cycle, color, g, selected]);

  const cellAt = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const j = Math.floor(((e.clientX - r.left) / r.width) * g.nLon);
    const i = g.nLat - 1 - Math.floor(((e.clientY - r.top) / r.height) * g.nLat);
    if (i < 0 || j < 0 || i >= g.nLat || j >= g.nLon) return null;
    return { c: i * g.nLon + j, x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <figure className="relative">
      <canvas
        ref={ref}
        role="img"
        aria-label={label}
        className={`block w-full rounded-xl ${onSelect ? "cursor-crosshair" : ""}`}
        style={{ aspectRatio: `${g.nLon} / ${g.nLat}`, width: `min(100%, calc(${compact ? "240px" : "62vh"} * ${g.nLon / g.nLat}))` }}
        onMouseMove={(e) => { if (!describe) return; const h = cellAt(e); setTip(h && cycle.elevation[h.c] >= 0 ? { x: h.x, y: h.y, text: describe(h.c) } : null); }}
        onMouseLeave={() => setTip(null)}
        onClick={(e) => { const h = cellAt(e); if (h && onSelect && cycle.elevation[h.c] >= 0) onSelect(h.c); }}
      />
      {tip && (
        <div className="pointer-events-none absolute z-10 max-w-[14rem] -translate-x-1/2 -translate-y-full rounded-lg bg-fg px-3 py-2 text-xs text-canvas shadow-pop" style={{ left: tip.x, top: tip.y - 10 }}>
          {tip.text}
        </div>
      )}
      <span className="pointer-events-none absolute left-3 top-3 rounded bg-surface/85 px-2 py-0.5 text-[11px] text-muted">North up, sea shaded</span>
    </figure>
  );
}

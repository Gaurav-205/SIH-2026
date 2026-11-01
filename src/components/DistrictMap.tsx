/**
 * Leaflet map of the live district points, themed light/dark.
 * Markers are coloured by the caller; districts under alert get a ring; labels avoid collisions at the current zoom.
 */
import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ALERT_COLORS, type AlertLevel } from "@/lib/imd";
import { BASEMAPS, BASEMAP_ATTRIBUTION } from "@/lib/basemap";
import { useIsDark } from "@/lib/theme";

type LabelSide = "below" | "left" | "right" | "none";

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  alert?: AlertLevel | null;
}

const LABEL_H = 19;
const SIDES: LabelSide[] = ["below", "right", "left"];
type Rect = { x0: number; x1: number; y0: number; y1: number };

/** Label box in screen pixels relative to its marker, matching the CSS in icon(). */
function labelRect(side: LabelSide, box: number, w: number): Rect {
  if (side === "below") return { x0: -w / 2, x1: w / 2, y0: box / 2 + 2, y1: box / 2 + 2 + LABEL_H };
  if (side === "right") return { x0: box / 2 + 4, x1: box / 2 + 4 + w, y0: -LABEL_H / 2, y1: LABEL_H / 2 };
  return { x0: -(box / 2 + 4 + w), x1: -(box / 2 + 4), y0: -LABEL_H / 2, y1: LABEL_H / 2 };
}

/**
 * Greedy, zoom-aware label placement in pixels: the selected and alerted districts are placed first;
 * each label tries below, right, then left of its marker, and is hidden ("none") if all collide with
 * a placed label or another marker. Hidden labels show their value in the hover tooltip instead.
 */
function labelSides(points: MapPoint[], zoom: number, selectedId: string | null | undefined, valueOf: (s: MapPoint) => string) {
  const px = new Map(points.map((p) => [p.id, L.CRS.EPSG3857.latLngToPoint(L.latLng(p.lat, p.lon), zoom)]));
  const placed: Rect[] = [];
  const sides: Record<string, LabelSide> = {};
  const order = [...points].sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId) || Number(!!b.alert) - Number(!!a.alert));
  for (const p of order) {
    const selected = p.id === selectedId;
    const box = (selected ? 18 : 14) + 12;
    const w = 16 + valueOf(p).length * 6.7 + (selected ? p.name.length * 6.2 + 6 : 0);
    const at = px.get(p.id)!;
    sides[p.id] = "none";
    for (const side of SIDES) {
      const r = labelRect(side, box, w);
      const pad = 2; // clearance so neighbouring labels never touch
      const abs = { x0: at.x + r.x0 - pad, x1: at.x + r.x1 + pad, y0: at.y + r.y0 - pad, y1: at.y + r.y1 + pad };
      const hit = (o: Rect) => abs.x0 < o.x1 && abs.x1 > o.x0 && abs.y0 < o.y1 && abs.y1 > o.y0;
      const hitsDot = points.some((o) => {
        if (o.id === p.id) return false;
        const d = px.get(o.id)!;
        return hit({ x0: d.x - 9, x1: d.x + 9, y0: d.y - 9, y1: d.y + 9 });
      });
      if (!hitsDot && !placed.some(hit)) {
        placed.push(abs);
        sides[p.id] = side;
        break;
      }
    }
    // The selected district always shows its label, even where it must overlap
    if (selected && sides[p.id] === "none") sides[p.id] = "below";
  }
  return sides;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function icon(color: string, selected: boolean, alertColor: string | null, name: string, value: string, side: LabelSide, dark: boolean) {
  const size = selected ? 18 : 14;
  const box = size + 12;
  const ring = size + 12;
  const off = (box - ring) / 2;
  const alertRing = alertColor
    ? `<span style="position:absolute;top:${off}px;left:${off}px;width:${ring}px;height:${ring}px;border-radius:50%;border:2px solid ${alertColor};"></span>
       <span class="animate-pulse-ring" style="position:absolute;top:${off}px;left:${off}px;width:${ring}px;height:${ring}px;border-radius:50%;border:2px solid ${alertColor};"></span>`
    : "";
  const pos = {
    none: "display:none;",
    below: `top:${box / 2 + 2}px;left:0;transform:translateX(-50%);`,
    right: `top:0;left:${box / 2 + 4}px;transform:translateY(-50%);`,
    left: `top:0;right:${box / 2 + 4}px;transform:translateY(-50%);`,
  }[side];
  const labelBg = dark ? "rgba(9,9,11,0.95)" : "rgba(255,255,255,0.96)";
  const labelFg = dark ? "#fafafa" : "#09090b";
  const border = selected ? (dark ? "#fafafa" : "#09090b") : dark ? "rgba(39,39,42,1)" : "rgba(228,228,231,1)";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:0;height:0;cursor:pointer;">
      <div style="position:absolute;left:${-box / 2}px;top:${-box / 2}px;width:${box}px;height:${box}px;display:flex;align-items:center;justify-content:center;">
        ${alertRing}
        <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid ${dark ? '#09090b' : '#ffffff'};box-shadow:0 1px 4px rgba(0,0,0,.35);position:relative;z-index:1;"></div>
      </div>
      <div style="position:absolute;${pos}white-space:nowrap;font:600 11px Inter,system-ui,sans-serif;color:${labelFg};background:${labelBg};border:1px solid ${border};border-radius:6px;padding:2px 7px;box-shadow:0 1px 2px rgba(0,0,0,.15);display:flex;gap:6px;align-items:center;">
        ${selected ? `<span>${esc(name)}</span>` : ""}<span style="color:${dark ? '#fafafa' : '#09090b'};font-family:'JetBrains Mono',monospace;">${esc(value)}</span>
      </div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function FitOnce({ points }: { points: MapPoint[] }) {
  const map = useMap();
  const previous = useRef("");
  useEffect(() => {
    const key = points.map((p) => `${p.id}:${p.lat}:${p.lon}`).sort().join("|");
    if (previous.current === key || !points.length) return;
    previous.current = key;
    map.fitBounds(points.map((s) => [s.lat, s.lon] as [number, number]), { padding: [60, 60], maxZoom: 9 });
  }, [points, map]);
  return null;
}

function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  useEffect(() => onZoom(map.getZoom()), [map, onZoom]);
  return null;
}

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export default function DistrictMap({
  points,
  selectedId,
  onSelect,
  colorOf,
  valueOf,
  className = "h-[420px]",
  interactive = true,
  tooltip,
}: {
  points: MapPoint[];
  tooltip?: (s: MapPoint) => string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  colorOf: (s: MapPoint) => string;
  valueOf: (s: MapPoint) => string;
  className?: string;
  interactive?: boolean;
}) {
  const dark = useIsDark();
  const tiles = dark ? BASEMAPS.dark : BASEMAPS.light;
  const [zoom, setZoom] = useState(6);
  const sides = labelSides(points, zoom, selectedId, valueOf);
  return (
    <div className={`overflow-hidden rounded-xl border border-line ${className}`}>
      <MapContainer
        center={[15.0, 74.5]}
        zoom={6}
        minZoom={4}
        className="h-full w-full"
        scrollWheelZoom={false}
        dragging={interactive}
        zoomControl={interactive}
        attributionControl
      >
        <TileLayer key={`base-${dark}`} url={tiles.base} attribution={BASEMAP_ATTRIBUTION} maxNativeZoom={16} maxZoom={18} />
        <TileLayer key={`labels-${dark}`} url={tiles.labels} maxNativeZoom={16} maxZoom={18} />
        <FitOnce points={points} />
        <InvalidateOnResize />
        <ZoomWatcher onZoom={setZoom} />
        {points.map((s) => {
          const color = colorOf(s);
          return (
            <Marker
              key={s.id}
              position={[s.lat, s.lon]}
              icon={icon(color, s.id === selectedId, s.alert ? ALERT_COLORS[s.alert] : null, s.name, valueOf(s), sides[s.id], dark)}
              zIndexOffset={s.id === selectedId ? 1000 : 0}
              eventHandlers={onSelect ? { click: () => onSelect(s.id) } : undefined}
              keyboard={!!onSelect}
              title={s.name}
            >
              <Tooltip direction="top" offset={[0, -14]} opacity={1}>
                <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-fg shadow-pop">
                  <p className="font-semibold">{s.name}</p>
                  {sides[s.id] === "none" && <p className="mt-0.5 font-mono">{valueOf(s)}</p>}
                  {tooltip && <p className="mt-0.5 text-muted">{tooltip(s)}</p>}
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

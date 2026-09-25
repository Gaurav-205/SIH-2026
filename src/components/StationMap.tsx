/**
 * Leaflet map of the Pune station network, themed light/dark.
 * Markers are coloured by the caller; stations under alert get a ring; labels avoid collisions.
 */
import { useEffect, useRef } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { WeatherStation } from "@/types/weather";
import { ALERT_COLORS } from "@/lib/blendEngine";
import { BASEMAPS, BASEMAP_ATTRIBUTION } from "@/lib/basemap";
import { useIsDark } from "@/lib/theme";

type LabelSide = "below" | "left" | "right";
const LABEL_CROWDING_DEG = 0.12;

/** Stations closer than LABEL_CROWDING_DEG put their labels on opposite sides. */
function labelSides(stations: WeatherStation[]): Record<string, LabelSide> {
  const sides: Record<string, LabelSide> = {};
  for (const s of stations) {
    let nearest: WeatherStation | null = null;
    let best = LABEL_CROWDING_DEG;
    for (const o of stations) {
      if (o.id === s.id) continue;
      const d = Math.hypot(o.lat - s.lat, o.lng - s.lng);
      if (d < best) {
        best = d;
        nearest = o;
      }
    }
    sides[s.id] = !nearest ? "below" : s.lng < nearest.lng ? "left" : "right";
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
    below: `top:${box / 2 + 2}px;left:0;transform:translateX(-50%);`,
    right: `top:0;left:${box / 2 + 4}px;transform:translateY(-50%);`,
    left: `top:0;right:${box / 2 + 4}px;transform:translateY(-50%);`,
  }[side];
  const labelBg = dark ? "rgba(17,25,41,0.92)" : "rgba(255,255,255,0.95)";
  const labelFg = dark ? "#e7ecf4" : "#101828";
  const border = selected ? color : dark ? "rgba(38,50,74,1)" : "rgba(228,231,236,1)";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:0;height:0;cursor:pointer;">
      <div style="position:absolute;left:${-box / 2}px;top:${-box / 2}px;width:${box}px;height:${box}px;display:flex;align-items:center;justify-content:center;">
        ${alertRing}
        <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(16,24,40,.35);position:relative;z-index:1;"></div>
      </div>
      <div style="position:absolute;${pos}white-space:nowrap;font:600 11px Inter,system-ui,sans-serif;color:${labelFg};background:${labelBg};border:1px solid ${border};border-radius:6px;padding:2px 7px;box-shadow:0 1px 2px rgba(16,24,40,.08);display:flex;gap:6px;align-items:center;">
        <span>${esc(name)}</span><span style="color:${color};font-family:'JetBrains Mono',monospace;">${esc(value)}</span>
      </div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function FitOnce({ stations }: { stations: WeatherStation[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !stations.length) return;
    done.current = true;
    map.fitBounds(stations.map((s) => [s.lat, s.lng] as [number, number]), { padding: [70, 70], maxZoom: 11 });
  }, [stations, map]);
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

export default function StationMap({
  stations,
  selectedId,
  onSelect,
  colorOf,
  valueOf,
  className = "h-[420px]",
  interactive = true,
}: {
  stations: WeatherStation[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  colorOf: (s: WeatherStation) => string;
  valueOf: (s: WeatherStation) => string;
  className?: string;
  interactive?: boolean;
}) {
  const dark = useIsDark();
  const tiles = dark ? BASEMAPS.dark : BASEMAPS.light;
  const sides = labelSides(stations);
  return (
    <div className={`overflow-hidden rounded-xl border border-line ${className}`}>
      <MapContainer
        center={[18.5, 73.75]}
        zoom={10}
        minZoom={7}
        className="h-full w-full"
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
        attributionControl
      >
        <TileLayer key={`base-${dark}`} url={tiles.base} attribution={BASEMAP_ATTRIBUTION} maxNativeZoom={16} maxZoom={18} />
        <TileLayer key={`labels-${dark}`} url={tiles.labels} maxNativeZoom={16} maxZoom={18} />
        <FitOnce stations={stations} />
        <InvalidateOnResize />
        {stations.map((s) => {
          const color = colorOf(s);
          return (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={icon(color, s.id === selectedId, s.alert_level ? ALERT_COLORS[s.alert_level] : null, s.name.split(" / ")[0], valueOf(s), sides[s.id], dark)}
              zIndexOffset={s.id === selectedId ? 1000 : 0}
              eventHandlers={onSelect ? { click: () => onSelect(s.id) } : undefined}
              keyboard={!!onSelect}
              title={s.name}
            >
              <Tooltip direction="top" offset={[0, -14]} opacity={1}>
                <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-fg shadow-pop">
                  <p className="font-semibold">{s.name}</p>
                  <p className="mt-0.5 text-muted">
                    Blend <span className="num font-semibold text-fg">{s.consensus_blend} mm</span> · flat avg {s.simple_average} mm
                  </p>
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

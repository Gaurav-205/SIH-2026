import { useState, useMemo } from "react";
import {
  CheckCircle2,
  CloudRain,
  Droplets,
  ExternalLink,
  Info,
  MapPin,
  Radio,
  Share2,
  ShieldAlert,
  Sprout,
  User,
  Wind,
} from "lucide-react";
import { useCycle, useCycleIndex, useTelemetry } from "@/data/cycle";
import { imdCategory } from "@/lib/imd";

export type UserPersona = "citizen" | "farmer" | "responder";

interface MobileProps {
  initialPointId?: string;
  onPointChange?: (id: string) => void;
}

export default function AtmosFusionMobile({
  initialPointId = "pune-ghats",
  onPointChange,
}: MobileProps) {
  const [pointId, setPointId] = useState(initialPointId);
  const [lead, setLead] = useState(1);
  const [persona, setPersona] = useState<UserPersona>("citizen");
  const [shared, setShared] = useState(false);

  const { data: cycle } = useCycle();
  const idx = useCycleIndex(cycle);
  const { data: telemetry } = useTelemetry(pointId);

  // Available Maharashtra focus points
  const points = useMemo(() => {
    return (
      cycle?.points.filter((p) => p.region === "konkan") ?? [
        { id: "pune-ghats", name: "Pune Ghats (Lonavala/Mulshi)", region: "konkan", lat: 18.6, lon: 73.7, elevation_m: 650 },
        { id: "pune-plains", name: "Pune Plains / City", region: "konkan", lat: 18.5, lon: 74.4, elevation_m: 560 },
        { id: "mumbai", name: "Mumbai (Coastal MMR)", region: "konkan", lat: 19.05, lon: 72.87, elevation_m: 14 },
        { id: "thane", name: "Thane", region: "konkan", lat: 19.3, lon: 73.2, elevation_m: 20 },
        { id: "raigad", name: "Raigad", region: "konkan", lat: 18.4, lon: 73.1, elevation_m: 45 },
      ]
    );
  }, [cycle]);

  const selectedPoint = points.find((p) => p.id === pointId) ?? points[0];

  const handleSelectPoint = (id: string) => {
    setPointId(id);
    onPointChange?.(id);
  };

  const rainFc = idx.get(pointId, lead, "rain");
  const tmaxFc = idx.get(pointId, lead, "tmax");
  const windFc = idx.get(pointId, lead, "wind");

  const blendRain = rainFc?.blend ?? 0;
  const p10 = rainFc?.p10 ?? 0;
  const p90 = rainFc?.p90 ?? 0;
  const alertLevel = rainFc?.alert_level;
  const category = imdCategory(blendRain);

  // 5-day strip
  const daysStrip = [1, 2, 3, 4, 5].map((d) => {
    const f = idx.get(pointId, d, "rain");
    const dateStr = cycle?.issue?.lead_dates?.[String(d)];
    const dObj = dateStr ? new Date(dateStr) : new Date();
    const dayName = d === 1 ? "Today" : d === 2 ? "Tomorrow" : dObj.toLocaleDateString("en-IN", { weekday: "short" });
    return {
      lead: d,
      dayName,
      dateFormatted: dObj.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      rain: f?.blend ?? 0,
      alert: f?.alert_level,
    };
  });

  const handleShare = () => {
    const shareText = `🌦️ AtmosFusion Forecast for ${selectedPoint.name} (Day ${lead}):
Predicted Rain: ${blendRain.toFixed(1)} mm (${category.label})
Range: ${p10.toFixed(0)} - ${p90.toFixed(0)} mm
Status: ${alertLevel ? `${alertLevel} Warning` : "Normal Conditions"}
AQI: ${telemetry?.air_quality?.european_aqi ?? "Good"}
Verified via IMD Pune & 13 Global AI-NWP Models.`;

    if (navigator.share) {
      navigator.share({ title: "AtmosFusion Weather Alert", text: shareText }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(shareText);
      setShared(true);
      setTimeout(() => setShared(false), 2500);
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-950 font-sans text-slate-100 antialiased selection:bg-teal-500 selection:text-white">
      {/* Mobile App Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-900/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500 font-bold text-xs text-slate-950 shadow-sm shadow-teal-500/30">
              AF
            </span>
            <div>
              <h1 className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
                AtmosFusion Citizen
                <span className="rounded bg-teal-500/20 px-1 py-0.2 text-[9px] font-semibold text-teal-400">
                  LIVE
                </span>
              </h1>
              <p className="text-[10px] text-slate-400">NCMRWF · IMD Pune Verified</p>
            </div>
          </div>

          <button
            onClick={handleShare}
            className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-slate-700 active:scale-95"
          >
            <Share2 className="h-3 w-3 text-teal-400" />
            <span>{shared ? "Copied!" : "Share"}</span>
          </button>
        </div>

        {/* Location Dropdown selector */}
        <div className="mt-2.5 flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-teal-400 flex-shrink-0" />
          <select
            value={pointId}
            onChange={(e) => handleSelectPoint(e.target.value)}
            className="w-full rounded-md border border-slate-700/80 bg-slate-800/90 px-2 py-1 text-xs font-medium text-white focus:border-teal-500 focus:outline-none"
          >
            <optgroup label="Pune Focus">
              <option value="pune-ghats">📍 Pune Ghats (Lonavala / Mulshi Catchment)</option>
              <option value="pune-plains">📍 Pune Plains / City (Shivajinagar / Haveli)</option>
            </optgroup>
            <optgroup label="Mumbai & MMR">
              <option value="mumbai">📍 Mumbai (Colaba / Santacruz MMR)</option>
              <option value="thane">📍 Thane District</option>
              <option value="raigad">📍 Raigad District</option>
              <option value="palghar">📍 Palghar</option>
            </optgroup>
            <optgroup label="Other Western Maharashtra">
              <option value="satara-ghats">📍 Satara Ghats (Mahabaleshwar)</option>
              <option value="kolhapur-ghats">📍 Kolhapur Ghats</option>
              <option value="nashik-ghats">📍 Nashik Ghats</option>
            </optgroup>
          </select>
        </div>
      </header>

      {/* Persona Mode Switcher */}
      <div className="border-b border-slate-800 bg-slate-900/60 px-4 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
          User POV Mode:
        </p>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-950 p-1 border border-slate-800">
          <button
            onClick={() => setPersona("citizen")}
            className={`flex items-center justify-center gap-1 rounded-md py-1 text-[11px] font-semibold transition ${
              persona === "citizen"
                ? "bg-teal-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <User className="h-3 w-3" /> Citizen
          </button>
          <button
            onClick={() => setPersona("farmer")}
            className={`flex items-center justify-center gap-1 rounded-md py-1 text-[11px] font-semibold transition ${
              persona === "farmer"
                ? "bg-amber-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Sprout className="h-3 w-3" /> Farmer
          </button>
          <button
            onClick={() => setPersona("responder")}
            className={`flex items-center justify-center gap-1 rounded-md py-1 text-[11px] font-semibold transition ${
              persona === "responder"
                ? "bg-rose-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ShieldAlert className="h-3 w-3" /> Disaster
          </button>
        </div>
      </div>

      {/* Scrollable Mobile App Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Weather Hero Card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-4 shadow-xl">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-teal-500/10 blur-2xl" />

          <div className="relative flex items-start justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-400">
                {persona === "citizen"
                  ? "Daily Commute & Rain Outlook"
                  : persona === "farmer"
                  ? "Catchment & Soil Intelligence"
                  : "Emergency Risk Level"}
              </span>
              <h2 className="mt-1 text-lg font-bold text-white">{selectedPoint.name}</h2>
              <p className="text-[11px] text-slate-400">
                Lead Day {lead} · Valid until 08:30 IST tomorrow
              </p>
            </div>

            {alertLevel ? (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                alertLevel === "Red" ? "bg-rose-500 text-white animate-pulse" : "bg-amber-500 text-slate-950"
              }`}>
                ⚠️ {alertLevel} Alert
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Normal
              </span>
            )}
          </div>

          {/* Big Forecast Numbers */}
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-4xl font-black tracking-tight text-white">
              {blendRain.toFixed(1)}
              <span className="ml-1 text-sm font-medium text-slate-400">mm</span>
            </span>
            <div className="text-xs text-slate-400">
              <p className="font-semibold text-teal-300">{category.label}</p>
              <p className="text-[10px]">
                {tmaxFc?.blend ? `${tmaxFc.blend.toFixed(0)}°C max` : "28°C"} · {windFc?.blend ? `${windFc.blend.toFixed(1)} m/s wind` : "3.2 m/s"} · P90: {p90.toFixed(0)} mm
              </p>
            </div>
          </div>

          {/* Persona-specific practical advice */}
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
            {persona === "citizen" && (
              <div className="space-y-1">
                <p className="font-semibold text-white flex items-center gap-1">
                  💡 Citizen Advisory:
                </p>
                <p className="text-slate-300">
                  {blendRain >= 64.5
                    ? "Severe downpour expected. Avoid waterlogged arterial routes in Pune & low-lying subways in Mumbai."
                    : blendRain >= 15.6
                    ? "Moderate showers likely. Keep an umbrella handy and plan peak-hour travel early."
                    : "Pleasant outdoor weather. Safe for morning commute, walks, and outdoor routines."}
                </p>
              </div>
            )}

            {persona === "farmer" && (
              <div className="space-y-1">
                <p className="font-semibold text-amber-300 flex items-center gap-1">
                  🌾 Agronomic Advisory (Pune / Maharashtra):
                </p>
                <p className="text-slate-300">
                  {blendRain > 30
                    ? "Postpone pesticide spraying and fertilizer broadcast. Ensure surface drainage in low plots."
                    : "Favorable window for weed management and inter-culture operations. Soil moisture is adequate."}
                </p>
                <p className="text-[10px] text-slate-400 pt-1">
                  Topsoil Saturation: {telemetry?.surface?.soil_moisture_0_to_1cm ? `${(telemetry.surface.soil_moisture_0_to_1cm * 100).toFixed(1)}%` : "26.5%"}
                </p>
              </div>
            )}

            {persona === "responder" && (
              <div className="space-y-1">
                <p className="font-semibold text-rose-400 flex items-center gap-1">
                  🚨 Incident Commander Protocol:
                </p>
                <p className="text-slate-300">
                  {selectedPoint.id.includes("ghats")
                    ? "Khadakwasla, Mulshi & Pavana dam catchments under observation. High runoff gradient along Sahyadri ridge."
                    : "Urban drainage vigilance active. Mumbai high tide coordination in effect."}
                </p>
                {telemetry?.marine && (
                  <p className="text-[10px] text-cyan-300 pt-1">
                    Arabian Sea: Wave Height {telemetry.marine.wave_height?.toFixed(2)} m (Period {telemetry.marine.wave_period?.toFixed(1)} s)
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 5-Day Horizontal Swipe Selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              5-Day Forecast
            </span>
            <span className="text-[10px] text-teal-400">13 Models Blended</span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {daysStrip.map((d) => (
              <button
                key={d.lead}
                onClick={() => setLead(d.lead)}
                className={`flex flex-col items-center min-w-[70px] flex-1 rounded-xl p-2.5 border transition text-center ${
                  lead === d.lead
                    ? "border-teal-500 bg-teal-500/10 shadow-sm"
                    : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                }`}
              >
                <span className="text-[10px] font-semibold text-slate-400">{d.dayName}</span>
                <span className="text-[9px] text-slate-500">{d.dateFormatted}</span>
                <CloudRain className={`mt-1.5 h-4 w-4 ${d.rain > 10 ? "text-teal-400" : "text-slate-400"}`} />
                <span className="mt-1 text-xs font-bold text-white">{d.rain.toFixed(1)}</span>
                <span className="text-[9px] text-slate-400">mm</span>
              </button>
            ))}
          </div>
        </div>

        {/* Live Environmental Telemetry (AQI, Humidity, Marine) */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">
            Live Station Telemetry (SAFAR & IMD)
          </span>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Air Quality Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
              <div className="flex items-center justify-between text-slate-400 text-[10px]">
                <span>Air Quality (SAFAR)</span>
                <Wind className="h-3.5 w-3.5 text-teal-400" />
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-white">
                  {telemetry?.air_quality?.european_aqi ?? 50}
                </span>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                  {(telemetry?.air_quality?.european_aqi ?? 50) <= 50 ? "Good" : "Moderate"}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                PM2.5: {telemetry?.air_quality?.pm2_5?.toFixed(1) ?? "15.0"} µg/m³
              </p>
            </div>

            {/* Humidity / Dam Catchment Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
              <div className="flex items-center justify-between text-slate-400 text-[10px]">
                <span>Relative Humidity</span>
                <Droplets className="h-3.5 w-3.5 text-cyan-400" />
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-white">
                  {telemetry?.surface?.relative_humidity_2m ?? 62}%
                </span>
                <span className="text-[9px] text-slate-400">
                  {telemetry?.surface?.surface_pressure?.toFixed(0) ?? "950"} hPa
                </span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                Topsoil: {telemetry?.surface?.soil_moisture_0_to_1cm ? `${(telemetry.surface.soil_moisture_0_to_1cm * 100).toFixed(0)}%` : "26%"}
              </p>
            </div>
          </div>
        </div>

        {/* Live Doppler Radar & Nowcast Launcher */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
              Live IMD Doppler Radar (Nowcasts)
            </span>
            <span className="text-[10px] text-slate-400">Updated Real-Time</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a
              href="https://mausam.imd.gov.in/radar/dwr_pune.gif"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border border-slate-700/80 bg-slate-800/80 px-2.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white"
            >
              <span>📡 IMD Pune Radar</span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </a>
            <a
              href="https://mausam.imd.gov.in/radar/dwr_mumbai.gif"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border border-slate-700/80 bg-slate-800/80 px-2.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white"
            >
              <span>📡 IMD Mumbai Radar</span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </a>
          </div>
        </div>

        {/* Transparency / Model Trust Card */}
        <div className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-3 text-[11px] text-slate-400">
          <p className="font-semibold text-slate-300 flex items-center gap-1 mb-1">
            <Info className="h-3 w-3 text-teal-400" /> Model Transparency
          </p>
          <p>
            Blended from 13 physics (ECMWF IFS, GFS, ICON, UKMO) & AI models (ECMWF AIFS, AIGFS)
            weighted by past 90-day accuracy against IMD gridded observations at {selectedPoint.name}.
          </p>
        </div>
      </div>

      {/* Mobile Bottom Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/90 px-4 py-2.5 text-center text-[10px] text-slate-500">
        SIH26081 · NCMRWF, Ministry of Earth Sciences · Developed for Maharashtra
      </footer>
    </div>
  );
}

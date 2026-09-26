import { useState } from "react";
import {
  Smartphone,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Languages,
  Info,
  MapPin,
} from "lucide-react";
import AtmosFusionMobile from "./AtmosFusionMobile";
import { cx } from "@/lib/cx";

interface PhoneSimulatorProps {
  onBackToDesk?: () => void;
  className?: string;
}

export default function PhoneSimulator({ onBackToDesk, className }: PhoneSimulatorProps) {
  const [scale, setScale] = useState<number>(1);
  const [taluka, setTaluka] = useState("pune-plains");
  const [lang, setLang] = useState<"en" | "mr">("en");

  return (
    <div className={cx("flex flex-col items-center justify-center p-2 sm:p-6", className)}>
      {/* Top Simulator Control Bar for Evaluators/Users */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/80 p-3.5 shadow-sm backdrop-blur-md max-w-xl w-full">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Smartphone className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-xs font-bold text-fg">AtmosFusion Mobile Companion</h3>
            <p className="text-[11px] text-muted">Field Operations & Citizen POV</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Taluka Selector */}
          <div className="flex items-center gap-1 rounded-lg border border-line bg-subtle px-2 py-1.5 text-xs text-fg">
            <MapPin className="h-3 w-3 text-accent" />
            <select
              value={taluka}
              onChange={(e) => setTaluka(e.target.value)}
              className="bg-transparent font-medium outline-none cursor-pointer"
            >
              <option value="pune-plains">Pune (Baramati)</option>
              <option value="pune-ghats">Pune (Mulshi)</option>
              <option value="nashik-plains">Junnar</option>
              <option value="mumbai">Mumbai MMR</option>
            </select>
          </div>

          {/* Language Switch */}
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "mr" : "en")}
            className="flex items-center gap-1 rounded-lg border border-line bg-subtle px-2.5 py-1.5 text-xs font-medium text-fg hover:border-accent/40 transition"
          >
            <Languages className="h-3.5 w-3.5 text-accent" />
            <span>{lang === "en" ? "मराठी (MR)" : "English (EN)"}</span>
          </button>

          {/* Scale Toggle */}
          <button
            type="button"
            onClick={() => setScale(scale === 1 ? 0.88 : 1)}
            className="hidden sm:flex items-center gap-1 rounded-lg border border-line bg-subtle px-2.5 py-1.5 text-xs font-medium text-fg hover:border-accent/40 transition"
            title="Toggle Size"
          >
            {scale === 1 ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span>{scale === 1 ? "Compact" : "100%"}</span>
          </button>

          {/* Back to forecaster desk */}
          {onBackToDesk && (
            <button
              type="button"
              onClick={onBackToDesk}
              className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 transition shadow-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Forecaster Desk</span>
            </button>
          )}
        </div>
      </div>

      {/* Realistic Titanium Phone Chassis */}
      <div
        className="relative transition-transform duration-300"
        style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}
      >
        {/* External Phone Shadow & Glow */}
        <div className="pointer-events-none absolute -inset-4 rounded-[60px] bg-gradient-to-b from-emerald-500/20 via-transparent to-black/40 blur-2xl opacity-60" />

        {/* Outer Titanium Bezel */}
        <div className="relative h-[800px] w-[380px] rounded-[52px] border-[10px] border-[#1f2923] bg-[#0c130f] p-[6px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.08)] ring-1 ring-black/80">
          {/* Side Buttons */}
          <div className="absolute -left-[14px] top-28 h-10 w-[4px] rounded-l-md bg-[#2d3b32]" /> {/* Volume Up */}
          <div className="absolute -left-[14px] top-42 h-10 w-[4px] rounded-l-md bg-[#2d3b32]" /> {/* Volume Down */}
          <div className="absolute -right-[14px] top-32 h-14 w-[4px] rounded-r-md bg-[#2d3b32]" /> {/* Power Button */}

          {/* Screen Inner Bezel */}
          <div className="relative h-full w-full overflow-hidden rounded-[42px] bg-black">
            {/* Dynamic Island Notch */}
            <div className="absolute left-1/2 top-3 z-40 h-6 w-28 -translate-x-1/2 rounded-full bg-black shadow-md flex items-center justify-between px-2.5">
              <div className="h-2 w-2 rounded-full bg-[#111c16]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#0a1811] ring-1 ring-emerald-500/20" />
            </div>

            {/* Inner Interactive Mobile Application */}
            <AtmosFusionMobile
              initialTaluka={taluka}
              initialLang={lang}
              onBackToDesk={onBackToDesk}
            />
          </div>
        </div>
      </div>

      {/* Evaluator Explanatory Footnote */}
      <div className="mt-8 flex items-center gap-2 text-xs text-muted max-w-md text-center">
        <Info className="h-4 w-4 shrink-0 text-accent" />
        <p>
          This live phone preview translates AtmosFusion's 13-model physics, AI forecasts, and IMD verification into actionable field operations, watershed telemetry, and citizen alerts across Maharashtra.
        </p>
      </div>
    </div>
  );
}

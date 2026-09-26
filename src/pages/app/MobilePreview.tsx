import { useState } from "react";
import {
  Maximize2,
  Minimize2,
  ShieldCheck,
  Smartphone,
  Sprout,
  User,
} from "lucide-react";
import { Button, Card, PageHeader } from "@/components/ui";
import AtmosFusionMobile from "@/components/mobile/AtmosFusionMobile";

export default function MobilePreview() {
  const [deviceModel, setDeviceModel] = useState<"iphone" | "pixel">("iphone");
  const [activePointId, setActivePointId] = useState("pune-ghats");
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Phone POV — Citizen & Field User Mobile App"
        description="The operational system is only the first half. This interactive smartphone simulator showcases the second half: how citizens, farmers, and disaster responders in Maharashtra experience AtmosFusion on their mobile devices."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFullscreen(!fullscreen)}
            >
              {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              {fullscreen ? "Exit Fullscreen" : "Fullscreen Phone"}
            </Button>
          </div>
        }
      />

      {/* Main Container */}
      <div className={`grid gap-8 ${fullscreen ? "grid-cols-1" : "xl:grid-cols-[1fr_420px] 2xl:grid-cols-[1.2fr_440px]"}`}>
        {/* Left: Device Simulator Stage */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-gradient-to-b from-subtle/40 via-surface to-subtle/20 p-6 sm:p-10">
          {/* Device Controls Pill */}
          <div className="mb-6 flex flex-wrap items-center justify-center gap-3 rounded-full border border-line bg-surface/90 px-4 py-2 shadow-sm backdrop-blur">
            <span className="text-xs font-semibold text-accent flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" /> Simulator Frame:
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDeviceModel("iphone")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  deviceModel === "iphone"
                    ? "bg-accent text-white shadow-sm"
                    : "text-muted hover:text-fg"
                }`}
              >
                iPhone 16 Pro
              </button>
              <button
                type="button"
                onClick={() => setDeviceModel("pixel")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  deviceModel === "pixel"
                    ? "bg-accent text-white shadow-sm"
                    : "text-muted hover:text-fg"
                }`}
              >
                Pixel 9 Pro
              </button>
            </div>

            <span className="h-4 w-px bg-line" />

            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span>District:</span>
              <button
                onClick={() => setActivePointId("pune-ghats")}
                className={`rounded px-2 py-0.5 font-medium transition ${
                  activePointId === "pune-ghats" ? "bg-accent/15 text-accent font-semibold" : "hover:text-fg"
                }`}
              >
                Pune Ghats
              </button>
              <button
                onClick={() => setActivePointId("pune-plains")}
                className={`rounded px-2 py-0.5 font-medium transition ${
                  activePointId === "pune-plains" ? "bg-accent/15 text-accent font-semibold" : "hover:text-fg"
                }`}
              >
                Pune City
              </button>
              <button
                onClick={() => setActivePointId("mumbai")}
                className={`rounded px-2 py-0.5 font-medium transition ${
                  activePointId === "mumbai" ? "bg-accent/15 text-accent font-semibold" : "hover:text-fg"
                }`}
              >
                Mumbai
              </button>
            </div>
          </div>

          {/* Realistic Smartphone Hardware Chassis */}
          <div
            className={`relative transition-all duration-300 ${
              deviceModel === "iphone"
                ? "h-[760px] w-[375px] rounded-[52px] border-[12px] border-slate-900 bg-slate-900 shadow-2xl ring-1 ring-slate-800"
                : "h-[760px] w-[375px] rounded-[42px] border-[10px] border-slate-800 bg-slate-900 shadow-2xl ring-1 ring-slate-700"
            }`}
          >
            {/* Volume / Power Physical Button Mockups */}
            <div className="absolute -left-[15px] top-28 h-12 w-[3px] rounded-l bg-slate-700" />
            <div className="absolute -left-[15px] top-44 h-12 w-[3px] rounded-l bg-slate-700" />
            <div className="absolute -right-[15px] top-36 h-16 w-[3px] rounded-r bg-slate-700" />

            {/* Top Speaker & Dynamic Island / Camera Hole */}
            <div className="absolute left-1/2 top-3 z-30 -translate-x-1/2 flex items-center justify-center">
              {deviceModel === "iphone" ? (
                <div className="flex h-6 w-28 items-center justify-between rounded-full bg-black px-2 shadow-inner">
                  <div className="h-2 w-2 rounded-full bg-slate-900 ring-1 ring-slate-800" />
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
                    <span className="text-[9px] font-mono text-teal-400">LIVE</span>
                  </div>
                </div>
              ) : (
                <div className="h-3.5 w-3.5 rounded-full bg-black ring-1 ring-slate-800" />
              )}
            </div>

            {/* Phone Screen Glass Display */}
            <div className="h-full w-full overflow-hidden rounded-[40px] bg-slate-950">
              <AtmosFusionMobile
                initialPointId={activePointId}
                onPointChange={(id) => setActivePointId(id)}
              />
            </div>

            {/* Bottom Home Indicator Bar (iOS style) */}
            {deviceModel === "iphone" && (
              <div className="absolute bottom-2 left-1/2 z-30 h-1 w-32 -translate-x-1/2 rounded-full bg-slate-500/60" />
            )}
          </div>
        </div>

        {/* Right: The "Two Halves of AtmosFusion" Explanation */}
        {!fullscreen && (
          <div className="space-y-5">
            <Card
              title="The Two Halves of Weather Forecasting"
              description="Built for SIH26081 (NCMRWF / MoES)"
            >
              <div className="space-y-4 text-xs text-muted leading-relaxed">
                <div className="rounded-lg border border-accent/20 bg-accent/5 p-3.5">
                  <p className="font-semibold text-fg flex items-center gap-1.5 text-sm">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] text-white font-bold">1</span>
                    First Half: Scientific Portal (Desktop)
                  </p>
                  <p className="mt-1.5 text-fg/80">
                    Designed for <b>IMD duty meteorologists, NCMRWF scientists, and disaster administrators</b>.
                    Provides 13-model error matrices, Stage A inverse-variance weights, LightGBM Stage B feature ledgers, and CAP 1.2 XML exports.
                  </p>
                </div>

                <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 p-3.5">
                  <p className="font-semibold text-fg flex items-center gap-1.5 text-sm">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500 text-[10px] text-slate-950 font-bold">2</span>
                    Second Half: Citizen & Field POV (Mobile)
                  </p>
                  <p className="mt-1.5 text-fg/80">
                    Designed for <b>citizens, farmers, and municipal field teams</b> on their smartphones.
                    Converts complex probabilistic distributions into plain, life-saving advice without technical jargon.
                  </p>
                </div>
              </div>
            </Card>

            <Card title="Target User Personas on Mobile">
              <div className="space-y-3 text-xs">
                <div className="rounded-lg border border-line bg-surface p-3">
                  <p className="font-semibold text-fg flex items-center gap-1.5">
                    <User className="h-4 w-4 text-teal-400" />
                    1. Urban Commuter / Citizen (Pune & Mumbai)
                  </p>
                  <p className="mt-1 text-muted">
                    Clear answers: "Will it flood my commute?", "Do I need an umbrella?", "Is today's AQI safe for morning jogs in Pune?".
                  </p>
                </div>

                <div className="rounded-lg border border-line bg-surface p-3">
                  <p className="font-semibold text-fg flex items-center gap-1.5">
                    <Sprout className="h-4 w-4 text-amber-400" />
                    2. Agronomist & Farmer (Pune Plains / Western MH)
                  </p>
                  <p className="mt-1 text-muted">
                    Actionable advice: Topsoil moisture (0–1 cm), 5-day multi-model accumulation, safe pesticide spraying and sowing windows.
                  </p>
                </div>

                <div className="rounded-lg border border-line bg-surface p-3">
                  <p className="font-semibold text-fg flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-rose-400" />
                    3. Disaster Field Officer (Ghats & Coast)
                  </p>
                  <p className="mt-1 text-muted">
                    Catchment inflow risks for Khadakwasla & Mulshi dams, Arabian Sea swell heights for Mumbai coast, and 1-tap IMD radar nowcasts.
                  </p>
                </div>
              </div>
            </Card>

            <Card title="Direct Mobile Web Access">
              <p className="text-xs text-muted">
                This mobile experience is fully responsive. Open this URL on your phone or toggle Chrome DevTools device mode (Ctrl+Shift+M) to use it as a native web application:
              </p>
              <div className="mt-3 flex items-center justify-between rounded-lg bg-subtle px-3 py-2 text-xs font-mono text-fg">
                <span>http://localhost:5173/app/mobile</span>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

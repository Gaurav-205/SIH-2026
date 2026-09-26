import { useState } from "react";
import { ZoomIn, Sparkles, Eye } from "lucide-react";
import AtmosFusionMobile, { type MobileScreen } from "./AtmosFusionMobile";

interface MultiScreenPosterProps {
  onSelectScreen?: (screen: MobileScreen) => void;
}

export default function MultiScreenPoster({ onSelectScreen }: MultiScreenPosterProps) {
  const [hoveredScreen, setHoveredScreen] = useState<string | null>(null);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-[#eaf5ed] via-[#d6ebd9] to-[#c2e2c7] dark:from-[#091a13] dark:via-[#06140f] dark:to-[#040e0a] p-4 sm:p-8 shadow-2xl">
      {/* Background glowing blobs matching the ambient backdrop in reference image */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/10" />
      <div className="pointer-events-none absolute right-10 top-1/3 h-96 w-96 rounded-full bg-lime-300/25 blur-3xl dark:bg-lime-500/10" />
      <div className="pointer-events-none absolute bottom-10 left-1/3 h-96 w-96 rounded-full bg-teal-300/20 blur-3xl dark:bg-teal-500/10" />

      {/* Header Banner */}
      <div className="relative z-10 mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-emerald-900/10 dark:border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              AtmosFusion Complete 5-Screen Mobile Architecture
            </h2>
          </div>
          <p className="mt-1 text-xs text-gray-600 dark:text-emerald-200/70">
            Recreated with 100% fidelity to the user design reference. Click on any screen to open it in the full interactive simulator.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
          <Eye className="h-4 w-4" />
          <span>{hoveredScreen ? `Hovering: Screen ${hoveredScreen}` : "Interactive 5-Device Composition"}</span>
        </div>
      </div>

      {/* The 5 Screens arranged in the exact composition from the reference image */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start justify-items-center">
        {/* ======================================================== */}
        {/* LEFT COLUMN: Screen 1 (Home & Weather Hero)               */}
        {/* ======================================================== */}
        <div className="lg:col-span-4 flex flex-col items-center">
          <div className="mb-2 text-center">
            <span className="inline-block rounded-full bg-emerald-600/10 dark:bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
              1. Home & AI Suggestion
            </span>
          </div>

          <div
            onClick={() => onSelectScreen?.("home")}
            onMouseEnter={() => setHoveredScreen("home")}
            onMouseLeave={() => setHoveredScreen(null)}
            className="group relative cursor-pointer transition-all duration-300 hover:scale-[1.02]"
          >
            <div className="pointer-events-none absolute -inset-2 rounded-[48px] bg-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition duration-300" />
            {/* Outer Titanium Phone Bezel */}
            <div className="relative h-[720px] w-[340px] rounded-[44px] border-[8px] border-[#18261e] bg-[#071710] p-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              {/* Dynamic Island */}
              <div className="absolute left-1/2 top-2 z-40 h-5 w-24 -translate-x-1/2 rounded-full bg-black flex items-center justify-between px-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#111c16]" />
                <div className="h-2 w-2 rounded-full bg-[#0a1811]" />
              </div>
              <div className="h-full w-full overflow-hidden rounded-[36px]">
                <AtmosFusionMobile initialScreen="home" />
              </div>
            </div>
            <div className="absolute inset-0 rounded-[44px] bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center pointer-events-none">
              <span className="opacity-0 group-hover:opacity-100 transition rounded-full bg-emerald-500 text-black px-3 py-1.5 text-xs font-bold shadow-lg flex items-center gap-1.5">
                <ZoomIn className="h-3.5 w-3.5" /> Open in Simulator
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CENTER COLUMN: Screen 2 (Hub) & Screen 3 (Overview)      */}
        {/* ======================================================== */}
        <div className="lg:col-span-4 flex flex-col items-center gap-10">
          {/* Screen 2: My Cultivation Hub (Center Top) */}
          <div className="flex flex-col items-center">
            <div className="mb-2 text-center">
              <span className="inline-block rounded-full bg-emerald-600/10 dark:bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                2. My Cultivation Hub
              </span>
            </div>

            <div
              onClick={() => onSelectScreen?.("hub")}
              onMouseEnter={() => setHoveredScreen("hub")}
              onMouseLeave={() => setHoveredScreen(null)}
              className="group relative cursor-pointer transition-all duration-300 hover:scale-[1.02]"
            >
              <div className="pointer-events-none absolute -inset-2 rounded-[48px] bg-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition duration-300" />
              <div className="relative h-[560px] w-[340px] rounded-[44px] border-[8px] border-[#18261e] bg-[#071710] p-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                <div className="absolute left-1/2 top-2 z-40 h-5 w-24 -translate-x-1/2 rounded-full bg-black flex items-center justify-between px-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#111c16]" />
                  <div className="h-2 w-2 rounded-full bg-[#0a1811]" />
                </div>
                <div className="h-full w-full overflow-hidden rounded-[36px]">
                  <AtmosFusionMobile initialScreen="hub" />
                </div>
              </div>
              <div className="absolute inset-0 rounded-[44px] bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center pointer-events-none">
                <span className="opacity-0 group-hover:opacity-100 transition rounded-full bg-emerald-500 text-black px-3 py-1.5 text-xs font-bold shadow-lg flex items-center gap-1.5">
                  <ZoomIn className="h-3.5 w-3.5" /> Open in Simulator
                </span>
              </div>
            </div>
          </div>

          {/* Screen 3: Potato Crop Overview (Center Bottom) */}
          <div className="flex flex-col items-center">
            <div className="mb-2 text-center">
              <span className="inline-block rounded-full bg-emerald-600/10 dark:bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                3. Potato Crop Overview (326 Tonnes)
              </span>
            </div>

            <div
              onClick={() => onSelectScreen?.("overview")}
              onMouseEnter={() => setHoveredScreen("overview")}
              onMouseLeave={() => setHoveredScreen(null)}
              className="group relative cursor-pointer transition-all duration-300 hover:scale-[1.02]"
            >
              <div className="pointer-events-none absolute -inset-2 rounded-[48px] bg-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition duration-300" />
              <div className="relative h-[380px] w-[340px] rounded-[44px] border-[8px] border-[#18261e] bg-[#071710] p-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                <div className="absolute left-1/2 top-2 z-40 h-5 w-24 -translate-x-1/2 rounded-full bg-black flex items-center justify-between px-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#111c16]" />
                  <div className="h-2 w-2 rounded-full bg-[#0a1811]" />
                </div>
                <div className="h-full w-full overflow-hidden rounded-[36px]">
                  <AtmosFusionMobile initialScreen="overview" />
                </div>
              </div>
              <div className="absolute inset-0 rounded-[44px] bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center pointer-events-none">
                <span className="opacity-0 group-hover:opacity-100 transition rounded-full bg-emerald-500 text-black px-3 py-1.5 text-xs font-bold shadow-lg flex items-center gap-1.5">
                  <ZoomIn className="h-3.5 w-3.5" /> Open in Simulator
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: Screen 4 (Distribution) & Screen 5 (Land)  */}
        {/* ======================================================== */}
        <div className="lg:col-span-4 flex flex-col items-center gap-10">
          {/* Screen 4: Crop Distribution & Matrix (Right Top) */}
          <div className="flex flex-col items-center">
            <div className="mb-2 text-center">
              <span className="inline-block rounded-full bg-emerald-600/10 dark:bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                4. Crop Distribution & Matrix
              </span>
            </div>

            <div
              onClick={() => onSelectScreen?.("distribution")}
              onMouseEnter={() => setHoveredScreen("distribution")}
              onMouseLeave={() => setHoveredScreen(null)}
              className="group relative cursor-pointer transition-all duration-300 hover:scale-[1.02]"
            >
              <div className="pointer-events-none absolute -inset-2 rounded-[48px] bg-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition duration-300" />
              <div className="relative h-[340px] w-[340px] rounded-[44px] border-[8px] border-[#18261e] bg-[#071710] p-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                <div className="h-full w-full overflow-hidden rounded-[36px]">
                  <AtmosFusionMobile initialScreen="distribution" />
                </div>
              </div>
              <div className="absolute inset-0 rounded-[44px] bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center pointer-events-none">
                <span className="opacity-0 group-hover:opacity-100 transition rounded-full bg-emerald-500 text-black px-3 py-1.5 text-xs font-bold shadow-lg flex items-center gap-1.5">
                  <ZoomIn className="h-3.5 w-3.5" /> Open in Simulator
                </span>
              </div>
            </div>
          </div>

          {/* Screen 5: Total Farming Land 26 Ha. & Activities (Right Bottom) */}
          <div className="flex flex-col items-center">
            <div className="mb-2 text-center">
              <span className="inline-block rounded-full bg-emerald-600/10 dark:bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                5. Land (26 Ha.) & Activities
              </span>
            </div>

            <div
              onClick={() => onSelectScreen?.("activities")}
              onMouseEnter={() => setHoveredScreen("activities")}
              onMouseLeave={() => setHoveredScreen(null)}
              className="group relative cursor-pointer transition-all duration-300 hover:scale-[1.02]"
            >
              <div className="pointer-events-none absolute -inset-2 rounded-[48px] bg-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition duration-300" />
              <div className="relative h-[600px] w-[340px] rounded-[44px] border-[8px] border-[#18261e] bg-[#071710] p-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                <div className="absolute left-1/2 top-2 z-40 h-5 w-24 -translate-x-1/2 rounded-full bg-black flex items-center justify-between px-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#111c16]" />
                  <div className="h-2 w-2 rounded-full bg-[#0a1811]" />
                </div>
                <div className="h-full w-full overflow-hidden rounded-[36px]">
                  <AtmosFusionMobile initialScreen="activities" />
                </div>
              </div>
              <div className="absolute inset-0 rounded-[44px] bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center pointer-events-none">
                <span className="opacity-0 group-hover:opacity-100 transition rounded-full bg-emerald-500 text-black px-3 py-1.5 text-xs font-bold shadow-lg flex items-center gap-1.5">
                  <ZoomIn className="h-3.5 w-3.5" /> Open in Simulator
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

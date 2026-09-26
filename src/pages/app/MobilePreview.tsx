import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Smartphone,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import PhoneSimulator from "@/components/mobile/PhoneSimulator";
import AtmosFusionMobile from "@/components/mobile/AtmosFusionMobile";
import { PageHeader, Button, Card } from "@/components/ui";

export default function MobilePreview() {
  const [fullscreenMobile, setFullscreenMobile] = useState(false);

  if (fullscreenMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <AtmosFusionMobile onBackToDesk={() => setFullscreenMobile(false)} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="End-User Perspective: AtmosFusion Mobile"
        description="The 2nd half of the system: Translating 13-model physics, AI forecasts, and IMD verification into actionable field operations, catchment status, and citizen alerts."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFullscreenMobile(true)}
              className="hidden sm:inline-flex"
            >
              <Smartphone className="h-4 w-4" /> Fullscreen Phone
            </Button>
            <Link to="/app">
              <Button size="sm">
                Forecaster Desk <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-8 xl:grid-cols-[1fr_420px] items-start">
        {/* Left: The Interactive Phone Simulator */}
        <div className="flex justify-center rounded-2xl border border-line bg-gradient-to-b from-subtle/50 to-transparent py-4">
          <PhoneSimulator />
        </div>

        {/* Right: Architectural Explanation of "The Two Halves" */}
        <div className="space-y-6">
          <Card
            title="The Two Halves of Weather Intelligence"
            description="Closing the gap between atmospheric science and real-world ground decisions."
          >
            <div className="space-y-4">
              {/* Half 1 */}
              <div className="rounded-xl border border-line bg-subtle p-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-accent text-xs font-bold">
                    1
                  </span>
                  <h4 className="text-xs font-bold text-fg">First Half: Central Forecaster Operations</h4>
                </div>
                <p className="mt-1.5 text-xs text-muted leading-relaxed">
                  For NCMRWF & IMD meteorologists. Ingests 13 global numerical and AI forecasts (ECMWF, GFS, AIFS, GraphCast), computes decaying-average error against IMD gridded observations, and derives optimal consensus weights.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="rounded bg-canvas border border-line px-1.5 py-0.5 text-[10px] text-muted">13 Models</span>
                  <span className="rounded bg-canvas border border-line px-1.5 py-0.5 text-[10px] text-muted">Stage A Skill Ledger</span>
                  <span className="rounded bg-canvas border border-line px-1.5 py-0.5 text-[10px] text-muted">CAP 1.2 Protocol</span>
                </div>
              </div>

              {/* Half 2 */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500 text-black text-xs font-bold">
                    2
                  </span>
                  <h4 className="text-xs font-bold text-white">Second Half: Field Operations & Citizen POV (AtmosFusion Mobile)</h4>
                </div>
                <p className="mt-1.5 text-xs text-emerald-200/70 leading-relaxed">
                  For district officers, watershed managers, and citizens. Translates numerical millimeters and ensemble spreads into plain, actionable field directives in English and Marathi.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="rounded bg-emerald-900/40 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-300">Safe Work Window</span>
                  <span className="rounded bg-emerald-900/40 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-300">Catchment Telemetry</span>
                  <span className="rounded bg-emerald-900/40 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-300">मराठी Voice Audio</span>
                  <span className="rounded bg-emerald-900/40 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-300">Multi-Channel Dispatch</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Key Value Propositions */}
          <Card title="Key Field Intelligence Features" description="Powered directly by the live cycle API">
            <ul className="space-y-3 text-xs">
              <li className="flex gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />
                <div>
                  <strong className="text-fg">Multi-Model Consensus Window:</strong>
                  <p className="text-muted">Calculated from the 13-model blend. Pinpoints zero-washout periods for agricultural spraying, civil infrastructure, and outdoor transit.</p>
                </div>
              </li>
              <li className="flex gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />
                <div>
                  <strong className="text-fg">Catchment & Soil Saturation Index:</strong>
                  <p className="text-muted">Synthesizes 0–1 cm soil moisture telemetry and reservoir inflow forecasts to guide water management in Mulshi and Pune basins.</p>
                </div>
              </li>
              <li className="flex gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />
                <div>
                  <strong className="text-fg">Multi-Channel Broadcast Dispatch:</strong>
                  <p className="text-muted">Enables field officers to broadcast instant WhatsApp, SMS, and audio advisories in Marathi and English to 1,240 registered field units.</p>
                </div>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

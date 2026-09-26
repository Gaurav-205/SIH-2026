import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Smartphone,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import PhoneSimulator from "@/components/mobile/PhoneSimulator";
import KisanMobileApp from "@/components/mobile/KisanMobileApp";
import { PageHeader, Button, Card } from "@/components/ui";

export default function MobilePreview() {
  const [fullscreenMobile, setFullscreenMobile] = useState(false);

  if (fullscreenMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <KisanMobileApp onBackToDesk={() => setFullscreenMobile(false)} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="End-User Perspective: AtmosKisan Mobile App"
        description="The 2nd half of the system: Translating multi-model physics and AI into actionable field advisories for farmers in Pune and Maharashtra."
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
            description="Closing the gap between atmospheric science and real-world agricultural decisions."
          >
            <div className="space-y-4">
              {/* Half 1 */}
              <div className="rounded-xl border border-line bg-subtle p-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-accent text-xs font-bold">
                    1
                  </span>
                  <h4 className="text-xs font-bold text-fg">First Half: Forecaster Command Center</h4>
                </div>
                <p className="mt-1.5 text-xs text-muted leading-relaxed">
                  For NCMRWF & IMD meteorologists. Gathers 13 global forecasts (ECMWF, GFS, AIFS, GraphCast), computes decaying-average error against IMD gridded observations, and derives optimal inverse-error weights.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="rounded bg-canvas border border-line px-1.5 py-0.5 text-[10px] text-muted">13 Models</span>
                  <span className="rounded bg-canvas border border-line px-1.5 py-0.5 text-[10px] text-muted">Stage A Ledger</span>
                  <span className="rounded bg-canvas border border-line px-1.5 py-0.5 text-[10px] text-muted">CAP 1.2 Alerts</span>
                </div>
              </div>

              {/* Half 2 */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500 text-black text-xs font-bold">
                    2
                  </span>
                  <h4 className="text-xs font-bold text-white">Second Half: Citizen & Farmer POV (AtmosKisan)</h4>
                </div>
                <p className="mt-1.5 text-xs text-emerald-200/70 leading-relaxed">
                  For the end-user in the field. Translates numerical millimeters and uncertainty bands into clear, crop-specific dos and don'ts in plain English and Marathi.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="rounded bg-emerald-900/40 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-300">Safe Spray Window</span>
                  <span className="rounded bg-emerald-900/40 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-300">Irrigation Deferral</span>
                  <span className="rounded bg-emerald-900/40 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-300">मराठी Audio Advisory</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Key Value Propositions */}
          <Card title="Key Farmer Features" description="Powered directly by the live cycle API">
            <ul className="space-y-3 text-xs">
              <li className="flex gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />
                <div>
                  <strong className="text-fg">Zero-Washout Spray Window:</strong>
                  <p className="text-muted">Calculated from the model blend. Tells farmers whether sprayed pesticides will be wasted due to rain.</p>
                </div>
              </li>
              <li className="flex gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />
                <div>
                  <strong className="text-fg">Soil Moisture Saturation Index:</strong>
                  <p className="text-muted">Prevents over-irrigation during monsoon breaks and protects root health in sugarcane and grapes.</p>
                </div>
              </li>
              <li className="flex gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />
                <div>
                  <strong className="text-fg">Text-to-Speech Voice Readout:</strong>
                  <p className="text-muted">Enables accessible audio advisories for rural field workers in Marathi and Hindi.</p>
                </div>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

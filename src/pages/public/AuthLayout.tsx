import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/ui";

const points = [
  "Blends 12 live physics, ensemble and AI models by verified skill",
  "Keeps the cloudburst signal that flat averaging washes out",
  "District alerts against your threshold, exportable as CAP 1.2",
];

export default function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: ReactNode; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] bg-canvas lg:grid-cols-[1fr_minmax(420px,44%)]">
      <main id="main" className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/" className="self-start rounded-md" aria-label="Bharosa home">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-8 text-center text-sm text-muted">{footer}</div>
        </div>
        <p className="text-center text-xs text-muted">SIH26081 · NCMRWF, Ministry of Earth Sciences</p>
      </main>

      <aside className="relative hidden overflow-hidden border-l border-line bg-fg text-surface lg:flex lg:flex-col lg:justify-between lg:p-12" aria-hidden="true">
        <svg className="absolute inset-0 h-full w-full opacity-[0.12]" viewBox="0 0 400 400" preserveAspectRatio="none">
          {Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M-20 ${60 + i * 38} C 80 ${20 + i * 38}, 160 ${110 + i * 38}, 260 ${60 + i * 38} S 420 ${40 + i * 38}, 440 ${70 + i * 38}`} fill="none" stroke="currentColor" strokeWidth="1.5" />
          ))}
        </svg>
        <p className="relative text-sm font-medium opacity-80">Bharosa</p>
        <div className="relative">
          <p className="text-3xl font-semibold leading-tight tracking-tight">Twelve models disagree.<br />You get one forecast you can trust.</p>
          <ul className="mt-8 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex gap-3 text-sm opacity-90">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs opacity-70">Hybrid AI–NWP forecast blending</p>
      </aside>
    </div>
  );
}

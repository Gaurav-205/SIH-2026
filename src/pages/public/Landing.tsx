import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  Boxes,
  CheckCircle2,
  Gauge,
  Layers3,
  MapPinned,
  Scale,
  ShieldCheck,
  UserPlus,
  SlidersHorizontal,
} from "lucide-react";
import { Logo } from "@/components/ui";
import { buttonClass } from "@/lib/cx";
import { useSession } from "@/auth/session";
import { generateForecast, MODEL_OKABE_ITO } from "@/lib/blendEngine";
import { MODEL_LABELS } from "@/types/weather";

const features = [
  { icon: Scale, title: "Skill-weighted blending", body: "Each model is weighted by its recent error at each place, so the models that have been right lately count most." },
  { icon: MapPinned, title: "Station monitoring", body: "Pune weather stations with every model's forecast, the blended result and the flat average side by side." },
  { icon: Layers3, title: "Regional forecast in 3D", body: "Rain draped over Western Ghats terrain, with best case, most likely and worst case one click apart." },
  { icon: Boxes, title: "Trust map with reasons", body: "See which model led in every grid cell and why: recent bias, lead time, regime and agreement." },
  { icon: BellRing, title: "Alerts you can act on", body: "Station and district alerts against your own threshold, acknowledged per user and exported as CAP 1.2." },
  { icon: ShieldCheck, title: "Verification built in", body: "Error by lead day for every model and the blend, plus live physical-consistency checks." },
];

const steps = [
  { icon: UserPlus, title: "Create your account", body: "Sign up with your work email. Passwords are stored only as salted hashes." },
  { icon: SlidersHorizontal, title: "Set your region and thresholds", body: "Pick your home region, default lead day and the rainfall level that should raise an alert." },
  { icon: Gauge, title: "Monitor, decide, acknowledge", body: "Your dashboard opens on what needs attention. Review the evidence and acknowledge alerts." },
];

function HeroPreview() {
  const lavasa = useMemo(() => generateForecast(1).stations.find((s) => s.id === "pune-lavasa")!, []);
  const max = 200;
  const bars = [
    { label: "Flat average", value: lavasa.simple_average, className: "bg-muted/40" },
    { label: "AtmosFusion blend", value: lavasa.consensus_blend, className: "bg-accent" },
    { label: "Observed", value: lavasa.observed_rain_24h, className: "bg-fg/80" },
  ];
  const weights = Object.entries(lavasa.assigned_weights).sort(([, a], [, b]) => b - a).slice(0, 4);
  return (
    <div className="card relative overflow-hidden p-6 shadow-pop">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Station · Day 1</p>
          <p className="mt-1 font-semibold text-fg">Lavasa / Temghar Ghat</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-danger/20 bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">Red alert</span>
      </div>
      <div className="mt-6 space-y-3">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="flex justify-between text-xs">
              <span className="text-muted">{b.label}</span>
              <span className="num font-semibold text-fg">{b.value} mm</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-subtle">
              <div className={`h-2 rounded-full ${b.className}`} style={{ width: `${(b.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 border-t border-line pt-4">
        <p className="text-xs font-medium text-muted">Who we trusted here</p>
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {weights.map(([k, w]) => (
            <li key={k} className="flex items-center gap-2 text-xs text-fg">
              <span className="h-2 w-2 rounded-full" style={{ background: MODEL_OKABE_ITO[k] }} />
              <span className="truncate">{MODEL_LABELS[k]}</span>
              <span className="num ml-auto text-muted">{Math.round(w * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-xs text-muted">
        The flat average misses by {Math.round((lavasa.observed_rain_24h - lavasa.simple_average) * 10) / 10} mm; the blend by{" "}
        {Math.round(Math.abs(lavasa.observed_rain_24h - lavasa.consensus_blend) * 10) / 10} mm.
      </p>
    </div>
  );
}

export default function Landing() {
  const startDemo = useSession((s) => s.startDemo);
  const user = useSession((s) => s.user);
  const navigate = useNavigate();
  const demo = () => {
    if (!user) startDemo();
    navigate("/app");
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6" aria-label="Main">
          <Link to="/" className="rounded-md">
            <Logo />
          </Link>
          <ul className="hidden items-center gap-6 text-sm text-muted md:flex">
            <li><a href="#features" className="hover:text-fg">Features</a></li>
            <li><a href="#how" className="hover:text-fg">How it works</a></li>
            <li><a href="#get-started" className="hover:text-fg">Get started</a></li>
          </ul>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Link to="/app" className={buttonClass("primary", "sm")}>Open dashboard</Link>
            ) : (
              <>
                <Link to="/login" className={buttonClass("ghost", "sm")}>Log in</Link>
                <Link to="/signup" className={buttonClass("primary", "sm")}>Get started</Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              SIH26081 · NCMRWF, Ministry of Earth Sciences
            </p>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-fg sm:text-5xl">
              Six weather models.
              <br />
              <span className="text-accent">One forecast you can trust.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              AtmosFusion scores every physics and AI model against what actually fell, then blends them place by place, so the
              cloudburst one model catches isn't averaged away.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" className={buttonClass("primary", "lg")}>
                Create free account <ArrowRight className="h-4 w-4" />
              </Link>
              <button type="button" onClick={demo} className={buttonClass("secondary", "lg")}>
                Explore the demo
              </button>
            </div>
            <p className="mt-4 text-sm text-muted">The demo runs entirely in your browser. No sign-up needed.</p>
          </div>
          <HeroPreview />
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-16 border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="text-sm font-semibold text-accent">Features</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-fg">Everything a duty forecaster needs for one cycle</h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-xl border border-line p-6">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent-soft text-accent">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-semibold text-fg">{title}</h3>
                  <p className="mt-2 text-sm text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How the blend works */}
        <section id="how" className="scroll-mt-16 border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-accent">How it works</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-fg">A referee, not a fifth opinion</h2>
              <p className="mt-4 text-muted">
                A flat average gives every model the same vote. Over the Ghats that erases the extremes that matter most. AtmosFusion
                weights each model by the inverse square of its recent error, so trust follows performance.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-fg">
                {[
                  "Weights are never negative and always add up to one",
                  "P10 ≤ P50 ≤ P90 from a single fitted distribution",
                  "Chance of 64.5, 115.6 and 204.5 mm stays correctly ordered",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-ok" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">The blend, in one line</p>
              <p className="mt-4 rounded-lg bg-subtle px-4 py-5 text-center font-mono text-sm text-fg">
                w<sub>m</sub> = (MAE<sub>m</sub> + ε)<sup>−2</sup> / Σ<sub>k</sub> (MAE<sub>k</sub> + ε)<sup>−2</sup>
              </p>
              <p className="mt-3 rounded-lg bg-subtle px-4 py-5 text-center font-mono text-sm text-fg">
                blend = Σ<sub>m</sub> w<sub>m</sub> × forecast<sub>m</sub>
              </p>
              <p className="mt-4 text-sm text-muted">
                MAE is each model's mean absolute error over the last 48 hours at that station; ε = 0.1 mm keeps the weights stable.
              </p>
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section id="get-started" className="scroll-mt-16 border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="text-sm font-semibold text-accent">Get started</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-fg">From sign-up to your first decision in three steps</h2>
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {steps.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="relative rounded-xl border border-line p-6">
                  <span className="num absolute right-6 top-6 text-sm font-semibold text-muted/50">0{i + 1}</span>
                  <Icon className="h-5 w-5 text-accent" />
                  <h3 className="mt-4 font-semibold text-fg">{title}</h3>
                  <p className="mt-2 text-sm text-muted">{body}</p>
                </li>
              ))}
            </ol>
            <div className="mt-12 flex flex-col items-start justify-between gap-6 rounded-2xl bg-accent px-8 py-10 sm:flex-row sm:items-center">
              <div>
                <p className="text-2xl font-semibold tracking-tight text-white">Ready for tonight's cycle?</p>
                <p className="mt-1 text-white/80">Create an account, or look around the demo first.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/signup" className="inline-flex h-11 items-center rounded-lg bg-white px-5 text-sm font-medium text-accent hover:bg-white/90">
                  Create account
                </Link>
                <button type="button" onClick={demo} className="inline-flex h-11 items-center rounded-lg border border-white/40 px-5 text-sm font-medium text-white hover:bg-white/10">
                  Explore the demo
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <p>Built for Smart India Hackathon, problem SIH26081. Regional grid and station inputs are sample data.</p>
        </div>
      </footer>
    </div>
  );
}

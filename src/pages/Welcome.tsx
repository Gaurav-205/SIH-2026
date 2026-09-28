import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button, Logo, Segmented } from "@/components/ui";
import { cx } from "@/lib/cx";
import { firstName, ROLE_LABELS, useSession, type Role, type Threshold } from "@/auth/session";
import { REGIONS, type RegionId } from "@/data/regions";

const ROLE_HELP: Record<Role, string> = {
  forecaster: "Issue bulletins and need the blend, its range and the reasons.",
  disaster_manager: "Need district risk, upper estimates and alerts to act on.",
  researcher: "Study model skill, disagreement and verification.",
  other: "Exploring how multi-model blending works.",
};

const REGION_HELP: Record<RegionId, string> = {
  konkan: "Coast, Western Ghats crest and Deccan plateau — includes the Pune ghats.",
  kerala: "Southern Ghats and the Kerala coast, from Kasaragod to Thiruvananthapuram.",
};

const THRESHOLDS: { mm: Threshold; label: string; help: string }[] = [
  { mm: 64.5, label: "Heavy", help: "64.5 mm/day or more. Most alerts, earliest warning." },
  { mm: 115.6, label: "Very heavy", help: "115.6 mm/day or more. Recommended for most teams." },
  { mm: 204.5, label: "Extremely heavy", help: "204.5 mm/day or more. Only the most severe events." },
];

function Choice({ selected, onClick, title, body }: { selected: boolean; onClick: () => void; title: string; body: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all",
        selected ? "border-fg bg-subtle shadow-sm" : "border-line bg-surface hover:border-fg/40"
      )}
    >
      <span className={cx("mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full border", selected ? "border-fg bg-fg text-surface" : "border-line")}>
        {selected && <Check className="h-3 w-3" />}
      </span>
      <span>
        <span className="block text-sm font-semibold text-fg">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{body}</span>
      </span>
    </button>
  );
}

function Step({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
      <p className="mt-2 text-sm text-muted">{description}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

export default function Welcome() {
  const user = useSession((s) => s.user)!;
  const updatePreferences = useSession((s) => s.updatePreferences);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role>(user.role);
  const [region, setRegion] = useState<RegionId>(user.home_region);
  const [threshold, setThreshold] = useState<Threshold>(user.alert_threshold);
  const [lead, setLead] = useState(user.lead_day);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await updatePreferences({ role, home_region: region, alert_threshold: threshold, lead_day: lead, onboarded: true });
      navigate("/app", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your preferences");
    } finally {
      setBusy(false);
    }
  };

  const steps = [
    <Step key="role" title={`Welcome, ${firstName(user)}. What's your role?`} description="We'll tailor what your dashboard shows first. You can change this later in Settings.">
      <div role="radiogroup" aria-label="Role" className="space-y-3">
        {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
          <Choice key={r} selected={role === r} onClick={() => setRole(r)} title={ROLE_LABELS[r]} body={ROLE_HELP[r]} />
        ))}
      </div>
    </Step>,
    <Step key="region" title="Choose your home region" description="Your dashboard opens on this region; you can switch regions any time.">
      <div role="radiogroup" aria-label="Home region" className="space-y-3">
        {(Object.keys(REGIONS) as RegionId[]).map((r) => (
          <Choice key={r} selected={region === r} onClick={() => setRegion(r)} title={REGIONS[r].name} body={REGION_HELP[r]} />
        ))}
      </div>
    </Step>,
    <Step key="alerts" title="When should we alert you?" description="Districts with at least an even chance of crossing this rainfall level are flagged.">
      <div role="radiogroup" aria-label="Alert threshold" className="space-y-3">
        {THRESHOLDS.map((t) => (
          <Choice key={t.mm} selected={threshold === t.mm} onClick={() => setThreshold(t.mm)} title={t.label} body={t.help} />
        ))}
      </div>
      <div className="mt-8">
        <p className="text-sm font-medium text-fg">Default forecast lead day</p>
        <p className="mb-3 mt-0.5 text-sm text-muted">Day 1 is tomorrow; later days carry more uncertainty.</p>
        <Segmented label="Default lead day" value={lead} onChange={setLead} options={[1, 2, 3, 4, 5].map((d) => ({ value: d, label: `Day ${d}` }))} />
      </div>
    </Step>,
  ];

  const last = step === steps.length - 1;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo />
        <p className="num text-sm text-muted">
          Step {step + 1} of {steps.length}
        </p>
      </header>
      <div className="h-1 bg-line" aria-hidden="true">
        <div className="h-1 bg-fg transition-all duration-300" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>

      <main id="main" className="mx-auto w-full max-w-lg flex-1 px-6 py-12">
        {steps[step]}
        {error && (
          <div role="alert" className="mt-6 flex gap-2 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}
        <div className="mt-10 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {last ? (
            <Button onClick={finish} loading={busy}>
              Go to dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

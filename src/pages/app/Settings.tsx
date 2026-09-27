import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Monitor, Moon, Sun } from "lucide-react";
import { Button, Card, Field, PageHeader, Segmented, Select } from "@/components/ui";
import { cx } from "@/lib/cx";
import { ROLE_LABELS, useSession, type Role, type Theme, type Threshold } from "@/auth/session";
import { REGIONS, type RegionId } from "@/data/regions";

type Status = { kind: "ok" | "error"; text: string } | null;

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  const ok = status.kind === "ok";
  return (
    <p role={ok ? "status" : "alert"} className={cx("flex items-center gap-1.5 text-sm", ok ? "text-ok" : "text-danger")}>
      {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      {status.text}
    </p>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="grid gap-6 border-b border-line py-8 first:pt-0 last:border-0 lg:grid-cols-[18rem_1fr]">
      <div>
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <div className="max-w-xl">{children}</div>
    </div>
  );
}

const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

function ProfileForm() {
  const user = useSession((s) => s.user)!;
  const update = useSession((s) => s.updatePreferences);
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<Role>(user.role);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const dirty = name.trim() !== user.name || role !== user.role;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setStatus({ kind: "error", text: "Name is required" });
    setBusy(true);
    setStatus(null);
    try {
      await update({ name: name.trim(), role });
      setStatus({ kind: "ok", text: "Profile saved" });
    } catch (err) {
      setStatus({ kind: "error", text: errText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      <Field label="Email" value={user.email} disabled hint="Your sign-in email can't be changed." />
      <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)} options={(Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
      <div className="flex items-center gap-4">
        <Button type="submit" loading={busy} disabled={!dirty}>Save profile</Button>
        <StatusLine status={status} />
      </div>
    </form>
  );
}

function PreferencesForm() {
  const user = useSession((s) => s.user)!;
  const update = useSession((s) => s.updatePreferences);
  const [region, setRegion] = useState<RegionId>(user.home_region);
  const [lead, setLead] = useState(user.lead_day);
  const [threshold, setThreshold] = useState<Threshold>(user.alert_threshold);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const dirty = region !== user.home_region || lead !== user.lead_day || threshold !== user.alert_threshold;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await update({ home_region: region, lead_day: lead, alert_threshold: threshold });
      setStatus({ kind: "ok", text: "Preferences saved" });
    } catch (err) {
      setStatus({ kind: "error", text: errText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-5">
      <Select label="Home region" value={region} onChange={(e) => setRegion(e.target.value as RegionId)} options={Object.values(REGIONS).map((r) => ({ value: r.id, label: r.name }))} />
      <div>
        <p className="mb-1.5 text-sm font-medium text-fg">Default lead day</p>
        <Segmented label="Default lead day" value={lead} onChange={setLead} options={[1, 2, 3, 4, 5].map((d) => ({ value: d, label: `Day ${d}` }))} />
      </div>
      <Select
        label="District alert threshold"
        value={threshold}
        onChange={(e) => setThreshold(Number(e.target.value) as Threshold)}
        options={[
          { value: 64.5, label: "Heavy — 64.5 mm/day or more" },
          { value: 115.6, label: "Very heavy — 115.6 mm/day or more" },
          { value: 204.5, label: "Extremely heavy — 204.5 mm/day or more" },
        ]}
      />
      <div className="flex items-center gap-4">
        <Button type="submit" loading={busy} disabled={!dirty}>Save preferences</Button>
        <StatusLine status={status} />
      </div>
    </form>
  );
}

function AppearanceForm() {
  const theme = useSession((s) => s.user!.theme);
  const update = useSession((s) => s.updatePreferences);
  const [status, setStatus] = useState<Status>(null);
  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
        {options.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            onClick={async () => {
              setStatus(null);
              try {
                await update({ theme: value });
              } catch (err) {
                setStatus({ kind: "error", text: errText(err) });
              }
            }}
            className={cx(
              "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all",
              theme === value ? "border-fg bg-subtle text-fg shadow-sm" : "border-line text-muted hover:text-fg hover:border-fg/40"
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>
      <StatusLine status={status} />
    </div>
  );
}

function PasswordForm() {
  const changePassword = useSession((s) => s.changePassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const mismatch = confirm.length > 0 && next !== confirm;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setStatus({ kind: "error", text: "New password needs at least 8 characters" });
    if (next !== confirm) return setStatus({ kind: "error", text: "New passwords don't match" });
    setBusy(true);
    setStatus(null);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setStatus({ kind: "ok", text: "Password changed" });
    } catch (err) {
      setStatus({ kind: "error", text: errText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      <Field label="New password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} hint="At least 8 characters." />
      <Field label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={mismatch ? "Passwords don't match" : null} />
      <div className="flex items-center gap-4">
        <Button type="submit" loading={busy} disabled={!current || !next || !confirm}>Change password</Button>
        <StatusLine status={status} />
      </div>
    </form>
  );
}

function DangerZone() {
  const mode = useSession((s) => s.mode);
  const deleteAccount = useSession((s) => s.deleteAccount);
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const remove = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await deleteAccount(password);
      navigate("/logout", { replace: true });
    } catch (err) {
      setStatus({ kind: "error", text: errText(err) });
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4">
        <div>
          <p className="text-sm font-medium text-fg">{mode === "demo" ? "Leave the demo" : "Sign out"}</p>
          <p className="text-sm text-muted">{mode === "demo" ? "Return to the home page." : "End this session on this device."}</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => navigate("/logout", { replace: true })}
        >
          {mode === "demo" ? "Leave demo" : "Sign out"}
        </Button>
      </div>
      {mode === "account" && (
        <div className="rounded-xl border border-danger/30 p-4">
          <p className="text-sm font-medium text-fg">Delete account</p>
          <p className="text-sm text-muted">Permanently removes your account, preferences and alert acknowledgements. This can't be undone.</p>
          {!confirming ? (
            <Button variant="danger" size="sm" className="mt-3" onClick={() => setConfirming(true)}>Delete account…</Button>
          ) : (
            <form onSubmit={remove} className="mt-3 space-y-3">
              <Field label="Confirm with your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <div className="flex items-center gap-3">
                <Button type="submit" variant="danger" size="sm" loading={busy} disabled={!password}>Delete permanently</Button>
                <Button variant="ghost" size="sm" onClick={() => { setConfirming(false); setPassword(""); setStatus(null); }}>Cancel</Button>
              </div>
              <StatusLine status={status} />
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const mode = useSession((s) => s.mode);
  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" description={mode === "demo" ? "Demo settings are kept in this browser only." : "Changes are saved to your account."} />
      <Card bodyClassName="p-6 sm:p-8">
        <Section title="Profile" description="How you appear in Bharosa.">
          <ProfileForm />
        </Section>
        <Section title="Forecast preferences" description="Your dashboard opens on these, and alerts use your threshold.">
          <PreferencesForm />
        </Section>
        <Section title="Appearance" description="Light, dark, or follow your system setting.">
          <AppearanceForm />
        </Section>
        {mode === "account" && (
          <Section title="Password" description="Use at least 8 characters. You'll stay signed in on this device.">
            <PasswordForm />
          </Section>
        )}
        <Section title={mode === "account" ? "Session and account" : "Session"} description="Sign out, or remove your account entirely.">
          <DangerZone />
        </Section>
      </Card>
    </div>
  );
}

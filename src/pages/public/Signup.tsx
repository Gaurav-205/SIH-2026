import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Check } from "lucide-react";
import { Button, Field } from "@/components/ui";
import { cx } from "@/lib/cx";
import { useSession } from "@/auth/session";
import { ApiError } from "@/lib/api";
import AuthLayout from "./AuthLayout";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function passwordChecks(pw: string) {
  return [
    { ok: pw.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Za-z]/.test(pw) && /\d/.test(pw), label: "Letters and numbers" },
  ];
}

export default function Signup() {
  const signup = useSession((s) => s.signup);
  const startDemo = useSession((s) => s.startDemo);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);

  const checks = passwordChecks(password);
  const errors = {
    name: !name.trim() ? "Enter your name" : null,
    email: !EMAIL_RE.test(email.trim()) ? "Enter a valid email address" : null,
    password: password.length < 8 ? "Use at least 8 characters" : null,
  };
  const valid = !errors.name && !errors.email && !errors.password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true });
    if (!valid) return;
    setError(null);
    setBusy(true);
    try {
      await signup(name.trim(), email.trim(), password);
      navigate("/welcome", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
      setOffline(err instanceof ApiError && err.status === 0);
    } finally {
      setBusy(false);
    }
  };

  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up your forecasting workspace in under a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && (
          <div role="alert" className="flex gap-2 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              {error}
              {offline && (
                <>
                  {" "}
                  <button
                    type="button"
                    className="font-medium underline"
                    onClick={() => {
                      startDemo();
                      navigate("/app", { replace: true });
                    }}
                  >
                    Explore the demo
                  </button>
                </>
              )}
            </span>
          </div>
        )}
        <Field label="Full name" name="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} onBlur={blur("name")} error={touched.name ? errors.name : null} autoFocus />
        <Field label="Work email" type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} onBlur={blur("email")} error={touched.email ? errors.email : null} placeholder="you@example.com" />
        <div>
          <Field label="Password" type="password" name="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} onBlur={blur("password")} error={touched.password ? errors.password : null} />
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1" aria-label="Password requirements">
            {checks.map((c) => (
              <li key={c.label} className={cx("flex items-center gap-1 text-xs", c.ok ? "text-ok" : "text-muted")}>
                <Check className={cx("h-3.5 w-3.5", !c.ok && "opacity-40")} aria-hidden="true" />
                {c.label}
              </li>
            ))}
          </ul>
        </div>
        <Button type="submit" className="w-full" loading={busy}>
          Create account
        </Button>
        <p className="text-center text-xs text-muted">Your password is stored only as a salted hash.</p>
      </form>
    </AuthLayout>
  );
}

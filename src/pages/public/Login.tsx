import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { Button, Field } from "@/components/ui";
import { useSession } from "@/auth/session";
import { ApiError } from "@/lib/api";
import AuthLayout from "./AuthLayout";

/** Only allow in-app redirects after login (never an external URL from the query string). */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

export default function Login() {
  const login = useSession((s) => s.login);
  const startDemo = useSession((s) => s.startDemo);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login(email, password);
      navigate(user.onboarded ? safeNext(params.get("next")) : "/welcome", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setOffline(err instanceof ApiError && err.status === 0);
    } finally {
      setBusy(false);
    }
  };

  const demo = () => {
    startDemo();
    navigate(safeNext(params.get("next")), { replace: true });
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to your Bharosa workspace."
      footer={
        <>
          New to Bharosa?{" "}
          <Link to="/signup" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && (
          <div role="alert" className="flex gap-2 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <Field label="Email" type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
        <Field label="Password" type="password" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" className="w-full" loading={busy} disabled={!email || !password}>
          Log in
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <Button variant={offline ? "primary" : "secondary"} className="w-full" onClick={demo}>
        Explore the demo
      </Button>
      <p className="mt-2 text-center text-xs text-muted">No account needed. Settings are kept in this browser.</p>
    </AuthLayout>
  );
}

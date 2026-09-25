import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useSession } from "./session";

/** Only signed-in users (account or demo); others go to /login and come back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useSession((s) => s.user);
  const loc = useLocation();
  if (!user) {
    const next = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}

/** New accounts finish onboarding before reaching the dashboard. */
export function RequireOnboarded({ children }: { children: ReactNode }) {
  const onboarded = useSession((s) => s.user?.onboarded);
  if (!onboarded) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

/** Login / sign-up pages send already-signed-in users straight to the app. */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const user = useSession((s) => s.user);
  if (user) return <Navigate to={user.onboarded ? "/app" : "/welcome"} replace />;
  return <>{children}</>;
}

/** Keeps the `dark` class on <html> in sync with the user's theme preference. */
export function ThemeSync() {
  const theme = useSession((s) => s.user?.theme ?? "light");
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  return null;
}

/** On load, re-validate a stored account session (expired tokens sign the user out). */
export function SessionRefresh() {
  const refresh = useSession((s) => s.refresh);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return null;
}

/**
 * /logout: clears the session *after* leaving the protected page, so the auth guard
 * doesn't bounce the user to /login on the way out. ?to=/signup is the only other destination.
 */
export function SignOut() {
  const user = useSession((s) => s.user);
  const logout = useSession((s) => s.logout);
  const [params] = useSearchParams();
  const to = params.get("to") === "/signup" ? "/signup" : "/";
  useEffect(() => {
    logout();
  }, [logout]);
  // Redirect only once the session is gone, so /signup doesn't bounce a still-signed-in user
  return user ? null : <Navigate to={to} replace />;
}

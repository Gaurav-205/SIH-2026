import { useEffect, type ReactNode } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useSession } from "./session";

/** Automatically populates session so user enters app directly without login barrier. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useSession((s) => s.user);
  const startDemo = useSession((s) => s.startDemo);
  useEffect(() => {
    if (!user) {
      startDemo();
    }
  }, [user, startDemo]);
  return <>{children}</>;
}

/** New accounts finish onboarding or pass through directly. */
export function RequireOnboarded({ children }: { children: ReactNode }) {
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

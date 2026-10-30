import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { Activity, Bell, ChartNoAxesCombined, CloudRain, Compass, Home, LogIn, LogOut, Menu, Settings, ShieldCheck, UserPlus, X } from "lucide-react";
import { Logo, Segmented, Spinner } from "@/components/ui";
import { useSession } from "@/auth/session";
import { useView, LEADS } from "@/data/state";
import { REGIONS, type RegionId } from "@/data/regions";
import { useCycle } from "@/data/cycle";
import Freshness from "@/features/forecast/Freshness";
import { cx } from "@/lib/cx";

const PRIMARY = [
  { to: "/app", label: "Briefing", icon: Home, end: true },
  { to: "/app/districts", label: "Explore", icon: Compass, end: false },
  { to: "/app/forecast", label: "Forecast", icon: CloudRain, end: false },
  { to: "/app/alerts", label: "Alerts", icon: Bell, end: false },
];
const EVIDENCE = [
  { to: "/app/models", label: "Model insights", icon: ChartNoAxesCombined, end: false },
  { to: "/app/verification", label: "Verification", icon: ShieldCheck, end: false },
];

function Navigation({ close }: { close: () => void }) {
  const { query } = useView();
  const user = useSession((s) => s.user);
  const mode = useSession((s) => s.mode);
  const withView = (to: string) => (query ? `${to}?${query}` : to);
  return (
    <div className="flex h-full flex-col">
      <Link to="/app" className="px-6 pb-6 pt-7" onClick={close}>
        <Logo />
        <span className="mt-2 block text-[10px] uppercase tracking-[.2em] text-muted">Rainfall intelligence</span>
      </Link>
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3">
        <p className="nav-group">YOUR OUTLOOK</p>
        {PRIMARY.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={withView(to)} end={end} onClick={close} className={({ isActive }) => cx("side-link", isActive && "active")}>
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
        <p className="nav-group mt-7">THE EVIDENCE</p>
        {EVIDENCE.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={withView(to)} onClick={close} className={({ isActive }) => cx("side-link", isActive && "active")}>
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
        <p className="nav-group mt-7">ACCOUNT</p>
        <NavLink to="/app/settings" onClick={close} className={({ isActive }) => cx("side-link", isActive && "active")}>
          <Settings size={18} aria-hidden="true" />
          Preferences
        </NavLink>
        {mode === "account" && user?.is_admin && (
          <Link to="/admin" onClick={close} className="side-link">
            <Activity size={18} aria-hidden="true" />
            Operations
          </Link>
        )}
      </nav>
      <div className="mx-4 mb-4 rounded-xl border border-line bg-canvas p-4">
        <p className="text-xs font-semibold">Built on evidence.</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">Multiple forecast models. IMD verification. Uncertainty made visible.</p>
        <Link to="/" onClick={close} className="link mt-2.5 inline-block text-xs">
          About Bharosa →
        </Link>
      </div>
      <div className="border-t border-line px-5 py-4">
        <p className="truncate text-sm font-medium">{mode === "demo" ? "Exploring as a guest" : user?.name}</p>
        <div className="mt-2 flex gap-4 text-xs text-muted">
          {mode === "demo" ? (
            <>
              <Link to="/login" onClick={close} className="flex items-center gap-1 hover:text-fg">
                <LogIn size={13} aria-hidden="true" />
                Log in
              </Link>
              <Link to="/signup" onClick={close} className="flex items-center gap-1 hover:text-fg">
                <UserPlus size={13} aria-hidden="true" />
                Create account
              </Link>
            </>
          ) : (
            <Link to="/logout" onClick={close} className="flex items-center gap-1 hover:text-fg">
              <LogOut size={13} aria-hidden="true" />
              Sign out
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UserLayout() {
  const dialog = useRef<HTMLDialogElement>(null);
  const loc = useLocation();
  const [params, setParams] = useSearchParams();
  const { region, lead, set, query } = useView();
  const { data: cycle } = useCycle();
  const title = [...PRIMARY, ...EVIDENCE].find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)))?.label ?? "Preferences";
  // Settings and Verification are not tied to a region/day; the Briefing has its own day strip.
  const showRegion = !/settings|verification/.test(loc.pathname);
  const showLead = showRegion && loc.pathname !== "/app";
  useEffect(() => {
    document.title = `${title} · Bharosa`;
  }, [title]);
  const close = () => dialog.current?.close();
  const withView = (to: string) => (query ? `${to}?${query}` : to);
  return (
    <div className="flex min-h-[100dvh] bg-canvas">
      <a href="#app-main" className="skip-link">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 border-r border-line bg-surface lg:block">
        <Navigation close={close} />
      </aside>
      <dialog ref={dialog} className="nav-dialog" aria-label="Navigation">
        <button type="button" aria-label="Close navigation" className="absolute right-3 top-4 rounded-lg p-3 text-muted" onClick={close}>
          <X size={20} />
        </button>
        <Navigation close={close} />
      </dialog>
      <div className="min-w-0 flex-1">
        <header className="app-header">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" aria-label="Open navigation" className="-ml-2 rounded-lg p-3 text-muted lg:hidden" onClick={() => dialog.current?.showModal()}>
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{title}</p>
              <div className="hidden sm:block">
                <Freshness cycle={cycle} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {showLead && (
              <Segmented label="Forecast day" size="sm" value={lead} onChange={(v) => set({ lead: v })} options={LEADS.map((d) => ({ value: d, label: `Day ${d}` }))} />
            )}
            {showRegion && (
              <select aria-label="Region" className="region-select" value={region} onChange={(e) => set({ region: e.target.value as RegionId })}>
                {Object.values(REGIONS).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </header>
        {params.get("issue") && (
          <div className="flex flex-wrap items-center justify-center gap-3 border-b border-warn/20 bg-warn-soft px-4 py-3 text-xs text-warn">
            <span>Viewing an archived forecast publication.</span>
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => {
                const next = new URLSearchParams(params);
                next.delete("issue");
                setParams(next);
              }}
            >
              Return to latest
            </button>
          </div>
        )}
        <main id="app-main" tabIndex={-1} className="app-content">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
        <nav className="bottom-nav" aria-label="Mobile navigation">
          {PRIMARY.map(({ to, end, label, icon: Icon }) => (
            <NavLink key={to} to={withView(to)} end={end} className={({ isActive }) => cx("bottom-link", isActive && "active")}>
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function PageLoading() {
  return <Spinner label="Loading page" />;
}

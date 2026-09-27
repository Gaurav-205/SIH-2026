import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  CloudRain,
  LayoutDashboard,
  LogOut,
  MapPin,
  MapPinned,
  Menu,
  Network,
  Settings,
  WifiOff,
  X,
} from "lucide-react";
import { Logo, Segmented, Spinner } from "@/components/ui";
import { cx } from "@/lib/cx";
import { ROLE_LABELS, useSession } from "@/auth/session";
import { useAlerts } from "@/data/alerts";
import { fmtRunTime, useCycle } from "@/data/cycle";
import { REGIONS, type RegionId } from "@/data/regions";
import { LEADS, useView } from "@/data/state";

const NAV = [
  { to: "/app", end: true, label: "Overview", icon: LayoutDashboard },
  { to: "/app/districts", label: "Districts", icon: MapPinned },
  { to: "/app/forecast", label: "Forecast", icon: CloudRain },
  { to: "/app/models", label: "Models", icon: Network },
  { to: "/app/alerts", label: "Alerts", icon: Bell, badge: true },
  { to: "/app/verification", label: "Verification", icon: CheckCircle2 },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

const DEFAULT_TITLE = "Bharosa — multi-model forecast blending";

/** Which view controls each page uses. */
function controlsFor(path: string) {
  if (path.startsWith("/app/settings") || path.startsWith("/app/verification")) return { region: false, lead: false };
  return { region: true, lead: true };
}

function Initials({ name }: { name: string }) {
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-subtle text-xs font-semibold text-fg border border-line">{initials}</span>;
}

function UserMenu({ onNavigate }: { onNavigate: () => void }) {
  const user = useSession((s) => s.user)!;
  const mode = useSession((s) => s.mode);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const signOut = () => {
    navigate("/logout", { replace: true });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-subtle"
      >
        <Initials name={user.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">{user.name}</span>
          <span className="block truncate text-xs text-muted">{mode === "demo" ? "Demo session" : ROLE_LABELS[user.role]}</span>
        </span>
        <ChevronDown className={cx("h-4 w-4 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="menu" className="absolute bottom-full left-0 right-0 mb-2 animate-fade-in rounded-xl border border-line bg-surface p-1 shadow-pop">
          <p className="truncate px-3 py-2 text-xs text-muted">{user.email}</p>
          <Link
            role="menuitem"
            to="/app/settings"
            onClick={() => {
              setOpen(false);
              onNavigate();
            }}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-fg hover:bg-subtle"
          >
            <Settings className="h-4 w-4 text-muted" /> Settings
          </Link>
          <button role="menuitem" type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-fg hover:bg-subtle">
            <LogOut className="h-4 w-4" /> {mode === "demo" ? "Leave demo" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const { query } = useView();
  const { open } = useAlerts();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line/60">
        <Link to="/app" onClick={onNavigate} className="rounded-md">
          <Logo />
        </Link>
        <span className="rounded border border-line bg-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
          v1.0 Live
        </span>
      </div>
      <nav aria-label="App" className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {NAV.map(({ to, end, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={{ pathname: to, search: to === "/app/settings" ? "" : query }}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cx(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-subtle text-fg font-semibold border border-line/60" : "text-muted hover:bg-subtle hover:text-fg"
              )
            }
          >
            <Icon className="h-4 w-4 flex-shrink-0 transition-transform group-hover:scale-110" />
            <span className="flex-1">{label}</span>
            {badge && open.length > 0 && (
              <span className="num rounded-full bg-fg px-1.5 py-0.5 text-[11px] font-semibold leading-none text-surface shadow-xs">{open.length}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <UserMenu onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function ViewControls() {
  const loc = useLocation();
  const show = controlsFor(loc.pathname);
  const { region, lead, set } = useView();
  const cycle = useCycle();
  const c = cycle.data;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {show.region && (
        <div className="relative inline-flex items-center">
          <MapPin className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted" />
          <select
            aria-label="Region"
            value={region}
            onChange={(e) => set({ region: e.target.value as RegionId })}
            className="h-8 appearance-none rounded-lg border border-line bg-surface pl-8 pr-7 text-xs font-medium text-fg shadow-sm transition-colors hover:border-muted focus:border-fg focus:outline-none"
          >
            {Object.values(REGIONS).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted" />
        </div>
      )}
      {show.lead && (
        <Segmented size="sm" label="Lead day" value={lead} onChange={(v) => set({ lead: v })} options={LEADS.map((d) => ({ value: d, label: `D${d}`, title: `Forecast day ${d}` }))} />
      )}
      <span
        className={cx(
          "hidden items-center gap-1.5 rounded-full border border-line bg-subtle px-2.5 py-1 text-xs font-medium sm:inline-flex shadow-xs",
          c ? "text-fg" : "text-muted"
        )}
        title={c ? `Live cycle generated ${c.generated_at.slice(0, 16).replace("T", " ")} UTC from ${c.sources.filter((x) => x.live).length} models` : "No live data"}
      >
        <span className={cx("h-1.5 w-1.5 rounded-full", c ? "bg-fg" : "bg-muted")} />
        {c ? `Live · run ${fmtRunTime.format(new Date(c.issue.init_utc))} UTC` : cycle.isLoading ? "Connecting…" : "Offline"}
      </span>
    </div>
  );
}

function Banners() {
  const mode = useSession((s) => s.mode);
  const offline = useSession((s) => s.offline);
  const navigate = useNavigate();
  if (mode === "demo")
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-line bg-subtle px-4 py-2 text-center text-sm text-fg">
        <span>You're exploring the demo. Settings and acknowledgements are kept in this browser only.</span>
        <button
          type="button"
          className="font-semibold underline underline-offset-2 hover:opacity-80"
          onClick={() => navigate("/logout?to=/signup")}
        >
          Create an account
        </button>
      </div>
    );
  if (offline)
    return (
      <div className="flex items-center justify-center gap-2 border-b border-line bg-subtle px-4 py-2 text-sm text-fg">
        <WifiOff className="h-4 w-4" /> Can't reach the server. You're seeing offline data and changes can't be saved right now.
      </div>
    );
  return null;
}

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();
  const title = NAV.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)))?.label ?? "Bharosa";

  useEffect(() => {
    document.title = `${title} · Bharosa`;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);

  return (
    <div className="flex min-h-[100dvh] bg-canvas">
      <a href="#app-main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-[100dvh] w-60 flex-shrink-0 border-r border-line bg-surface lg:block">
        <Sidebar onNavigate={() => undefined} />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-fg/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-fade-in border-r border-line bg-surface shadow-pop">
            <button type="button" onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 rounded-lg p-2 text-muted hover:bg-subtle" aria-label="Close navigation">
              <X className="h-4 w-4" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Banners />
        <header className="sticky top-0 z-30 flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setMobileOpen(true)} className="-ml-1 rounded-lg p-2 text-muted hover:bg-subtle lg:hidden" aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <p className="text-sm font-semibold text-fg">{title}</p>
          <div className="ml-auto">
            <ViewControls />
          </div>
        </header>
        <main id="app-main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export function PageLoading() {
  return <Spinner label="Loading page" />;
}

import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  CloudRain,
  LayoutDashboard,
  LogOut,
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
import { DATES, REGIONS } from "@/data/meta";
import { LEADS, useStations, useView } from "@/data/state";
import type { RegionId } from "@/data/types";

const NAV = [
  { to: "/app", end: true, label: "Overview", icon: LayoutDashboard },
  { to: "/app/stations", label: "Stations", icon: MapPinned },
  { to: "/app/forecast", label: "Forecast", icon: CloudRain },
  { to: "/app/models", label: "Models", icon: Network },
  { to: "/app/alerts", label: "Alerts", icon: Bell, badge: true },
  { to: "/app/verification", label: "Verification", icon: CheckCircle2 },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

const DEFAULT_TITLE = "AtmosFusion — multi-model forecast blending";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

/** Which view controls each page uses. */
function controlsFor(path: string) {
  if (path.startsWith("/app/settings")) return { region: false, date: false, lead: false };
  if (path.startsWith("/app/stations")) return { region: false, date: false, lead: true };
  if (path.startsWith("/app/verification")) return { region: false, date: false, lead: false };
  return { region: true, date: true, lead: true };
}

function Initials({ name }: { name: string }) {
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{initials}</span>;
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
          <button role="menuitem" type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-soft">
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
      <div className="px-5 py-5">
        <Link to="/app" onClick={onNavigate} className="rounded-md">
          <Logo />
        </Link>
      </div>
      <nav aria-label="App" className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.map(({ to, end, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={{ pathname: to, search: to === "/app/settings" ? "" : query }}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-accent-soft text-accent" : "text-muted hover:bg-subtle hover:text-fg"
              )
            }
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1">{label}</span>
            {badge && open.length > 0 && (
              <span className="num rounded-full bg-danger px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">{open.length}</span>
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
  const { region, date, lead, set } = useView();
  const stations = useStations(lead);
  const live = stations.data?.live;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {show.region && (
        <select
          aria-label="Region"
          value={region}
          onChange={(e) => set({ region: e.target.value as RegionId })}
          className="h-8 rounded-lg border border-line bg-surface px-2 text-sm text-fg shadow-sm focus:border-accent focus:outline-none"
        >
          {Object.values(REGIONS).map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      )}
      {show.date && (
        <select
          aria-label="Valid date"
          value={date}
          onChange={(e) => set({ date: e.target.value })}
          className="h-8 rounded-lg border border-line bg-surface px-2 text-sm text-fg shadow-sm focus:border-accent focus:outline-none"
        >
          {DATES.map((d) => (
            <option key={d.date} value={d.date}>{dateFmt.format(new Date(d.date))}</option>
          ))}
        </select>
      )}
      {show.lead && (
        <Segmented size="sm" label="Lead day" value={lead} onChange={(v) => set({ lead: v })} options={LEADS.map((d) => ({ value: d, label: `D${d}`, title: `Forecast day ${d}` }))} />
      )}
      {live !== undefined && (
        <span
          className={cx("hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium sm:inline-flex", live ? "border-ok/20 bg-ok-soft text-ok" : "border-line bg-subtle text-muted")}
          title={live ? "Station forecasts come from the FastAPI backend" : "Backend not reachable: station forecasts are computed in your browser (identical engine)"}
        >
          <span className={cx("h-1.5 w-1.5 rounded-full", live ? "bg-ok" : "bg-muted")} />
          {live ? "Live API" : "Offline engine"}
        </span>
      )}
    </div>
  );
}

function Banners() {
  const mode = useSession((s) => s.mode);
  const offline = useSession((s) => s.offline);
  const navigate = useNavigate();
  if (mode === "demo")
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-accent/15 bg-accent-soft px-4 py-2 text-center text-sm text-accent">
        <span>You're exploring the demo. Settings and acknowledgements are kept in this browser only.</span>
        <button
          type="button"
          className="font-semibold underline underline-offset-2"
          onClick={() => navigate("/logout?to=/signup")}
        >
          Create an account
        </button>
      </div>
    );
  if (offline)
    return (
      <div className="flex items-center justify-center gap-2 border-b border-warn/20 bg-warn-soft px-4 py-2 text-sm text-warn">
        <WifiOff className="h-4 w-4" /> Can't reach the server. You're seeing offline data and changes can't be saved right now.
      </div>
    );
  return null;
}

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();
  const title = NAV.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)))?.label ?? "AtmosFusion";

  useEffect(() => {
    document.title = `${title} · AtmosFusion`;
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

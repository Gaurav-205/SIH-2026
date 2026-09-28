import { Link } from "react-router-dom";
import { Activity, ArrowLeft, Database, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useSession } from "@/auth/session";
import { useOperations } from "@/features/admin/api";
import { Badge, Card, Spinner } from "@/components/ui";
import { ApiError } from "@/lib/api";
const time = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toUTCString() : "Unavailable";
export default function Admin() {
  const mode = useSession((s) => s.mode);
  const { data, error, isLoading, isFetching, refetch } = useOperations();
  const denied = error instanceof ApiError && [401, 403].includes(error.status);
  return <div className="min-h-[100dvh] bg-canvas">
    <a href="#operations-main" className="skip-link">Skip to operations</a>
    <header className="border-b border-line bg-surface"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5"><div className="flex items-center gap-3"><ShieldCheck className="text-accent" /><div><p className="text-lg font-semibold">Bharosa <span className="font-normal text-muted">/ Operations</span></p><p className="text-xs text-muted">Publication and service monitoring</p></div></div><Link to="/app" className="spatial-toggle"><ArrowLeft size={15} />Forecast application</Link></div></header>
    <main id="operations-main" className="mx-auto max-w-7xl px-5 py-8">
      {mode !== "account" ? <Card title="Administrator sign-in required"><p className="text-sm text-muted">This workspace is for authorized system operators.</p><Link to="/login?next=/admin" className="spatial-toggle mt-5">Log in to continue</Link></Card>
      : isLoading ? <Spinner label="Checking administrator access" />
      : error ? <Card title={denied ? "Access restricted" : "Monitoring is unavailable"}><p role="alert" className="text-sm text-muted">{denied ? "Your account does not have administrator access. Contact the system operator." : "The operations service could not be reached. Try again shortly."}</p>{!denied && <button type="button" onClick={() => refetch()} className="spatial-toggle mt-4">Retry</button>}</Card>
      : data && <>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">SYSTEM OVERVIEW</p><h1 className="mt-2 text-3xl font-semibold">Publication health</h1><p className="mt-2 text-xs text-muted">Checked {time(data.checked_at)} · refreshes every minute</p></div><button type="button" disabled={isFetching} onClick={() => refetch()} className="spatial-toggle"><RefreshCw size={15} />{isFetching ? "Checking…" : "Refresh status"}</button></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card title={<span className="flex items-center gap-2"><Activity size={16} />Forecast state</span>}><Badge tone={data.status === "operational" ? "ok" : "warn"}>{data.status.replaceAll("_", " ")}</Badge><p className="mt-3 text-xs text-muted">Freshness limit: {data.freshness_limit_hours} hours</p></Card>
          <Card title="Age of forecast run"><p className="num text-3xl font-semibold">{data.cycle?.issue_age_hours == null ? "—" : `${data.cycle.issue_age_hours.toFixed(1)}h`}</p><p className="mt-2 text-xs text-muted">Republishing does not reset run age</p></Card>
          <Card title={<span className="flex items-center gap-2"><Database size={16} />Forecast coverage</span>}><p className="num text-3xl font-semibold">{data.cycle?.records ?? "—"}</p><p className="mt-2 text-xs text-muted">records · {data.cycle?.points ?? "—"} configured district points</p></Card>
          <Card title={<span className="flex items-center gap-2"><Users size={16} />Accounts</span>}><p className="num text-3xl font-semibold">{data.users.total}</p><p className="mt-2 text-xs text-muted">{data.users.onboarded} onboarded · {data.users.acknowledgements} acknowledgements</p></Card>
        </div>
        <div className="mt-6 grid gap-5 xl:grid-cols-[2fr_1fr]">
          <Card title="Source participation" description="Run metadata and record counts from the published cycle" bodyClassName="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-xs"><thead className="border-b border-line bg-subtle text-muted"><tr>{["Source", "Family", "Run (UTC)", "Records", "State"].map((h) => <th key={h} className="px-4 py-3 font-medium" scope="col">{h}</th>)}</tr></thead><tbody>{data.sources.map((s) => <tr key={s.id} className="border-b border-line"><th scope="row" className="px-4 py-4 font-medium">{s.label}</th><td className="px-4">{s.family}</td><td className="px-4">{time(s.run_init_utc)}</td><td className="num px-4">{s.record_count}</td><td className="px-4"><Badge tone={s.record_count ? "ok" : "warn"}>{s.record_count ? "In publication" : s.live ? "No records" : "Not enabled"}</Badge></td></tr>)}</tbody></table></div>{!data.sources.length && <p className="p-6 text-sm text-muted">No source manifest is available yet.</p>}<p className="p-4 text-xs leading-relaxed text-muted">{data.note}</p></Card>
          <div className="space-y-5"><Card title="Publication details"><dl className="space-y-4 text-xs">{[["Forecast run", time(data.cycle?.init_utc)], ["Published", time(data.cycle?.generated_at)], ["Latest rain truth", data.cycle?.latest_rain_truth_date ?? "Unavailable"], ["Archived cycles", String(data.exports.cycles)], ["Scorecard export", data.exports.scorecard ? "Present" : "Missing"], ["Validation export", data.exports.validation ? "Present" : "Missing"]].map(([k,v]) => <div key={k}><dt className="text-muted">{k}</dt><dd className="mt-1 font-medium break-words">{v}</dd></div>)}</dl></Card><Card title="Operational controls"><p className="text-sm leading-relaxed text-muted">Read-only monitoring is enabled. Pipeline jobs, audit logs and configuration changes require the planned job-runner integration.</p></Card></div>
        </div>
      </>}
    </main>
  </div>;
}

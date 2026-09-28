import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCheck, CheckCircle2, Download } from "lucide-react";
import { Badge, Button, Card, PageHeader, Segmented } from "@/components/ui";
import AlertItem from "@/components/AlertItem";
import LiveState from "@/components/LiveState";
import { issueId, useAlerts } from "@/data/alerts";
import { useView } from "@/data/state";
import { REGIONS } from "@/data/regions";
import { exportCapJson, exportCapXml } from "@/lib/exportUtils";

type Filter = "open" | "acked" | "all";

export default function Alerts() {
  const { alerts: allAlerts, acks, toggle, error, cycle, threshold, lead } = useAlerts();
  const { region } = useView();
  const alerts = allAlerts.filter((a) => cycle.data?.points.find((p) => p.id === a.pointId)?.region === region);
  const open = alerts.filter((a) => !acks[a.id]);
  const [filter, setFilter] = useState<Filter>("open");
  const c = cycle.data;
  const acked = alerts.filter((a) => acks[a.id]);
  const shown = filter === "open" ? open : filter === "acked" ? acked : alerts;
  const capCtx = c ? { validDate: c.issue.lead_dates[String(lead)], lead, label: issueId(c) } : null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Alerts"
        description={`Prototype alerts using IMD rainfall thresholds, or with at least an even chance of ≥ ${threshold} mm (your threshold), for day ${lead}. Acknowledgements are saved for your account and do not resolve the hazard.`}
        actions={
          <>
            <Button variant="secondary" size="sm" disabled={!alerts.length || !capCtx} onClick={() => capCtx && exportCapXml(alerts, capCtx)}>
              <Download className="h-3.5 w-3.5" /> CAP XML
            </Button>
            <Button variant="secondary" size="sm" disabled={!alerts.length || !capCtx} onClick={() => capCtx && exportCapJson(alerts, capCtx)}>
              <Download className="h-3.5 w-3.5" /> CAP JSON
            </Button>
            <Button size="sm" disabled={!open.length} onClick={() => open.forEach((a) => toggle(a.id, true))}>
              <CheckCheck className="h-3.5 w-3.5" /> Acknowledge all ({open.length})
            </Button>
          </>
        }
      />
      <LiveState loading={cycle.isLoading} error={cycle.error} hasData={!!c}>
        <p className="mb-4 rounded-xl border border-warn/20 bg-warn-soft p-4 text-sm text-warn">These are model-derived prototype alerts, not official warnings. <a href="https://mausam.imd.gov.in/" target="_blank" rel="noreferrer" className="underline font-semibold">Check official IMD guidance ↗</a></p>
        {error && (
          <div role="alert" className="mb-4 flex gap-2 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {error instanceof Error ? error.message : "Could not sync acknowledgements"}
          </div>
        )}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="Filter alerts"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "open", label: `Open (${open.length})` },
              { value: "acked", label: `Acknowledged (${acked.length})` },
              { value: "all", label: `All (${alerts.length})` },
            ]}
          />
          <p className="text-xs text-muted">
            Change your threshold in{" "}
            <Link to="/app/settings" className="font-medium text-accent hover:underline">Settings</Link>.
          </p>
        </div>
        <div className="space-y-6">
          {([region]).map((rid) => {
            const items = shown.filter((a) => c?.points.find((p) => p.id === a.pointId)?.region === rid);
            return (
              <Card
                key={rid}
                title={REGIONS[rid].name}
                badge={items.length > 0 ? <Badge tone={items.some((i) => i.level === "Red") ? "danger" : "warn"}>{items.length} {filter}</Badge> : undefined}
                bodyClassName="py-1"
              >
                {items.length ? (
                  <ul className="divide-y divide-line">
                    {items.map((a) => (
                      <AlertItem key={a.id} alert={a} ackedAt={acks[a.id]} onToggle={(ack) => toggle(a.id, ack)} />
                    ))}
                  </ul>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-8 text-center text-sm text-muted">
                    <CheckCircle2 className="h-4 w-4 text-muted" />
                    <span>{filter === "open" ? "Nothing open here." : filter === "acked" ? "Nothing acknowledged yet." : `No alerts for day ${lead}.`}</span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted">CAP exports are marked status “Exercise”: this is a prototype, not an official IMD warning.</p>
      </LiveState>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCheck, Download } from "lucide-react";
import { Button, Card, PageHeader, Segmented } from "@/components/ui";
import AlertItem from "@/components/AlertItem";
import LiveState from "@/components/LiveState";
import { issueId, useAlerts } from "@/data/alerts";
import { REGIONS } from "@/data/regions";
import { exportCapJson, exportCapXml } from "@/lib/exportUtils";

type Filter = "open" | "acked" | "all";

export default function Alerts() {
  const { alerts, open, acks, toggle, error, cycle, threshold, lead } = useAlerts();
  const [filter, setFilter] = useState<Filter>("open");
  const c = cycle.data;
  const acked = alerts.filter((a) => acks[a.id]);
  const shown = filter === "open" ? open : filter === "acked" ? acked : alerts;
  const capCtx = c ? { validDate: c.issue.lead_dates[String(lead)], lead, label: issueId(c) } : null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Alerts"
        description={`Districts reaching an IMD alert level, or with at least an even chance of ≥ ${threshold} mm (your threshold), for day ${lead}. Acknowledge each one so your team knows it has been seen.`}
        actions={
          <>
            <Button variant="secondary" size="sm" disabled={!alerts.length || !capCtx} onClick={() => capCtx && exportCapXml(alerts, capCtx)}>
              <Download className="h-3.5 w-3.5" /> CAP XML
            </Button>
            <Button variant="secondary" size="sm" disabled={!alerts.length || !capCtx} onClick={() => capCtx && exportCapJson(alerts, capCtx)}>
              <Download className="h-3.5 w-3.5" /> CAP JSON
            </Button>
            <Button size="sm" disabled={!open.length} onClick={() => open.forEach((a) => toggle(a.id, true))}>
              <CheckCheck className="h-3.5 w-3.5" /> Acknowledge all
            </Button>
          </>
        }
      />
      <LiveState loading={cycle.isLoading} error={cycle.error}>
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
          {(Object.keys(REGIONS) as (keyof typeof REGIONS)[]).map((rid) => {
            const items = shown.filter((a) => c?.points.find((p) => p.id === a.pointId)?.region === rid);
            return (
              <Card key={rid} title={REGIONS[rid].name} bodyClassName="py-1">
                {items.length ? (
                  <ul className="divide-y divide-line">
                    {items.map((a) => (
                      <AlertItem key={a.id} alert={a} ackedAt={acks[a.id]} onToggle={(ack) => toggle(a.id, ack)} />
                    ))}
                  </ul>
                ) : (
                  <p className="py-8 text-center text-sm text-muted">
                    {filter === "open" ? "Nothing open here." : filter === "acked" ? "Nothing acknowledged yet." : `No alerts for day ${lead}.`}
                  </p>
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

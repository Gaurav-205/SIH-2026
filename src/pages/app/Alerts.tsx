import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCheck, Download } from "lucide-react";
import { Button, Card, PageHeader, Segmented, Spinner } from "@/components/ui";
import AlertItem from "@/components/AlertItem";
import { useAlerts, type AppAlert } from "@/data/alerts";
import { useView } from "@/data/state";
import { exportCapJson, exportCapXml } from "@/lib/exportUtils";

type Filter = "open" | "acked" | "all";

export default function Alerts() {
  const { alerts, open, acks, toggle, error, loading, cycle, threshold } = useAlerts();
  const { lead } = useView();
  const [filter, setFilter] = useState<Filter>("open");

  if (loading) return <Spinner label="Loading alerts" />;

  const acked = alerts.filter((a) => acks[a.id]);
  const shown = filter === "open" ? open : filter === "acked" ? acked : alerts;
  const groups: { title: string; description: string; items: AppAlert[] }[] = [
    { title: "Pune station network", description: "IMD alert levels from the blended station forecast", items: shown.filter((a) => a.source === "station") },
    { title: `Districts, ${cycle.region.name}`, description: `At least an even chance of ≥ ${threshold} mm/day (your threshold)`, items: shown.filter((a) => a.source === "district") },
  ];
  const capCtx = { validDate: cycle.date, lead, label: cycle.region.id };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Alerts"
        description="Review each alert, then acknowledge it so your team knows it has been seen. Acknowledgements are saved to your account."
        actions={
          <>
            <Button variant="secondary" size="sm" disabled={!alerts.length} onClick={() => exportCapXml(alerts, capCtx)}>
              <Download className="h-3.5 w-3.5" /> CAP XML
            </Button>
            <Button variant="secondary" size="sm" disabled={!alerts.length} onClick={() => exportCapJson(alerts, capCtx)}>
              <Download className="h-3.5 w-3.5" /> CAP JSON
            </Button>
            <Button size="sm" disabled={!open.length} onClick={() => open.forEach((a) => toggle(a.id, true))}>
              <CheckCheck className="h-3.5 w-3.5" /> Acknowledge all
            </Button>
          </>
        }
      />

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
          Change your district threshold in{" "}
          <Link to="/app/settings" className="font-medium text-accent hover:underline">
            Settings
          </Link>
          .
        </p>
      </div>

      <div className="space-y-6">
        {groups.map((g) => (
          <Card key={g.title} title={g.title} description={g.description} bodyClassName="py-1">
            {g.items.length ? (
              <ul className="divide-y divide-line">
                {g.items.map((a) => (
                  <AlertItem key={a.id} alert={a} ackedAt={acks[a.id]} onToggle={(ack) => toggle(a.id, ack)} />
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-muted">
                {filter === "open" ? "Nothing open here." : filter === "acked" ? "Nothing acknowledged yet." : "No alerts for this cycle."}
              </p>
            )}
          </Card>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">CAP exports are marked status “Exercise”: this is a prototype, not an official IMD warning.</p>
    </div>
  );
}

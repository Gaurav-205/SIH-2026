import { Check, MapPin, Undo2 } from "lucide-react";
import type { AppAlert } from "@/data/alerts";
import { Badge, Button } from "./ui";
import { cx } from "@/lib/cx";

const TONE = { Red: "danger", Orange: "warn", Yellow: "neutral" } as const;
const BAR = { Red: "bg-fg", Orange: "bg-fg/70", Yellow: "bg-fg/40" } as const;
const timeFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function AlertItem({
  alert,
  ackedAt,
  onToggle,
  compact,
}: {
  alert: AppAlert;
  ackedAt?: string;
  onToggle: (ack: boolean) => void;
  compact?: boolean;
}) {
  const acked = !!ackedAt;
  return (
    <li className={cx("relative flex items-start gap-3 py-3 pl-4", acked && "opacity-60")}>
      <span className={cx("absolute bottom-3 left-0 top-3 w-1 rounded-full", BAR[alert.level])} aria-hidden="true" />
      <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-fg">{alert.headline}</p>
          <Badge tone={TONE[alert.level]}>{alert.level}</Badge>
        </div>
        {!compact && <p className="mt-0.5 text-xs text-muted">{alert.detail}</p>}
        <p className="mt-0.5 text-xs text-muted">
          {alert.region} · valid {alert.date}
          {acked && ` · Acknowledged ${timeFmt.format(new Date(ackedAt!))}`}
        </p>
      </div>
      <Button variant={acked ? "ghost" : "secondary"} size="sm" onClick={() => onToggle(!acked)} aria-label={`${acked ? "Reopen" : "Acknowledge"}: ${alert.headline}`}>
        {acked ? <Undo2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{acked ? "Reopen" : "Acknowledge"}</span>
      </Button>
    </li>
  );
}

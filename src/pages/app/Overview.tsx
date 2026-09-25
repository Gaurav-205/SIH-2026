import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bell, CloudRain, Gauge, RadioTower } from "lucide-react";
import { Badge, Card, PageHeader, Spinner, Stat } from "@/components/ui";
import AlertItem from "@/components/AlertItem";
import GridMap from "@/components/GridMap";
import StationMap from "@/components/StationMap";
import { firstName, useSession } from "@/auth/session";
import { useAlerts } from "@/data/alerts";
import { byDistrict, districtName } from "@/data/aggregate";
import { useView } from "@/data/state";
import { rainColor, rgb, fmt, pct } from "@/components/scales";
import { getImdRainColor } from "@/lib/blendEngine";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });

export default function Overview() {
  const user = useSession((s) => s.user)!;
  const mode = useSession((s) => s.mode);
  const { lead, query } = useView();
  const { alerts, open, acks, toggle, cycle, stations, loading } = useAlerts();
  const rainColorOf = useCallback((c: number) => rgb(rainColor(cycle.blend[c])), [cycle]);
  const wettest = useMemo(() => byDistrict(cycle, cycle.blend), [cycle]);
  const stationList = stations?.data.stations ?? [];
  const peakStation = stationList.reduce<(typeof stationList)[number] | null>((a, b) => (!a || b.consensus_blend > a.consensus_blend ? b : a), null);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={mode === "demo" ? `${greeting()} — welcome to the demo` : `${greeting()}, ${firstName(user)}`}
        description={
          <>
            {cycle.region.name} · valid {dateFmt.format(new Date(cycle.date))} · forecast day {lead}. Regime: <span className="font-medium text-fg">{cycle.regime}</span>.
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat
          label="Open alerts"
          value={open.length}
          sub={alerts.length ? `${alerts.length - open.length} of ${alerts.length} acknowledged` : "Nothing to review"}
          tone={open.some((a) => a.level === "Red") ? "danger" : open.length ? "warn" : "ok"}
          icon={<Bell className="h-4 w-4" />}
        />
        <Stat
          label="Wettest district"
          value={wettest[0] ? `${fmt.format(wettest[0].max)} mm` : "—"}
          sub={wettest[0] ? `${wettest[0].name}, blended forecast` : undefined}
          tone="accent"
          icon={<CloudRain className="h-4 w-4" />}
        />
        <Stat
          label="Pune station peak"
          value={peakStation ? `${peakStation.consensus_blend} mm` : "—"}
          sub={peakStation ? `${peakStation.name.split(" / ")[0]} · flat avg ${peakStation.simple_average} mm` : undefined}
          tone={peakStation?.alert_level === "Red" ? "danger" : "accent"}
          icon={<RadioTower className="h-4 w-4" />}
        />
        <Stat
          label="Regime confidence"
          value={pct.format(cycle.regimeConfidence)}
          sub="Share of models agreeing on the regime"
          icon={<Gauge className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card
          title="Needs attention"
          description={`Your threshold: ${user.alert_threshold} mm/day for districts; IMD levels for stations`}
          action={
            <Link to={{ pathname: "/app/alerts", search: query }} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
              All alerts <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
          bodyClassName="py-1"
        >
          {loading ? (
            <Spinner label="Loading alerts" />
          ) : open.length === 0 ? (
            <div className="grid min-h-[180px] place-items-center text-center">
              <div>
                <p className="font-medium text-fg">All clear</p>
                <p className="mt-1 text-sm text-muted">No open alerts for this cycle.</p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {open.slice(0, 5).map((a) => (
                <AlertItem key={a.id} alert={a} ackedAt={acks[a.id]} onToggle={(ack) => toggle(a.id, ack)} compact />
              ))}
            </ul>
          )}
        </Card>

        <Card
          title={`Rainfall, ${cycle.region.name}`}
          description="Blended 24-hour forecast"
          action={
            <Link to={{ pathname: "/app/forecast", search: query }} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
              Open forecast <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <div className="flex justify-center">
            <GridMap compact cycle={cycle} color={rainColorOf} label={`Blended rainfall over ${cycle.region.name}`} describe={(c) => `${districtName(cycle, c)}: ${fmt.format(cycle.blend[c])} mm`} />
          </div>
          <ul className="mt-4 divide-y divide-line text-sm">
            {wettest.slice(0, 3).map((d) => (
              <li key={d.name} className="flex justify-between py-2">
                <span className="text-fg">{d.name}</span>
                <span className="num text-muted">up to {fmt.format(d.max)} mm</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card
        className="mt-6"
        title="Pune station network"
        description="Five automatic weather stations, blended by recent model skill"
        action={
          <Link to={{ pathname: "/app/stations", search: query }} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            Open stations <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          {stationList.length ? (
            <StationMap stations={stationList} colorOf={(s) => getImdRainColor(s.consensus_blend)} valueOf={(s) => `${s.consensus_blend} mm`} className="h-[300px]" />
          ) : (
            <Spinner label="Loading stations" />
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-2 font-medium">Station</th>
                  <th className="pb-2 text-right font-medium">Blend</th>
                  <th className="pb-2 text-right font-medium">Flat avg</th>
                  <th className="pb-2 text-right font-medium">Alert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...stationList].sort((a, b) => b.consensus_blend - a.consensus_blend).map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 pr-2 text-fg">{s.name.split(" / ")[0]}</td>
                    <td className="num py-2.5 text-right font-medium text-fg">{s.consensus_blend}</td>
                    <td className="num py-2.5 text-right text-muted">{s.simple_average}</td>
                    <td className="py-2.5 text-right">
                      {s.alert_level ? <Badge tone={s.alert_level === "Red" ? "danger" : "warn"}>{s.alert_level}</Badge> : <span className="text-xs text-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted">mm per 24 h, forecast day {lead}.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

import type { ActivityTracePoint } from "../../visualization/chart-model";

export function ActivityTrace({ events, sourceStatus }: { events: ActivityTracePoint[]; sourceStatus: string }) {
  if (!events.length) return <div className="dream-chart-state"><b>{sourceStatus === "live" || sourceStatus === "stale" ? "Quiet window" : `Activity ${sourceStatus}`}</b><small>No causal events to plot.</small></div>;
  return (
    <ol className="dream-activity-trace" aria-label="Recent agent activity">
      {events.map((event) => <li key={event.id} className={`dream-activity-trace__item dream-activity-trace__item--${event.tone}`} style={{ "--trace-order": event.order } as React.CSSProperties}>
        <i aria-hidden="true" />
        <span><b>{event.action}</b><small>{event.agent} · {new Date(event.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></span>
      </li>)}
    </ol>
  );
}

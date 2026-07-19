import type { ReactNode } from "react";
import type { SemanticChartState } from "../../visualization/chart-contract";

type Props = {
  state: SemanticChartState;
  title: string;
  children: ReactNode;
  className?: string;
};

const STATUS_COPY: Record<SemanticChartState["status"], string> = {
  loading: "Loading source…",
  live: "Live",
  stale: "Stale snapshot",
  error: "Source error",
  unavailable: "Source unavailable",
  insufficient: "Insufficient history",
};

export function SemanticChartFrame({ state, title, children, className = "" }: Props) {
  const readable = state.status === "live" || state.status === "stale";
  return (
    <figure className={`dream-chart-frame dream-chart-frame--${state.status} ${className}`} aria-label={title}>
      <figcaption>
        <span>{title}</span>
        <small title={`${state.source} · ${state.fetchedAt ?? "not fetched"}`}>{STATUS_COPY[state.status]}</small>
      </figcaption>
      {readable ? children : (
        <div className="dream-chart-state" role={state.status === "error" ? "alert" : "status"}>
          <b>{STATUS_COPY[state.status]}</b>
          <small>{state.status === "insufficient" ? `${state.pointCount}/${state.minimumPoints} required points` : state.error ?? state.source}</small>
        </div>
      )}
    </figure>
  );
}

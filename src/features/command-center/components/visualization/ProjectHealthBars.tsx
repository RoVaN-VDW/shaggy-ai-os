import type { ProjectHealthBar } from "../../visualization/chart-model";

export function ProjectHealthBars({ bars, sourceStatus }: { bars: ProjectHealthBar[]; sourceStatus: string }) {
  if (!bars.length) return <div className="dream-chart-state"><b>{sourceStatus === "live" || sourceStatus === "stale" ? "No projects" : `Projects ${sourceStatus}`}</b></div>;
  return (
    <div className="dream-health-bars" aria-label="Project health portfolio">
      {bars.map((bar) => <div className="dream-health-bar" data-tone={bar.tone} key={bar.id}>
        <span><b>{bar.name}</b><em>{bar.health === null ? "—" : `${bar.health}%`}</em></span>
        <i><b style={{ width: `${bar.health ?? 0}%` }} /></i>
      </div>)}
    </div>
  );
}

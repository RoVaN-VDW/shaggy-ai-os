type Props = { value: number | null; sourceStatus: string };

export function MissionHealthGauge({ value, sourceStatus }: Props) {
  const bounded = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="dream-health-gauge" role="img" aria-label={value === null ? `Mission health ${sourceStatus}` : `Mission health ${bounded} percent`}>
      <svg viewBox="0 0 112 112" aria-hidden="true">
        <circle className="dream-health-gauge__track" cx="56" cy="56" r="42" />
        <circle className="dream-health-gauge__value" cx="56" cy="56" r="42" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - bounded} />
      </svg>
      <span><b>{value === null ? "—" : bounded}</b><small>{value === null ? sourceStatus : "% health"}</small></span>
    </div>
  );
}

export type SpringState = {
  value: number;
  velocity: number;
};

export type SpringStep = {
  frequency: number;
  dt: number;
};

export function stepCriticalSpring(
  state: SpringState,
  target: number,
  step: SpringStep,
): SpringState {
  const dt = Math.min(Math.max(step.dt, 0), 0.1);
  const omega = Math.PI * 2 * Math.max(step.frequency, 0.001);
  const displacement = state.value - target;
  const decay = Math.exp(-omega * dt);
  const temporal = (state.velocity + omega * displacement) * dt;

  return {
    value: target + (displacement + temporal) * decay,
    velocity: (state.velocity - omega * temporal) * decay,
  };
}

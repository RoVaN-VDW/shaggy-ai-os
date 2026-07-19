export type Saccade = {
  at: number;
  x: number;
  y: number;
};

export type SaccadeScheduleOptions = {
  seed: number;
  count: number;
  startAt?: number;
};

export type GazePoint = {
  x: number;
  y: number;
};

export type ResolvedGazeTarget = GazePoint & {
  source: "focus" | "pointer" | "scheduled";
};

export type GazeTargetInput = {
  scheduled: GazePoint;
  pointer?: GazePoint | null;
  focus?: GazePoint | null;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function createSeededUnitGenerator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function restrainedTarget(unit: number, radius: number) {
  return Number((((unit * 2) - 1) * radius).toFixed(6));
}

export function createSeededSaccadeSchedule({
  seed,
  count,
  startAt = 0,
}: SaccadeScheduleOptions): Saccade[] {
  const random = createSeededUnitGenerator(seed);
  const schedule: Saccade[] = [];
  let at = startAt;

  for (let index = 0; index < Math.max(0, Math.floor(count)); index += 1) {
    at += 1600 + Math.round(random() * 2000);
    schedule.push({
      at,
      x: restrainedTarget(random(), 0.32),
      y: restrainedTarget(random(), 0.18),
    });
  }

  return schedule;
}

export function resolveGazeTarget({
  scheduled,
  pointer,
  focus,
}: GazeTargetInput): ResolvedGazeTarget {
  const source = focus ? "focus" : pointer ? "pointer" : "scheduled";
  const target = focus ?? pointer ?? scheduled;

  return {
    x: clamp(target.x, -0.82, 0.82),
    y: clamp(target.y, -0.58, 0.58),
    source,
  };
}

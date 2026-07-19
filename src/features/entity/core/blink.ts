export type BlinkEvent = {
  at: number;
  duration: number;
};

export type BlinkScheduleOptions = {
  seed: number;
  count: number;
  startAt?: number;
};

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

export function createSeededBlinkSchedule({
  seed,
  count,
  startAt = 0,
}: BlinkScheduleOptions): BlinkEvent[] {
  const random = createSeededUnitGenerator(seed);
  const schedule: BlinkEvent[] = [];
  let at = startAt;

  for (let index = 0; index < Math.max(0, Math.floor(count)); index += 1) {
    at += 2800 + Math.round(random() * 3400);
    schedule.push({
      at,
      duration: 120 + Math.round(random() * 60),
    });
  }

  return schedule;
}

export function sampleBlinkClosure(event: BlinkEvent, at: number) {
  const endAt = event.at + event.duration;
  if (at <= event.at || at >= endAt || event.duration <= 0) return 0;
  const progress = (at - event.at) / event.duration;
  return Math.sin(progress * Math.PI);
}

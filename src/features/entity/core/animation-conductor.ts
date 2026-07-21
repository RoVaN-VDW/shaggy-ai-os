import { createSeededBlinkSchedule, sampleBlinkClosure, type BlinkEvent } from "./blink.ts";
import { createExpressionForEntityState } from "./expression.ts";
import { clampFacePose, type FacePose } from "./face-pose.ts";
import {
  createSeededSaccadeSchedule,
  resolveGazeTarget,
  type GazePoint,
  type Saccade,
} from "./gaze.ts";
import { stepCriticalSpring, type SpringState } from "./springs.ts";
import type { EntityState } from "./entity-state.ts";

export type AnimationMotion = "full" | "reduced";

export type AnimationFrameInput = {
  at: number;
  state: EntityState;
  motion: AnimationMotion;
  pointer?: GazePoint | null;
  focus?: GazePoint | null;
};

export type AnimationFrame = {
  pose: FacePose;
  gazeSource: "focus" | "pointer" | "scheduled";
};

export type AnimationConductor = {
  sample: (input: AnimationFrameInput) => AnimationFrame;
};

function latestSaccade(schedule: Saccade[], at: number): Saccade | null {
  for (let index = schedule.length - 1; index >= 0; index -= 1) {
    if (schedule[index].at <= at) return schedule[index];
  }
  return null;
}

function activeBlink(schedule: BlinkEvent[], at: number): BlinkEvent | null {
  for (let index = schedule.length - 1; index >= 0; index -= 1) {
    const event = schedule[index];
    if (event.at <= at && at <= event.at + event.duration) return event;
    if (event.at < at) return null;
  }
  return null;
}

export function createAnimationConductor({ seed }: { seed: number }): AnimationConductor {
  let originAt: number | null = null;
  let previousElapsed = 0;
  let scheduleSize = 32;
  let saccades = createSeededSaccadeSchedule({ seed, count: scheduleSize });
  let blinks = createSeededBlinkSchedule({ seed: seed ^ 0x9e3779b9, count: scheduleSize });
  let gazeX: SpringState = { value: 0, velocity: 0 };
  let gazeY: SpringState = { value: 0, velocity: 0 };

  const ensureScheduleCovers = (at: number) => {
    while (saccades.at(-1)?.at !== undefined && saccades.at(-1)!.at < at) {
      scheduleSize *= 2;
      saccades = createSeededSaccadeSchedule({ seed, count: scheduleSize });
      blinks = createSeededBlinkSchedule({ seed: seed ^ 0x9e3779b9, count: scheduleSize });
    }
  };

  return {
    sample(input) {
      originAt ??= input.at;
      const elapsed = Math.max(0, input.at - originAt);
      if (input.motion === "reduced") {
        previousElapsed = elapsed;
        const target = resolveGazeTarget({
          scheduled: { x: 0, y: 0 },
          pointer: input.pointer,
          focus: input.focus,
        });
        const pose = clampFacePose({
          ...createExpressionForEntityState(input.state),
          gazeX: target.x,
          gazeY: target.y,
        });
        return { pose, gazeSource: target.source };
      }

      ensureScheduleCovers(elapsed);

      const scheduled = latestSaccade(saccades, elapsed) ?? { x: 0, y: 0 };
      const target = resolveGazeTarget({
        scheduled,
        pointer: input.pointer,
        focus: input.focus,
      });
      const dt = Math.max(0, elapsed - previousElapsed) / 1000;
      previousElapsed = elapsed;
      gazeX = stepCriticalSpring(gazeX, target.x, { frequency: 9, dt });
      gazeY = stepCriticalSpring(gazeY, target.y, { frequency: 9, dt });

      const expression = createExpressionForEntityState(input.state);
      const blink = activeBlink(blinks, elapsed);
      const closure = blink ? sampleBlinkClosure(blink, elapsed) : 0;
      const pose = clampFacePose({
        ...expression,
        gazeX: gazeX.value,
        gazeY: gazeY.value,
        eyelidLeft: Math.max(expression.eyelidLeft, closure),
        eyelidRight: Math.max(expression.eyelidRight, closure),
      });

      return { pose, gazeSource: target.source };
    },
  };
}

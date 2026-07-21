import type { EntityEvent } from "./entity-event";
import type { EntityState } from "./entity-state";

const TRANSITIONS: Partial<Record<EntityState, Partial<Record<EntityEvent["type"], EntityState>>>> = {
  booting: { BOOT_COMPLETE: "idle" },
  idle: { VAD_START: "listening", MIC_PERMISSION_ERROR: "warning" },
  listening: { VAD_END: "understanding", MIC_PERMISSION_ERROR: "warning" },
  understanding: { TTS_START: "speaking", RESULT_SUCCESS: "success", RESULT_WARNING: "warning", RESULT_ERROR: "error" },
  success: { TTS_START: "speaking" },
  speaking: { TTS_END: "idle", BARGE_IN: "interrupted" },
  interrupted: { VAD_START: "listening" },
  warning: { RECOVER: "idle" },
  error: { RECOVER: "idle" },
};

const EVENT_PRIORITY: Record<EntityEvent["type"], number> = {
  FAULT: 100,
  BARGE_IN: 90,
  MIC_PERMISSION_ERROR: 80,
  TTS_END: 70,
  TTS_START: 69,
  VAD_END: 60,
  VAD_START: 59,
  RESULT_SUCCESS: 50,
  RESULT_WARNING: 50,
  RESULT_ERROR: 50,
  RECOVER: 20,
  BOOT_COMPLETE: 10,
  TICK: 0,
};

export type EntitySnapshot = {
  state: EntityState;
  epoch: number;
  enteredAt: number;
  lastEventAt: number;
};

export type EntityTransition = {
  snapshot: EntitySnapshot;
  accepted: boolean;
  reason: "accepted" | "illegal_event" | "stale_epoch" | "non_monotonic_time" | "decay_pending";
};

export function createEntitySnapshot(
  state: EntityState = "booting",
  epoch = 0,
  at = 0,
): EntitySnapshot {
  return { state, epoch, enteredAt: at, lastEventAt: at };
}

export function reduceEntityEvent(
  snapshot: EntitySnapshot,
  event: EntityEvent,
): EntityTransition {
  if (event.epoch < snapshot.epoch) {
    return { snapshot, accepted: false, reason: "stale_epoch" };
  }
  if (event.at < snapshot.lastEventAt) {
    return { snapshot, accepted: false, reason: "non_monotonic_time" };
  }
  if (event.type === "TICK") {
    if (snapshot.state !== "success" || event.at - snapshot.enteredAt < 2500) {
      return { snapshot, accepted: false, reason: "decay_pending" };
    }
    return {
      accepted: true,
      reason: "accepted",
      snapshot: {
        ...snapshot,
        state: "idle",
        enteredAt: event.at,
        lastEventAt: event.at,
      },
    };
  }

  const nextState = event.type === "FAULT" ? "error" : TRANSITIONS[snapshot.state]?.[event.type];
  if (nextState) {
    return {
      accepted: true,
      reason: "accepted",
      snapshot: {
        state: nextState,
        epoch: event.epoch,
        enteredAt: event.at,
        lastEventAt: event.at,
      },
    };
  }

  return { snapshot, accepted: false, reason: "illegal_event" };
}

export function reduceEntityEvents(
  snapshot: EntitySnapshot,
  events: EntityEvent[],
): EntitySnapshot {
  return [...events]
    .sort((left, right) => EVENT_PRIORITY[right.type] - EVENT_PRIORITY[left.type])
    .reduce((current, event) => reduceEntityEvent(current, event).snapshot, snapshot);
}

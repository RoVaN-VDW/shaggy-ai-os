import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createEntitySnapshot,
  reduceEntityEvent,
  reduceEntityEvents,
} from "../../src/features/entity/core/entity-director.ts";

test("boot completion moves the entity from booting to idle", () => {
  const initial = createEntitySnapshot("booting", 0, 100);
  const transition = reduceEntityEvent(initial, {
    type: "BOOT_COMPLETE",
    epoch: 0,
    at: 120,
  });

  assert.equal(transition.accepted, true);
  assert.equal(transition.snapshot.state, "idle");
  assert.equal(transition.snapshot.enteredAt, 120);
  assert.equal(transition.snapshot.lastEventAt, 120);
  assert.equal(transition.snapshot.epoch, 0);
});

test("voice events move through listening, understanding, speaking, and idle", () => {
  let snapshot = createEntitySnapshot("idle", 0, 100);

  snapshot = reduceEntityEvent(snapshot, { type: "VAD_START", epoch: 1, at: 200 }).snapshot;
  assert.equal(snapshot.state, "listening");
  assert.equal(snapshot.epoch, 1);

  snapshot = reduceEntityEvent(snapshot, { type: "VAD_END", epoch: 1, at: 300 }).snapshot;
  assert.equal(snapshot.state, "understanding");

  snapshot = reduceEntityEvent(snapshot, { type: "TTS_START", epoch: 1, at: 400 }).snapshot;
  assert.equal(snapshot.state, "speaking");

  snapshot = reduceEntityEvent(snapshot, { type: "TTS_END", epoch: 1, at: 500 }).snapshot;
  assert.equal(snapshot.state, "idle");
  assert.equal(snapshot.lastEventAt, 500);
});

test("events from a stale epoch are dropped without changing the snapshot", () => {
  const current = createEntitySnapshot("idle", 2, 500);
  const transition = reduceEntityEvent(current, {
    type: "VAD_START",
    epoch: 1,
    at: 600,
  });

  assert.equal(transition.accepted, false);
  assert.equal(transition.reason, "stale_epoch");
  assert.equal(transition.snapshot, current);
});

test("events with non-monotonic time are dropped within the current epoch", () => {
  const current = createEntitySnapshot("idle", 2, 500);
  const transition = reduceEntityEvent(current, {
    type: "VAD_START",
    epoch: 2,
    at: 499,
  });

  assert.equal(transition.accepted, false);
  assert.equal(transition.reason, "non_monotonic_time");
  assert.equal(transition.snapshot, current);
});

test("a fault preempts speaking and moves the entity to error", () => {
  const speaking = createEntitySnapshot("speaking", 3, 700);
  const transition = reduceEntityEvent(speaking, {
    type: "FAULT",
    epoch: 3,
    at: 710,
  });

  assert.equal(transition.accepted, true);
  assert.equal(transition.snapshot.state, "error");
  assert.equal(transition.snapshot.enteredAt, 710);
});

test("barge-in interrupts speaking and stale TTS completion cannot cancel new listening", () => {
  let snapshot = createEntitySnapshot("speaking", 3, 700);

  snapshot = reduceEntityEvent(snapshot, { type: "BARGE_IN", epoch: 3, at: 720 }).snapshot;
  assert.equal(snapshot.state, "interrupted");

  snapshot = reduceEntityEvent(snapshot, { type: "VAD_START", epoch: 4, at: 730 }).snapshot;
  assert.equal(snapshot.state, "listening");
  assert.equal(snapshot.epoch, 4);

  const staleEnd = reduceEntityEvent(snapshot, { type: "TTS_END", epoch: 3, at: 740 });
  assert.equal(staleEnd.accepted, false);
  assert.equal(staleEnd.reason, "stale_epoch");
  assert.equal(staleEnd.snapshot.state, "listening");
});

test("same-tick faults outrank barge-in and TTS completion regardless of input order", () => {
  const speaking = createEntitySnapshot("speaking", 5, 800);
  const snapshot = reduceEntityEvents(speaking, [
    { type: "TTS_END", epoch: 5, at: 810 },
    { type: "BARGE_IN", epoch: 5, at: 810 },
    { type: "FAULT", epoch: 5, at: 810 },
  ]);

  assert.equal(snapshot.state, "error");
  assert.equal(snapshot.lastEventAt, 810);
});

test("success remains visible for 2500ms and then decays to idle on tick", () => {
  const understanding = createEntitySnapshot("understanding", 6, 1000);
  const success = reduceEntityEvent(understanding, {
    type: "RESULT_SUCCESS",
    epoch: 6,
    at: 1100,
  }).snapshot;

  assert.equal(success.state, "success");
  assert.equal(reduceEntityEvent(success, { type: "TICK", epoch: 6, at: 3599 }).snapshot.state, "success");
  assert.equal(reduceEntityEvent(success, { type: "TICK", epoch: 6, at: 3600 }).snapshot.state, "idle");
});

test("microphone permission warning stays sticky until explicit recovery", () => {
  const listening = createEntitySnapshot("listening", 7, 4000);
  const warning = reduceEntityEvent(listening, {
    type: "MIC_PERMISSION_ERROR",
    epoch: 7,
    at: 4100,
  }).snapshot;

  assert.equal(warning.state, "warning");
  assert.equal(reduceEntityEvent(warning, { type: "TICK", epoch: 7, at: 10000 }).snapshot.state, "warning");
  assert.equal(reduceEntityEvent(warning, { type: "RECOVER", epoch: 7, at: 10001 }).snapshot.state, "idle");
});

test("error results stay sticky until explicit recovery", () => {
  const understanding = createEntitySnapshot("understanding", 8, 11000);
  const error = reduceEntityEvent(understanding, {
    type: "RESULT_ERROR",
    epoch: 8,
    at: 11100,
  }).snapshot;

  assert.equal(error.state, "error");
  assert.equal(reduceEntityEvent(error, { type: "TICK", epoch: 8, at: 20000 }).snapshot.state, "error");
  assert.equal(reduceEntityEvent(error, { type: "RECOVER", epoch: 8, at: 20001 }).snapshot.state, "idle");
});

test("warning results remain distinct from fatal errors", () => {
  const understanding = createEntitySnapshot("understanding", 9, 21000);
  const warning = reduceEntityEvent(understanding, {
    type: "RESULT_WARNING",
    epoch: 9,
    at: 21100,
  });

  assert.equal(warning.accepted, true);
  assert.equal(warning.snapshot.state, "warning");
});

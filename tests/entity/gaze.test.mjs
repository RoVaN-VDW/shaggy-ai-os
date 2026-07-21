import assert from "node:assert/strict";
import { test } from "node:test";

const gaze = await import("../../src/features/entity/core/gaze.ts").catch(() => ({}));

test("seeded saccade schedules are deterministic restrained and non-repeating", () => {
  assert.equal(typeof gaze.createSeededSaccadeSchedule, "function", "seeded gaze scheduler is missing");

  const first = gaze.createSeededSaccadeSchedule({ seed: 4242, count: 12, startAt: 0 });
  const replay = gaze.createSeededSaccadeSchedule({ seed: 4242, count: 12, startAt: 0 });
  const alternate = gaze.createSeededSaccadeSchedule({ seed: 4243, count: 12, startAt: 0 });

  assert.deepEqual(first, replay);
  assert.notDeepEqual(first, alternate);
  assert.equal(first.length, 12);

  for (const [index, saccade] of first.entries()) {
    assert.ok(Math.abs(saccade.x) <= 0.32, `saccade ${index} stays inside the restrained horizontal cone`);
    assert.ok(Math.abs(saccade.y) <= 0.18, `saccade ${index} stays inside the restrained vertical cone`);
    const previousAt = index === 0 ? 0 : first[index - 1].at;
    assert.ok(saccade.at - previousAt >= 1600, `saccade ${index} is not high-frequency noise`);
    assert.ok(saccade.at - previousAt <= 3600, `saccade ${index} does not leave a prolonged random stare`);
  }
});

test("causal focus and pointer targets override idle gaze inside the anatomical cone", () => {
  assert.equal(typeof gaze.resolveGazeTarget, "function", "causal gaze resolver is missing");

  const scheduled = { x: 0.1, y: -0.1 };
  const pointerOnly = gaze.resolveGazeTarget({
    scheduled,
    pointer: { x: 4, y: -4 },
  });
  const keyboardFocus = gaze.resolveGazeTarget({
    scheduled,
    pointer: { x: 0.6, y: 0.4 },
    focus: { x: -0.45, y: 0.3 },
  });

  assert.deepEqual(pointerOnly, { x: 0.82, y: -0.58, source: "pointer" });
  assert.deepEqual(keyboardFocus, { x: -0.45, y: 0.3, source: "focus" });
  assert.deepEqual(gaze.resolveGazeTarget({ scheduled }), { x: 0.1, y: -0.1, source: "scheduled" });
});

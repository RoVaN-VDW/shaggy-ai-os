import assert from "node:assert/strict";
import { test } from "node:test";

const animation = await import("../../src/features/entity/core/animation-conductor.ts").catch(() => ({}));

function sampleSequence(seed) {
  const conductor = animation.createAnimationConductor({ seed });
  return [0, 1700, 3600, 5200, 7400].map((at) => conductor.sample({
    at,
    state: "idle",
    motion: "full",
  }));
}

test("animation conductor deterministically composes seeded gaze blink and expression", () => {
  assert.equal(typeof animation.createAnimationConductor, "function", "animation conductor is missing");

  const first = sampleSequence(4242);
  const replay = sampleSequence(4242);
  const alternate = sampleSequence(4243);

  assert.deepEqual(first, replay);
  assert.notDeepEqual(first, alternate);
  for (const frame of first) {
    assert.ok(frame.pose.gazeX >= -1 && frame.pose.gazeX <= 1);
    assert.ok(frame.pose.gazeY >= -1 && frame.pose.gazeY <= 1);
    assert.ok(frame.pose.eyelidLeft >= 0 && frame.pose.eyelidLeft <= 1);
    assert.equal(frame.pose.jawOpen, 0);
  }
});

test("keyboard focus overrides pointer while pointer overrides scheduled gaze", () => {
  const pointerConductor = animation.createAnimationConductor({ seed: 4242 });
  pointerConductor.sample({ at: 0, state: "idle", motion: "full" });
  const pointerFrame = pointerConductor.sample({
    at: 100,
    state: "idle",
    motion: "full",
    pointer: { x: 4, y: -4 },
  });

  const focusConductor = animation.createAnimationConductor({ seed: 4242 });
  focusConductor.sample({ at: 0, state: "idle", motion: "full" });
  const focusFrame = focusConductor.sample({
    at: 100,
    state: "idle",
    motion: "full",
    pointer: { x: 0.7, y: -0.4 },
    focus: { x: -0.7, y: 0.4 },
  });

  assert.equal(pointerFrame.gazeSource, "pointer");
  assert.ok(pointerFrame.pose.gazeX > 0 && pointerFrame.pose.gazeY < 0);
  assert.equal(focusFrame.gazeSource, "focus");
  assert.ok(focusFrame.pose.gazeX < 0 && focusFrame.pose.gazeY > 0);
});

test("reduced motion removes time loops while preserving entity truth", () => {
  const conductor = animation.createAnimationConductor({ seed: 4242 });
  const idleStart = conductor.sample({ at: 0, state: "idle", motion: "reduced" });
  const idleLater = conductor.sample({ at: 10000, state: "idle", motion: "reduced" });
  const error = conductor.sample({ at: 20000, state: "error", motion: "reduced" });

  assert.deepEqual(idleLater, idleStart);
  assert.equal(error.pose.browLeft, -0.55);
  assert.equal(error.pose.eyelidLeft, 0.18);
  assert.equal(error.pose.energy, 0.78);
  assert.equal(error.pose.gazeX, 0);
  assert.equal(error.pose.gazeY, 0);
});

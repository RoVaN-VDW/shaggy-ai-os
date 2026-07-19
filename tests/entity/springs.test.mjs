import assert from "node:assert/strict";
import { test } from "node:test";

import { stepCriticalSpring } from "../../src/features/entity/core/springs.ts";

function runSpring() {
  let state = { value: 0, velocity: 0 };
  let previous = state.value;
  for (let frame = 0; frame < 120; frame += 1) {
    state = stepCriticalSpring(state, 1, { frequency: 8, dt: 1 / 60 });
    assert.ok(state.value >= previous);
    assert.ok(state.value <= 1);
    previous = state.value;
  }
  return state;
}

test("critical spring converges deterministically without overshoot", () => {
  const first = runSpring();
  const second = runSpring();

  assert.deepEqual(first, second);
  assert.ok(first.value > 0.999);
  assert.ok(Math.abs(first.velocity) < 0.001);
});

import assert from "node:assert/strict";
import { test } from "node:test";

const expression = await import("../../src/features/entity/core/expression.ts").catch(() => ({}));

const STATES = [
  "booting", "idle", "listening", "understanding", "speaking",
  "success", "warning", "error", "interrupted",
];

test("entity truth maps every state to a deterministic restrained expression", () => {
  assert.equal(typeof expression.createExpressionForEntityState, "function", "state expression resolver is missing");

  for (const state of STATES) {
    const first = expression.createExpressionForEntityState(state);
    const replay = expression.createExpressionForEntityState(state);
    assert.deepEqual(first, replay, `${state} expression is deterministic`);
    for (const value of Object.values(first)) assert.ok(Number.isFinite(value), `${state} contains only finite channels`);
  }

  const listening = expression.createExpressionForEntityState("listening");
  const speaking = expression.createExpressionForEntityState("speaking");
  const success = expression.createExpressionForEntityState("success");
  const error = expression.createExpressionForEntityState("error");

  assert.deepEqual(
    { jawOpen: listening.jawOpen, lipRound: listening.lipRound, lipSpread: listening.lipSpread },
    { jawOpen: 0, lipRound: 0, lipSpread: 0 },
  );
  assert.deepEqual(
    { jawOpen: speaking.jawOpen, lipRound: speaking.lipRound, lipSpread: speaking.lipSpread },
    { jawOpen: 0, lipRound: 0, lipSpread: 0 },
  );
  assert.ok(success.browLeft > 0 && success.cheekLeft > 0);
  assert.equal(error.browLeft, -0.55);
  assert.equal(error.eyelidLeft, 0.18);
  assert.equal(error.lipSpread, 0);
});

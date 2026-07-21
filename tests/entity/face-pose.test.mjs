import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clampFacePose,
  createNeutralFacePose,
} from "../../src/features/entity/core/face-pose.ts";

test("face pose channels are clamped to renderer-safe anatomical domains", () => {
  const pose = clampFacePose({
    ...createNeutralFacePose(),
    jawOpen: 2,
    lipRound: -1,
    browLeft: -2,
    browRight: 3,
    gazeX: 1.7,
    gazeY: -1.4,
    pupil: 4,
    energy: -2,
  });

  assert.equal(pose.jawOpen, 1);
  assert.equal(pose.lipRound, 0);
  assert.equal(pose.browLeft, -1);
  assert.equal(pose.browRight, 1);
  assert.equal(pose.gazeX, 1);
  assert.equal(pose.gazeY, -1);
  assert.equal(pose.pupil, 1);
  assert.equal(pose.energy, 0);
});

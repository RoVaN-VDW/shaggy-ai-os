import assert from "node:assert/strict";
import { test } from "node:test";

import { createNeutralFacePose } from "../../src/features/entity/core/face-pose.ts";
import { createEyePair } from "../../src/features/entity/render/eyes.ts";
import { createFaceGeometry } from "../../src/features/entity/render/geometry.ts";

test("eye geometry clamps gaze and pupil inside the canonical eye cone", () => {
  const geometry = createFaceGeometry({ seed: 4242, neuralPointCount: 12 });
  const pose = {
    ...createNeutralFacePose(),
    gazeX: 4,
    gazeY: -4,
    pupil: 3,
  };
  const eyes = createEyePair(geometry, pose);

  for (const eye of [eyes.left, eyes.right]) {
    assert.ok(Math.abs(eye.iris.x - eye.center.x) <= 0.07);
    assert.ok(Math.abs(eye.iris.y - eye.center.y) <= 0.045);
    assert.ok(eye.pupilRadius >= 0.025);
    assert.ok(eye.pupilRadius <= 0.055);
  }
});

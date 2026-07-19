import assert from "node:assert/strict";
import { test } from "node:test";

import { createFaceGeometry } from "../../src/features/entity/render/geometry.ts";

test("the same seed reproduces the same canonical face geometry", () => {
  const first = createFaceGeometry({ seed: 4242, neuralPointCount: 24 });
  const second = createFaceGeometry({ seed: 4242, neuralPointCount: 24 });

  assert.deepEqual(first, second);
  assert.equal(first.neuralPoints.length, 24);
  assert.deepEqual(Object.keys(first.landmarks), [
    "outline",
    "leftEye",
    "rightEye",
    "leftBrow",
    "rightBrow",
    "nose",
    "mouth",
    "jaw",
  ]);
});

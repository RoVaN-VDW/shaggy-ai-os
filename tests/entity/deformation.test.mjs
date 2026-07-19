import assert from "node:assert/strict";
import { test } from "node:test";

import { createNeutralFacePose } from "../../src/features/entity/core/face-pose.ts";
import {
  createPoseForEntityState,
  deformFaceGeometry,
} from "../../src/features/entity/render/deformation.ts";
import { createFaceGeometry } from "../../src/features/entity/render/geometry.ts";

test("the same pose deforms canonical geometry deterministically without mutation", () => {
  const geometry = createFaceGeometry({ seed: 4242, neuralPointCount: 24 });
  const canonicalCopy = structuredClone(geometry);
  const pose = {
    ...createNeutralFacePose(),
    jawOpen: 0.8,
    lipRound: 0.4,
    browLeft: 0.2,
    browRight: 0.2,
  };

  const first = deformFaceGeometry(geometry, pose);
  const second = deformFaceGeometry(geometry, pose);

  assert.deepEqual(first, second);
  assert.deepEqual(geometry, canonicalCopy);
  assert.notDeepEqual(first.landmarks.mouth, geometry.landmarks.mouth);
  assert.notDeepEqual(first.landmarks.jaw, geometry.landmarks.jaw);
});

test("idle listening and error map to distinct deterministic acceptance poses", () => {
  const idle = createPoseForEntityState("idle");
  const listening = createPoseForEntityState("listening");
  const error = createPoseForEntityState("error");

  assert.deepEqual(createPoseForEntityState("idle"), idle);
  assert.deepEqual(
    { jawOpen: idle.jawOpen, browLeft: idle.browLeft, pupil: idle.pupil, energy: idle.energy },
    { jawOpen: 0, browLeft: 0, pupil: 0.5, energy: 0.2 },
  );
  assert.deepEqual(
    { jawOpen: listening.jawOpen, browLeft: listening.browLeft, pupil: listening.pupil, energy: listening.energy },
    { jawOpen: 0, browLeft: 0.18, pupil: 0.62, energy: 0.68 },
  );
  assert.deepEqual(
    { jawOpen: error.jawOpen, browLeft: error.browLeft, eyelidLeft: error.eyelidLeft, energy: error.energy },
    { jawOpen: 0.08, browLeft: -0.55, eyelidLeft: 0.18, energy: 0.78 },
  );
});

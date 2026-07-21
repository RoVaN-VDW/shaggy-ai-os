import assert from "node:assert/strict";
import { test } from "node:test";

import { createEntitySnapshot } from "../../src/features/entity/core/entity-director.ts";
import { createRenderPolicy } from "../../src/features/entity/core/render-policy.ts";

test("reduced motion and DPR limits stay orthogonal to entity truth", () => {
  const entity = createEntitySnapshot("speaking", 4, 1000);
  const policy = createRenderPolicy({
    reducedMotion: true,
    quality: "high",
    visible: true,
    dpr: 3.5,
  });

  assert.equal(policy.motion, "reduced");
  assert.equal(policy.quality, "high");
  assert.equal(policy.visible, true);
  assert.equal(policy.dpr, 2);
  assert.equal(entity.state, "speaking");
});

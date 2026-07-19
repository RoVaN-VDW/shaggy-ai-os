import assert from "node:assert/strict";
import { test } from "node:test";

import { createFaceGeometry } from "../../src/features/entity/render/geometry.ts";
import { createFaceTopology } from "../../src/features/entity/render/topology.ts";

test("canonical geometry reproduces the same valid static topology", () => {
  const geometry = createFaceGeometry({ seed: 4242, neuralPointCount: 40 });
  const first = createFaceTopology(geometry);
  const second = createFaceTopology(geometry);
  const knownIds = new Set([
    ...geometry.neuralPoints.map((point) => point.id),
    ...Object.values(geometry.landmarks).flat().map((point) => point.id),
  ]);

  assert.deepEqual(first, second);
  assert.ok(first.length > 40);
  for (const link of first) {
    assert.equal(knownIds.has(link.from), true);
    assert.equal(knownIds.has(link.to), true);
  }
});

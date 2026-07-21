import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CANONICAL_VIEWPORT,
  DREAM_REGION_IDS,
  DREAM_REGIONS,
  validateLayoutContract,
} from "../../src/features/command-center/layout-contract.ts";

test("Dream v3 defines all 18 Golden Frame regions inside the canonical viewport", () => {
  assert.deepEqual(CANONICAL_VIEWPORT, { width: 1536, height: 1024 });
  assert.equal(DREAM_REGION_IDS.length, 18);
  assert.equal(new Set(DREAM_REGION_IDS).size, 18);
  assert.equal(DREAM_REGIONS.length, 18);
  assert.deepEqual(
    DREAM_REGIONS.map((region) => region.id),
    DREAM_REGION_IDS,
  );
  assert.deepEqual(validateLayoutContract(DREAM_REGIONS), []);
});

test("Dream v3 rejects duplicate and out-of-bounds regions", () => {
  const invalid = [
    ...DREAM_REGIONS,
    { ...DREAM_REGIONS[0] },
    { id: "outside", label: "Outside", x: 1500, y: 1000, width: 100, height: 100 },
  ];

  const errors = validateLayoutContract(invalid);

  assert.ok(errors.some((error) => error.includes("duplicate region id")));
  assert.ok(errors.some((error) => error.includes("outside the 1536×1024 viewport")));
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { GOLDEN_FRAME_CONTRACT, verifyGoldenFrame } from "../../scripts/golden-frame-contract.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("Golden Frame 01 matches the immutable Dream v3 visual contract", async () => {
  assert.deepEqual(GOLDEN_FRAME_CONTRACT, {
    width: 1536,
    height: 1024,
    bytes: 1_911_686,
    sha256: "238a051d8c2fe3ce6e8021822770895f4c46bb6667fc93c2bd5b08428dd3ae76",
    canonicalPath: "design-source/canonical/v3/Golden-Frame-01.png",
  });

  const result = await verifyGoldenFrame(root);

  assert.equal(result.ok, true);
  assert.equal(result.width, GOLDEN_FRAME_CONTRACT.width);
  assert.equal(result.height, GOLDEN_FRAME_CONTRACT.height);
  assert.equal(result.bytes, GOLDEN_FRAME_CONTRACT.bytes);
  assert.equal(result.sha256, GOLDEN_FRAME_CONTRACT.sha256);
});

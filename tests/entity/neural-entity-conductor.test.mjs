import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const componentPath = new URL("../../src/features/entity/components/NeuralEntity.tsx", import.meta.url);

test("NeuralEntity integrates one conductor into its existing RAF with causal listener cleanup", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /createAnimationConductor/);
  assert.equal((source.match(/createRafLifecycle\s*\(/g) ?? []).length, 1);
  assert.match(source, /conductor\.sample\s*\(/);
  assert.match(source, /addEventListener\("pointermove"/);
  assert.match(source, /addEventListener\("focusin"/);
  assert.match(source, /removeEventListener\("pointermove"/);
  assert.match(source, /removeEventListener\("focusin"/);
  assert.match(source, /lifecycle\.renderOnce\(\)/);
  assert.match(source, /host\.dataset\.gazeSource/);
});

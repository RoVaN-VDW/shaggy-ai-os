import assert from "node:assert/strict";
import { test } from "node:test";

import {
  mapEntityStateToLegacy,
  resolveEntityRenderer,
} from "../../src/features/entity/core/feature-flags.ts";

test("entity v2 flag provides a deterministic legacy rollback", () => {
  assert.equal(resolveEntityRenderer("false"), "legacy");
  assert.equal(resolveEntityRenderer("true"), "v2");
  assert.equal(resolveEntityRenderer(undefined), "v2");
});

test("new entity states map safely onto the legacy renderer contract", () => {
  assert.equal(mapEntityStateToLegacy("error"), "warning");
  assert.equal(mapEntityStateToLegacy("warning"), "warning");
  assert.equal(mapEntityStateToLegacy("booting"), "thinking");
  assert.equal(mapEntityStateToLegacy("understanding"), "thinking");
  assert.equal(mapEntityStateToLegacy("listening"), "idle");
  assert.equal(mapEntityStateToLegacy("speaking"), "idle");
});

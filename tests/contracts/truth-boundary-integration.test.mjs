import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("auth proof is shared with cockpit consumers and gates every initial data fetch", async () => {
  const [authGate, cockpitHook] = await Promise.all([
    source("src/components/auth-gate.tsx"),
    source("src/hooks/useCockpitData.ts"),
  ]);

  assert.doesNotMatch(authGate, /NODE_ENV\s*===?\s*["']development["']/);
  assert.match(authGate, /AuthBoundaryProvider/);
  assert.match(authGate, /buildSanitizedAuthCallbackUrl/);
  assert.match(authGate, /window\.history\.replaceState/);
  assert.match(cockpitHook, /useAuthBoundary\(\)/);
  assert.match(cockpitHook, /canAccessCockpitData\(auth\.status\)/);
});

test("system status renders an evidence-backed model instead of static trust claims", async () => {
  const systemStatus = await source("src/features/command-center/components/SystemStatus.tsx");

  assert.match(systemStatus, /buildSystemStatusModel/);
  assert.match(systemStatus, /useAuthBoundary\(\)/);
  assert.doesNotMatch(systemStatus, /const statuses\s*=\s*\[/);
});

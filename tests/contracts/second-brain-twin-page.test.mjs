import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const pageUrl = new URL("../../src/app/twin/page.tsx", import.meta.url);
const hookUrl = new URL("../../src/hooks/useSecondBrainSnapshot.ts", import.meta.url);

test("Twin route renders the private Second Brain snapshot instead of provider health", async () => {
  const source = await readFile(pageUrl, "utf8");
  assert.match(source, /useSecondBrainSnapshot/);
  for (const field of ["indexedProjects", "continuityFilesPresent", "openActions", "unresolvedDecisions", "staleProjects", "backupState", "recentChanges"]) {
    assert.match(source, new RegExp(field));
  }
  assert.match(source, /Second Brain/);
  assert.match(source, /Project constellation/);
  assert.match(source, /snapshot\.openActions\s*\?\?\s*["']—["']/);
  assert.match(source, /snapshot\.unresolvedDecisions\s*\?\?\s*["']—["']/);
  assert.doesNotMatch(source, /health_status|model_providers|Provider health/i);
});

test("Twin presents registry-derived freshness, provenance and age instead of claiming a static snapshot is live", async () => {
  const [page, hook] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(hookUrl, "utf8"),
  ]);

  assert.match(hook, /CAPABILITY_REGISTRY\.twin/);
  assert.match(hook, /resolveCapabilityTruth/);
  assert.match(hook, /truth:/);
  assert.match(page, /truth\.status/);
  assert.match(page, /truth\.source/);
  assert.match(page, /truth\.ageMs/);
  assert.match(page, /snapshot\.observedAt/);
  assert.doesNotMatch(page, /Private aggregate · live/);
});

test("Twin exposes the local-only source boundary when a deployment has no snapshot", async () => {
  const [page, hook] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(hookUrl, "utf8"),
  ]);
  assert.match(hook, /availability\?:\s*["']local-only["']/);
  assert.match(hook, /Local AI Workspace snapshot required/);
  assert.match(page, /Local-only source/);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { buildSecondBrainContinuitySummary, parseSecondBrainSnapshot } from "../../src/lib/second-brain/snapshot.ts";

const valid = {
  version: 1,
  observedAt: "2026-07-15T12:00:00.000Z",
  indexedProjects: 9,
  continuityFilesPresent: 60,
  continuityFilesExpected: 63,
  openActions: 12,
  unresolvedDecisions: 3,
  staleProjects: 1,
  backupState: "verified",
  recentChanges: [{ project: "SHAGGY AI OS", kind: "decision", at: "2026-07-15T11:00:00.000Z" }],
};

test("Second Brain snapshot accepts bounded aggregate metadata", () => {
  assert.deepEqual(parseSecondBrainSnapshot(valid), valid);
});

test("Second Brain snapshot rejects raw content and invalid counts", () => {
  assert.throws(() => parseSecondBrainSnapshot({ ...valid, rawDocument: "private" }), /unexpected field/i);
  assert.throws(() => parseSecondBrainSnapshot({ ...valid, openActions: -1 }), /openActions/i);
  assert.throws(() => parseSecondBrainSnapshot({ ...valid, recentChanges: Array(21).fill(valid.recentChanges[0]) }), /recentChanges/i);
});

test("Second Brain snapshot preserves unavailable derived counts as null", () => {
  const snapshot = parseSecondBrainSnapshot({ ...valid, openActions: null, unresolvedDecisions: null });
  assert.equal(snapshot.openActions, null);
  assert.equal(snapshot.unresolvedDecisions, null);
});

test("Second Brain snapshot rejects impossible aggregate relationships", () => {
  assert.throws(
    () => parseSecondBrainSnapshot({ ...valid, continuityFilesPresent: 64 }),
    /continuityFilesPresent/i,
  );
  assert.throws(
    () => parseSecondBrainSnapshot({ ...valid, staleProjects: 10 }),
    /staleProjects/i,
  );
});

test("Second Brain continuity distinguishes complete files from operational attention", () => {
  assert.deepEqual(buildSecondBrainContinuitySummary(valid), {
    coverage: 95,
    label: "file continuity",
    state: "attention",
    detail: "1 stale project",
  });
  assert.deepEqual(buildSecondBrainContinuitySummary({
    ...valid,
    continuityFilesPresent: 63,
    staleProjects: 0,
  }), {
    coverage: 100,
    label: "file continuity",
    state: "healthy",
    detail: "Backup verified",
  });
  assert.equal(buildSecondBrainContinuitySummary({ ...valid, backupState: "stale" }).detail, "1 stale project · backup stale");
});

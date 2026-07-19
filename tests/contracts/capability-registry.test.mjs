import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CAPABILITY_REGISTRY,
  CAPABILITY_TRUTH_DEFAULTS,
  resolveCapabilityTruth,
} from "../../src/lib/capabilities/registry.ts";

test("Capability Truth exposes one source-backed registry with owner-freezable timing defaults", () => {
  assert.deepEqual(CAPABILITY_TRUTH_DEFAULTS, {
    streamHeartbeatExpectedMs: 15_000,
    streamingMaxAgeMs: 45_000,
    clockSkewToleranceMs: 5_000,
  });

  assert.deepEqual(Object.keys(CAPABILITY_REGISTRY), [
    "cockpit",
    "secondBrain",
    "twin",
    "settings",
    "reviewQueue",
  ]);

  for (const [key, capability] of Object.entries(CAPABILITY_REGISTRY)) {
    assert.equal(capability.key, key);
    assert.match(capability.source, /^(supabase|local-snapshot|local-config):/);
    assert.ok(capability.ttlMs > 0);
    assert.equal(typeof capability.claim, "string");
  }

  assert.equal(CAPABILITY_REGISTRY.secondBrain.source, "local-snapshot:second-brain");
  assert.equal(CAPABILITY_REGISTRY.settings.claim, "local-only configuration");
  assert.equal(CAPABILITY_REGISTRY.reviewQueue.claim, "decision queue only");
});

test("Capability Truth resolves streaming, fresh, stale and offline from timestamped evidence", () => {
  const nowMs = Date.parse("2026-07-19T12:00:00.000Z");
  const capability = CAPABILITY_REGISTRY.cockpit;

  assert.deepEqual(resolveCapabilityTruth(capability, {
    configured: true,
    observedAt: "2026-07-19T10:00:00.000Z",
    heartbeatAt: "2026-07-19T11:59:30.000Z",
  }, nowMs), {
    status: "streaming",
    source: capability.source,
    observedAt: "2026-07-19T10:00:00.000Z",
    ageMs: 30_000,
    reason: "active-heartbeat",
  });

  assert.equal(resolveCapabilityTruth(capability, {
    configured: true,
    observedAt: "2026-07-19T11:59:30.000Z",
  }, nowMs).status, "fresh");

  assert.equal(resolveCapabilityTruth(capability, {
    configured: true,
    observedAt: "2026-07-19T11:58:00.000Z",
  }, nowMs).status, "stale");

  assert.equal(resolveCapabilityTruth(capability, {
    configured: true,
    observedAt: null,
  }, nowMs).status, "offline");

  assert.equal(resolveCapabilityTruth(capability, {
    configured: false,
    observedAt: "2026-07-19T11:59:30.000Z",
  }, nowMs).reason, "not-configured");

  assert.equal(resolveCapabilityTruth(capability, {
    configured: true,
    observedAt: "2026-07-19T12:00:06.000Z",
  }, nowMs).reason, "invalid-clock");

  assert.equal(resolveCapabilityTruth(capability, {
    configured: true,
    observedAt: "2026-07-19T11:59:30.000Z",
    refreshError: "network unavailable",
  }, nowMs).reason, "refresh-failed");
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { parseLocalActivitySnapshot } from "../../src/lib/local/activity-readplane.ts";

const NOW_MS = Date.parse("2026-07-22T12:00:00.000Z");

function validLedger(overrides = {}) {
  return {
    schema: 1,
    source: "local-sqlite:provider_usage",
    generated_at: "2026-07-22T11:59:30.000Z",
    truncated: false,
    provider_usage: [
      {
        id: "hermes:activity-new",
        provider: "openai-codex",
        model: "gpt-5.6-sol",
        project_id: "Hermes",
        task: "conversation",
        api_call_count: 4,
        input_tokens: 1200,
        output_tokens: 300,
        status: "success",
        created_at: "2026-07-22T11:59:20.000Z",
        metadata: { trust_level: "native-aggregate", prompt: "must never reach the browser" },
      },
      {
        id: "hermes:activity-old",
        provider: "custom:kimi-k3",
        model: "k3",
        project_id: null,
        task: null,
        api_call_count: 1,
        input_tokens: 0,
        output_tokens: 0,
        status: "unknown",
        created_at: "2026-07-22T11:58:00.000Z",
        metadata: { trust_level: "client-reported", api_key: "must never reach the browser" },
      },
    ],
    workflow_events: [],
    providers: [],
    projects: [],
    alerts: [],
    provider_quota: { status: "unknown", remaining: null, source: null },
    ...overrides,
  };
}

test("activity readplane maps recent recorded model activity and exposes only allowlisted metadata", () => {
  const snapshot = parseLocalActivitySnapshot(validLedger(), { nowMs: NOW_MS });

  assert.deepEqual(snapshot, {
    source: "local-sqlite:provider_usage",
    observedAt: "2026-07-22T11:59:30.000Z",
    activity: [
      {
        id: "hermes:activity-new",
        agent: "gpt-5.6-sol",
        action: "conversation",
        status: "success",
        metadata: {
          provider: "openai-codex",
          project_id: "Hermes",
          api_call_count: 4,
          input_tokens: 1200,
          output_tokens: 300,
          trust_level: "native-aggregate",
        },
        created_at: "2026-07-22T11:59:20.000Z",
      },
      {
        id: "hermes:activity-old",
        agent: "k3",
        action: "model activity",
        status: "unknown",
        metadata: {
          provider: "custom:kimi-k3",
          project_id: null,
          api_call_count: 1,
          input_tokens: 0,
          output_tokens: 0,
          trust_level: "client-reported",
        },
        created_at: "2026-07-22T11:58:00.000Z",
      },
    ],
  });
});

test("activity readplane rejects stale, future and truncated collector snapshots", () => {
  assert.throws(
    () => parseLocalActivitySnapshot(validLedger({ generated_at: "2026-07-22T11:58:59.999Z" }), { nowMs: NOW_MS }),
    /Local activity data is malformed/,
  );
  assert.throws(
    () => parseLocalActivitySnapshot(validLedger({ generated_at: "2026-07-22T12:05:00.001Z" }), { nowMs: NOW_MS }),
    /Local activity data is malformed/,
  );
  assert.throws(
    () => parseLocalActivitySnapshot(validLedger({ truncated: true }), { nowMs: NOW_MS }),
    /Local activity data is malformed/,
  );
});

test("activity readplane rejects malformed rows and duplicate event ids as a whole", () => {
  const first = validLedger().provider_usage[0];
  assert.throws(
    () => parseLocalActivitySnapshot(validLedger({
      provider_usage: [first, { ...first, provider: " openai-codex ", metadata: { api_key: "secret" } }],
    }), { nowMs: NOW_MS }),
    /Local activity data is malformed/,
  );
  assert.throws(
    () => parseLocalActivitySnapshot(validLedger({
      provider_usage: [first, { ...validLedger().provider_usage[1], id: first.id }],
    }), { nowMs: NOW_MS }),
    /Local activity data is malformed/,
  );
});

test("activity readplane caps its public collection after sorting newest first", () => {
  const base = validLedger().provider_usage[0];
  const provider_usage = Array.from({ length: 75 }, (_, index) => ({
    ...base,
    id: `hermes:event-${index}`,
    created_at: new Date(Date.parse("2026-07-22T11:58:00.000Z") + (index * 1_000)).toISOString(),
  }));

  const snapshot = parseLocalActivitySnapshot(validLedger({ provider_usage }), { nowMs: NOW_MS });
  assert.equal(snapshot.activity.length, 50);
  assert.equal(snapshot.activity[0].id, "hermes:event-74");
  assert.equal(snapshot.activity[49].id, "hermes:event-25");
});

test("activity readplane preserves microsecond ordering at the 50-event cap", () => {
  const base = validLedger().provider_usage[0];
  const provider_usage = Array.from({ length: 51 }, (_, index) => ({
    ...base,
    id: `hermes:micro-${String(index + 1).padStart(2, "0")}`,
    created_at: `2026-07-22T11:59:20.${String(index + 1).padStart(6, "0")}Z`,
  }));

  const snapshot = parseLocalActivitySnapshot(validLedger({ provider_usage }), { nowMs: NOW_MS });
  assert.equal(snapshot.activity.length, 50);
  assert.equal(snapshot.activity[0].id, "hermes:micro-51");
  assert.equal(snapshot.activity[49].id, "hermes:micro-02");
  assert.equal(snapshot.activity.some(({ id }) => id === "hermes:micro-01"), false);
});

test("activity readplane rejects calendar-invalid microsecond timestamps", () => {
  const event = validLedger().provider_usage[0];
  assert.throws(
    () => parseLocalActivitySnapshot(validLedger({
      provider_usage: [{ ...event, created_at: "2026-02-30T11:59:20.123456Z" }],
    }), { nowMs: NOW_MS }),
    /Local activity data is malformed/,
  );
});

test("activity readplane rejects events newer than the snapshot at microsecond precision", () => {
  const event = validLedger().provider_usage[0];
  assert.throws(
    () => parseLocalActivitySnapshot(validLedger({
      generated_at: "2026-07-22T11:59:30.123455Z",
      provider_usage: [{ ...event, created_at: "2026-07-22T11:59:30.123456Z" }],
    }), { nowMs: NOW_MS }),
    /Local activity data is malformed/,
  );
});

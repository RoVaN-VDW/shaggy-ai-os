import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { fetchLocalActivity } from "../../src/lib/api/local-activity.ts";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("local activity client fetches no-store and returns validated activity", async () => {
  const observedAt = new Date().toISOString();
  let request;
  globalThis.fetch = async (input, init) => {
    request = { input, init };
    return new Response(JSON.stringify({
      ok: true,
      source: "local-sqlite:provider_usage",
      observedAt,
      truncated: false,
      activity: [{
        id: "hermes:activity-1",
        agent: "gpt-5.6-sol",
        action: "conversation",
        status: "success",
        metadata: {
          provider: "openai-codex",
          project_id: "Hermes",
          api_call_count: 2,
          input_tokens: 100,
          output_tokens: 20,
          trust_level: "native-aggregate",
        },
        created_at: observedAt,
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const result = await fetchLocalActivity();

  assert.deepEqual(request, {
    input: "/api/activity",
    init: { cache: "no-store", headers: { Accept: "application/json" } },
  });
  assert.equal(result.error, null);
  assert.equal(result.observedAt, observedAt);
  assert.equal(result.data?.length, 1);
  assert.equal(result.data?.[0].metadata.trust_level, "native-aggregate");
});

test("local activity client accepts valid collector timestamps with microsecond precision", async () => {
  const observedAt = new Date().toISOString().replace(/\.\d{3}Z$/, ".123456Z");
  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: true,
    source: "local-sqlite:provider_usage",
    observedAt,
    truncated: false,
    activity: [{
      id: "hermes:microsecond-event",
      agent: "gpt-5.6-sol",
      action: "conversation",
      status: "unknown",
      metadata: {
        provider: "openai-codex",
        project_id: "Hermes",
        api_call_count: 1,
        input_tokens: 1,
        output_tokens: 1,
        trust_level: "native-aggregate",
      },
      created_at: observedAt,
    }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  const result = await fetchLocalActivity();
  assert.equal(result.error, null);
  assert.equal(result.observedAt, observedAt);
  assert.equal(result.data?.[0].created_at, observedAt);
});

test("local activity client rejects calendar-invalid microsecond timestamps", async () => {
  const observedAt = new Date().toISOString();
  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: true,
    source: "local-sqlite:provider_usage",
    observedAt,
    truncated: false,
    activity: [{
      id: "hermes:invalid-calendar-event",
      agent: "gpt-5.6-sol",
      action: "conversation",
      status: "unknown",
      metadata: {
        provider: "openai-codex",
        project_id: "Hermes",
        api_call_count: 1,
        input_tokens: 1,
        output_tokens: 1,
        trust_level: "native-aggregate",
      },
      created_at: "2026-02-30T11:59:20.123456Z",
    }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  const result = await fetchLocalActivity();
  assert.equal(result.data, null);
  assert.match(result.error?.message ?? "", /malformed/i);
});

test("local activity client rejects events newer than observedAt at microsecond precision", async () => {
  const base = new Date().toISOString().replace(/\.\d{3}Z$/, "");
  const observedAt = `${base}.123455Z`;
  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: true,
    source: "local-sqlite:provider_usage",
    observedAt,
    truncated: false,
    activity: [{
      id: "hermes:future-microsecond-event",
      agent: "gpt-5.6-sol",
      action: "conversation",
      status: "unknown",
      metadata: {
        provider: "openai-codex",
        project_id: "Hermes",
        api_call_count: 1,
        input_tokens: 1,
        output_tokens: 1,
        trust_level: "native-aggregate",
      },
      created_at: `${base}.123456Z`,
    }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  const result = await fetchLocalActivity();
  assert.equal(result.data, null);
  assert.match(result.error?.message ?? "", /malformed/i);
});

test("local activity client turns a 503 into one resource error", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: "Activity feed is unavailable.",
    availability: "local-only",
  }), { status: 503, headers: { "Content-Type": "application/json" } });

  assert.deepEqual(await fetchLocalActivity(), {
    data: null,
    observedAt: null,
    error: { message: "Activity feed is unavailable." },
  });
});

test("local activity client rejects malformed success payloads fail-closed", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: true,
    source: "local-sqlite:provider_usage",
    observedAt: new Date().toISOString(),
    truncated: false,
    activity: [{ id: "partial-row", metadata: { api_key: "must-not-pass" } }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  const result = await fetchLocalActivity();
  assert.equal(result.data, null);
  assert.match(result.error?.message ?? "", /malformed/i);
});

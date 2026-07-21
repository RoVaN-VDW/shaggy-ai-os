import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { fetchLocalProviders } from "../../src/lib/api/local-providers.ts";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("local provider client fetches no-store and returns validated provider data", async () => {
  const observedAt = new Date().toISOString();
  let request;
  globalThis.fetch = async (input, init) => {
    request = { input, init };
    return new Response(JSON.stringify({
      ok: true,
      source: "local-sqlite:provider_usage",
      observedAt,
      truncated: false,
      providers: [{
        id: "model:47d4303db7f17da584687b75e2e9dd7d",
        provider: "custom:kimi-k3",
        model: "k3",
        status: "active",
        health_status: "unknown",
        last_seen_at: null,
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const result = await fetchLocalProviders();

  assert.deepEqual(request, {
    input: "/api/providers",
    init: {
      cache: "no-store",
      headers: { Accept: "application/json" },
    },
  });
  assert.equal(result.error, null);
  assert.equal(result.observedAt, observedAt);
  assert.equal(result.data?.length, 1);
  assert.equal(result.data?.[0].last_seen_at, null);
});

test("local provider client turns a 503 into one resource error, never a healthy empty list", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: "Provider inventory is unavailable.",
    availability: "local-only",
  }), { status: 503, headers: { "Content-Type": "application/json" } });

  assert.deepEqual(await fetchLocalProviders(), {
    data: null,
    observedAt: null,
    error: { message: "Provider inventory is unavailable." },
  });
});

test("local provider client rejects malformed success payloads fail-closed", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: true,
    source: "local-sqlite:provider_usage",
    observedAt: new Date().toISOString(),
    providers: [{ id: "partial-row" }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  const result = await fetchLocalProviders();
  assert.equal(result.data, null);
  assert.match(result.error?.message ?? "", /malformed/i);
});

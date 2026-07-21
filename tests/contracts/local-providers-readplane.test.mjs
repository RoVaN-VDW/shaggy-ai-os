import assert from "node:assert/strict";
import { test } from "node:test";

import { parseLocalProvidersSnapshot } from "../../src/lib/local/providers-readplane.ts";

const NOW_MS = Date.parse("2026-07-21T12:00:00.000Z");

function validLedger(overrides = {}) {
  return {
    schema: 1,
    source: "local-sqlite:provider_usage",
    generated_at: "2026-07-21T11:59:00.000Z",
    truncated: false,
    providers: [
      {
        id: "model:47d4303db7f17da584687b75e2e9dd7d",
        provider: "custom:kimi-k3",
        model: "k3",
        status: "active",
        health_status: "unknown",
        last_seen_at: "2026-07-21T11:30:00.000Z",
        cost_profile: {
          monthly_budget_usd: 25,
          monthly_token_budget: 1_000_000,
          budget_reset_day: 1,
        },
      },
      {
        id: "model:ed0b7269ee48655b47a0aa15f199715a",
        provider: "openai-codex",
        model: "gpt-5.6-sol",
        status: "active",
        health_status: "unknown",
        last_seen_at: null,
      },
    ],
    overview: { ignored: "the provider readplane must select only its own contract" },
    ...overrides,
  };
}

test("provider readplane maps proven ledger fields and preserves a null last_seen_at", () => {
  const snapshot = parseLocalProvidersSnapshot(validLedger(), { nowMs: NOW_MS });

  assert.deepEqual(snapshot, {
    source: "local-sqlite:provider_usage",
    observedAt: "2026-07-21T11:59:00.000Z",
    providers: [
      {
        id: "model:47d4303db7f17da584687b75e2e9dd7d",
        provider: "custom:kimi-k3",
        model: "k3",
        status: "active",
        health_status: "unknown",
        last_seen_at: "2026-07-21T11:30:00.000Z",
        cost_profile: {
          monthly_budget_usd: 25,
          monthly_token_budget: 1_000_000,
          budget_reset_day: 1,
        },
      },
      {
        id: "model:ed0b7269ee48655b47a0aa15f199715a",
        provider: "openai-codex",
        model: "gpt-5.6-sol",
        status: "active",
        health_status: "unknown",
        last_seen_at: null,
      },
    ],
  });
  assert.equal("policy_profile" in snapshot.providers[0], false);
});

test("provider readplane exposes only bounded scalar budget fields", () => {
  const smuggled = {
    ...validLedger().providers[0],
    cost_profile: {
      monthly_budget_usd: 25,
      monthly_token_budget: 1_000_000,
      budget_reset_day: 1,
      api_key: "must-never-reach-browser",
      nested: { filesystem_path: "/private/source-must-not-leak" },
    },
  };

  assert.throws(
    () => parseLocalProvidersSnapshot(validLedger({ providers: [smuggled] }), { nowMs: NOW_MS }),
    /Local providers data is malformed/,
  );
  assert.throws(
    () => parseLocalProvidersSnapshot(validLedger({
      providers: [{ ...validLedger().providers[0], cost_profile: { monthly_budget_usd: Number.POSITIVE_INFINITY } }],
    }), { nowMs: NOW_MS }),
    /Local providers data is malformed/,
  );
  assert.throws(
    () => parseLocalProvidersSnapshot(validLedger({
      providers: [{ ...validLedger().providers[0], cost_profile: { budget_reset_day: 32 } }],
    }), { nowMs: NOW_MS }),
    /Local providers data is malformed/,
  );
});

test("provider readplane rejects unsupported schema and source", () => {
  assert.throws(
    () => parseLocalProvidersSnapshot(validLedger({ schema: 2 }), { nowMs: NOW_MS }),
    /Local providers data is malformed/,
  );
  assert.throws(
    () => parseLocalProvidersSnapshot(validLedger({ source: "supabase:model_providers" }), { nowMs: NOW_MS }),
    /Local providers data is malformed/,
  );
});

test("provider readplane rejects truncated or incomplete collector exports", () => {
  assert.throws(
    () => parseLocalProvidersSnapshot(validLedger({ truncated: true }), { nowMs: NOW_MS }),
    /Local providers data is malformed/,
  );
  const { truncated: _truncated, ...missingFlag } = validLedger();
  assert.throws(
    () => parseLocalProvidersSnapshot(missingFlag, { nowMs: NOW_MS }),
    /Local providers data is malformed/,
  );
});

test("provider readplane rejects malformed rows as a whole instead of returning partial data", () => {
  const malformedRow = {
    ...validLedger().providers[0],
    provider: " custom:kimi-k3 ",
    last_seen_at: "not-a-timestamp",
    filesystem_path: "/private/source-must-not-leak",
  };

  assert.throws(
    () => parseLocalProvidersSnapshot(
      validLedger({ providers: [validLedger().providers[1], malformedRow] }),
      { nowMs: NOW_MS },
    ),
    /Local providers data is malformed/,
  );
});

test("provider readplane rejects future-skewed collector snapshots", () => {
  assert.throws(
    () => parseLocalProvidersSnapshot(
      validLedger({ generated_at: "2026-07-21T12:05:00.001Z" }),
      { nowMs: NOW_MS },
    ),
    /Local providers data is malformed/,
  );
});

test("provider readplane rejects stale snapshots and future provider observations", () => {
  assert.throws(
    () => parseLocalProvidersSnapshot(
      validLedger({ generated_at: "2026-07-21T11:58:59.999Z" }),
      { nowMs: NOW_MS },
    ),
    /Local providers data is malformed/,
  );
  assert.throws(
    () => parseLocalProvidersSnapshot(validLedger({ providers: [{
      ...validLedger().providers[0],
      last_seen_at: "2026-07-21T12:00:00.001Z",
    }] }), { nowMs: NOW_MS }),
    /Local providers data is malformed/,
  );
});

test("provider readplane rejects duplicate IDs and provider-model identities", () => {
  const first = validLedger().providers[0];
  const second = validLedger().providers[1];
  assert.throws(
    () => parseLocalProvidersSnapshot(validLedger({ providers: [first, { ...second, id: first.id }] }), { nowMs: NOW_MS }),
    /Local providers data is malformed/,
  );
  assert.throws(
    () => parseLocalProvidersSnapshot(validLedger({ providers: [first, { ...second, provider: first.provider, model: first.model }] }), { nowMs: NOW_MS }),
    /Local providers data is malformed/,
  );
});

test("provider readplane caps the provider collection", () => {
  const provider = validLedger().providers[0];
  const providers = Array.from({ length: 1_001 }, (_, index) => ({
    ...provider,
    id: `model:${index.toString(16).padStart(32, "0")}`,
    model: `model-${index}`,
  }));

  assert.throws(
    () => parseLocalProvidersSnapshot(validLedger({ providers }), { nowMs: NOW_MS }),
    /Local providers data is malformed/,
  );
});

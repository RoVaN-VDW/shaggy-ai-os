import assert from "node:assert/strict";
import { test } from "node:test";

import { buildSystemStatusModel } from "../../src/features/command-center/system-status-model.ts";

test("system status reports authenticated and allowlisted only from authorized evidence", () => {
  const checkedAt = "2026-07-15T09:00:00.000Z";
  const statuses = buildSystemStatusModel({
    auth: { status: "authorized", hasSession: true, checkedAt, error: null },
    resources: [],
  });

  assert.deepEqual(statuses[0], {
    label: "Session",
    value: "Authenticated",
    tone: "success",
    evidence: `supabase:auth · ${checkedAt}`,
  });
  assert.deepEqual(statuses[1], {
    label: "Access policy",
    value: "Allowlisted",
    tone: "success",
    evidence: `supabase:is_shaggy_authorized · ${checkedAt}`,
  });
});

test("system status separates an authenticated session from a blocked allowlist decision", () => {
  const checkedAt = "2026-07-15T09:05:00.000Z";
  const statuses = buildSystemStatusModel({
    auth: { status: "forbidden", hasSession: true, checkedAt, error: null },
    resources: [],
  });

  assert.equal(statuses[0].value, "Authenticated");
  assert.equal(statuses[0].tone, "success");
  assert.equal(statuses[1].value, "Blocked");
  assert.equal(statuses[1].tone, "error");
  assert.match(statuses[1].evidence, /is_shaggy_authorized/);
});

test("allowlist verification failure preserves session truth but never claims access", () => {
  const checkedAt = "2026-07-15T09:10:00.000Z";
  const statuses = buildSystemStatusModel({
    auth: { status: "error", hasSession: true, checkedAt, error: "rpc unavailable" },
    resources: [],
  });

  assert.equal(statuses[0].value, "Authenticated");
  assert.equal(statuses[0].tone, "success");
  assert.equal(statuses[1].value, "Verification unavailable");
  assert.equal(statuses[1].tone, "error");
  assert.match(statuses[1].evidence, /rpc unavailable/);
});

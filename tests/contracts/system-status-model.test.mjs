import assert from "node:assert/strict";
import { test } from "node:test";

import { buildSystemStatusModel } from "../../src/features/command-center/system-status-model.ts";

test("system status reports local runtime and owner access only from authorized loopback evidence", () => {
  const checkedAt = "2026-07-15T09:00:00.000Z";
  const statuses = buildSystemStatusModel({
    auth: { status: "authorized", hasSession: true, checkedAt, error: null },
    resources: [],
  });

  assert.deepEqual(statuses[0], {
    label: "Runtime",
    value: "Local only",
    tone: "success",
    evidence: `loopback-host-policy · ${checkedAt}`,
  });
  assert.deepEqual(statuses[1], {
    label: "Access policy",
    value: "Local owner",
    tone: "success",
    evidence: `local-owner · ${checkedAt}`,
  });
});

test("system status reports a blocked non-local runtime without claiming a session", () => {
  const checkedAt = "2026-07-15T09:05:00.000Z";
  const statuses = buildSystemStatusModel({
    auth: { status: "forbidden", hasSession: false, checkedAt, error: "non-loopback-host" },
    resources: [],
  });

  assert.equal(statuses[0].label, "Runtime");
  assert.equal(statuses[0].value, "Blocked");
  assert.equal(statuses[0].tone, "error");
  assert.equal(statuses[1].value, "Denied");
  assert.match(statuses[1].evidence, /non-loopback-host/);
});

test("local access verification failure never claims owner access", () => {
  const checkedAt = "2026-07-15T09:10:00.000Z";
  const statuses = buildSystemStatusModel({
    auth: { status: "error", hasSession: false, checkedAt, error: "host unavailable" },
    resources: [],
  });

  assert.equal(statuses[0].value, "Verification unavailable");
  assert.equal(statuses[0].tone, "error");
  assert.equal(statuses[1].value, "Unavailable");
  assert.match(statuses[0].evidence, /host unavailable/);
});

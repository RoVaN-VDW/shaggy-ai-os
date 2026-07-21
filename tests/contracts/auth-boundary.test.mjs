import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  canAccessCockpitData,
  resolveAuthBoundaryState,
} from "../../src/lib/auth/auth-boundary.ts";

const serverAuthUrl = new URL("../../src/lib/local/server.ts", import.meta.url);

test("auth boundary requires explicit allowlist proof before authorizing cockpit access", () => {
  assert.equal(resolveAuthBoundaryState({ hasSession: false, allowlisted: null, error: null }), "anonymous");
  assert.equal(resolveAuthBoundaryState({ hasSession: true, allowlisted: null, error: null }), "checking");
  assert.equal(resolveAuthBoundaryState({ hasSession: true, allowlisted: false, error: null }), "forbidden");
  assert.equal(resolveAuthBoundaryState({ hasSession: true, allowlisted: true, error: null }), "authorized");
  assert.equal(resolveAuthBoundaryState({ hasSession: true, allowlisted: null, error: "rpc unavailable" }), "error");
});

test("cockpit data access stays closed for every state except authorized", () => {
  assert.equal(canAccessCockpitData("checking"), false);
  assert.equal(canAccessCockpitData("anonymous"), false);
  assert.equal(canAccessCockpitData("forbidden"), false);
  assert.equal(canAccessCockpitData("error"), false);
  assert.equal(canAccessCockpitData("authorized"), true);
});

test("local route verification delegates to the fail-closed loopback policy", async () => {
  const source = await readFile(serverAuthUrl, "utf8");

  assert.match(source, /export async function requireLocalAccess/);
  assert.match(source, /resolveLocalAccess/);
  assert.match(source, /status:\s*403/);
  assert.doesNotMatch(source, /supabase|service.role/i);
});

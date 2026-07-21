import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const routeUrl = new URL("../../src/app/api/providers/route.ts", import.meta.url);

test("local providers route is rate-limited, owner-gated, no-store and fail-closed", async () => {
  const source = await readFile(routeUrl, "utf8");

  assert.match(source, /rateLimit\(/);
  assert.match(source, /requireLocalAccess\(req\)/);
  assert.match(source, /readLocalUsageLedger\(PROVIDER_INVENTORY_DAYS\)/);
  assert.match(source, /parseLocalProvidersSnapshot\(ledger\)/);
  assert.match(source, /const PROVIDER_INVENTORY_DAYS = 400/);
  assert.match(source, /Cache-Control": "no-store"/);
  assert.match(source, /status: 503/);
  assert.match(source, /Provider inventory is unavailable/);

  const rateLimitIndex = source.indexOf("rateLimit(");
  const guardIndex = source.indexOf("requireLocalAccess(req)");
  const readIndex = source.indexOf("readLocalUsageLedger(PROVIDER_INVENTORY_DAYS)");
  const parseIndex = source.indexOf("parseLocalProvidersSnapshot(ledger)");
  assert.ok(guardIndex < rateLimitIndex, "owner auth must run before the shared rate limit");
  assert.ok(rateLimitIndex < readIndex, "rate limit must run before the collector read");
  assert.ok(readIndex < parseIndex, "collector output must be parsed before response");

  assert.doesNotMatch(source, /supabase/i);
  assert.doesNotMatch(source, /error\.message|String\(error\)|socketPath/);
});

test("local providers route returns explicit source and observedAt provenance", async () => {
  const source = await readFile(routeUrl, "utf8");

  assert.match(source, /source: snapshot\.source/);
  assert.match(source, /observedAt: snapshot\.observedAt/);
  assert.match(source, /truncated: false/);
  assert.match(source, /providers: snapshot\.providers/);
});

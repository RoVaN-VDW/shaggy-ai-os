import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const routeUrl = new URL("../../src/app/api/activity/route.ts", import.meta.url);

test("local activity route is owner-gated, rate-limited, no-store and fail-closed", async () => {
  const source = await readFile(routeUrl, "utf8");

  assert.match(source, /requireLocalAccess\(req\)/);
  assert.match(source, /rateLimit\(req, "local-activity", 60\)/);
  assert.match(source, /readLocalUsageLedger\(ACTIVITY_WINDOW_DAYS\)/);
  assert.match(source, /parseLocalActivitySnapshot\(ledger\)/);
  assert.match(source, /const ACTIVITY_WINDOW_DAYS = 30/);
  assert.match(source, /Cache-Control": "no-store"/);
  assert.match(source, /status: 503/);
  assert.match(source, /Activity feed is unavailable/);

  const guardIndex = source.indexOf("requireLocalAccess(req)");
  const rateLimitIndex = source.indexOf("rateLimit(");
  const readIndex = source.indexOf("readLocalUsageLedger(ACTIVITY_WINDOW_DAYS)");
  assert.ok(guardIndex < rateLimitIndex, "owner auth must run before the shared rate limit");
  assert.ok(rateLimitIndex < readIndex, "rate limit must run before the collector read");
  assert.doesNotMatch(source, /supabase/i);
  assert.doesNotMatch(source, /error\.message|String\(error\)|socketPath/);
});

test("local activity route returns explicit provenance and bounded activity", async () => {
  const source = await readFile(routeUrl, "utf8");

  assert.match(source, /source: snapshot\.source/);
  assert.match(source, /observedAt: snapshot\.observedAt/);
  assert.match(source, /truncated: false/);
  assert.match(source, /activity: snapshot\.activity/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { resolveLocalAccess } from "../../src/lib/local/access.ts";

const packageUrl = new URL("../../package.json", import.meta.url);
const authGateUrl = new URL("../../src/components/auth-gate.tsx", import.meta.url);
const secondBrainHookUrl = new URL("../../src/hooks/useSecondBrainSnapshot.ts", import.meta.url);
const secondBrainRouteUrl = new URL("../../src/app/api/second-brain/route.ts", import.meta.url);
const trustFooterUrl = new URL("../../src/features/command-center/components/TrustFooter.tsx", import.meta.url);

test("local access authorizes loopback reads and rejects missing or network hosts", () => {
  assert.deepEqual(
    resolveLocalAccess({ host: "localhost:3010", origin: null, method: "GET" }),
    { authorized: true, reason: "loopback-read" },
  );
  assert.equal(resolveLocalAccess({ host: "127.0.0.1:3010", origin: null, method: "HEAD" }).authorized, true);
  assert.equal(resolveLocalAccess({ host: "[::1]:3010", origin: null, method: "GET" }).authorized, true);
  assert.deepEqual(
    resolveLocalAccess({ host: "192.168.1.24:3010", origin: null, method: "GET" }),
    { authorized: false, reason: "non-loopback-host" },
  );
  assert.deepEqual(
    resolveLocalAccess({ host: null, origin: null, method: "GET" }),
    { authorized: false, reason: "missing-host" },
  );
});

test("local mutations require a same-origin loopback origin", () => {
  assert.deepEqual(
    resolveLocalAccess({ host: "localhost:3010", origin: "http://localhost:3010", method: "POST" }),
    { authorized: true, reason: "loopback-mutation" },
  );
  assert.equal(resolveLocalAccess({ host: "localhost:3010", origin: null, method: "DELETE" }).authorized, false);
  assert.equal(
    resolveLocalAccess({ host: "localhost:3010", origin: "https://attacker.example", method: "POST" }).authorized,
    false,
  );
  assert.equal(
    resolveLocalAccess({ host: "localhost:3010", origin: "http://127.0.0.1:3010", method: "POST" }).authorized,
    false,
  );
});

test("package scripts bind Next to loopback by default", async () => {
  const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));
  assert.match(packageJson.scripts.dev, /(?:--hostname|-H)\s+127\.0\.0\.1/);
  assert.match(packageJson.scripts.start, /(?:--hostname|-H)\s+127\.0\.0\.1/);
});

test("local gate and Second Brain tracer contain no Supabase auth or bearer-token dependency", async () => {
  const [authGate, hook, route] = await Promise.all([
    readFile(authGateUrl, "utf8"),
    readFile(secondBrainHookUrl, "utf8"),
    readFile(secondBrainRouteUrl, "utf8"),
  ]);

  assert.doesNotMatch(authGate, /supabase|signInWithOtp|magic link/i);
  assert.match(authGate, /resolveLocalAccess/);
  assert.doesNotMatch(hook, /supabase|Authorization|Bearer/i);
  assert.match(hook, /fetch\("\/api\/second-brain"/);
  assert.match(route, /requireLocalAccess\(req\)/);
  assert.doesNotMatch(route, /supabase|requireAuth/);
});

test("the persistent trust footer claims loopback runtime rather than a cloud-authenticated session", async () => {
  const footer = await readFile(trustFooterUrl, "utf8");
  assert.match(footer, /Loopback-only runtime/);
  assert.doesNotMatch(footer, /Authenticated session/);
});

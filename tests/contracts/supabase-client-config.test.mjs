import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const clientUrl = new URL("../../src/lib/supabase/client.ts", import.meta.url);
const gateUrl = new URL("../../src/components/auth-gate.tsx", import.meta.url);

test("legacy Supabase browser client stays lazy while the application gate is fully local", async () => {
  const [client, gate] = await Promise.all([
    readFile(clientUrl, "utf8"),
    readFile(gateUrl, "utf8"),
  ]);

  assert.doesNotMatch(client, /export const supabase\s*=\s*createClient/);
  assert.match(client, /new Proxy/);
  assert.match(client, /Supabase browser client is not configured/);

  assert.match(gate, /resolveLocalAccess/);
  assert.match(gate, /useSyncExternalStore/);
  assert.doesNotMatch(gate, /supabase|signInWithOtp|magic link|isSupabaseClientConfigured/i);
});

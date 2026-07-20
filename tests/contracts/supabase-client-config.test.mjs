import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const clientUrl = new URL("../../src/lib/supabase/client.ts", import.meta.url);
const gateUrl = new URL("../../src/components/auth-gate.tsx", import.meta.url);

test("Supabase browser client initializes lazily and fails closed when configuration is absent", async () => {
  const [client, gate] = await Promise.all([
    readFile(clientUrl, "utf8"),
    readFile(gateUrl, "utf8"),
  ]);

  assert.doesNotMatch(client, /export const supabase\s*=\s*createClient/);
  assert.match(client, /export function isSupabaseClientConfigured/);
  assert.match(client, /new Proxy/);
  assert.match(client, /Supabase browser client is not configured/);
  assert.match(gate, /isSupabaseClientConfigured\(\)/);
  assert.match(gate, /Supabase browser configuration is unavailable/);
});

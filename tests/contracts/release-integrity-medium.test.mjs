import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migrationUrl = new URL("../../supabase/migrations/20260719020000_release_integrity.sql", import.meta.url);
const usageUrl = new URL("../../src/app/api/llm/usage/event/route.ts", import.meta.url);
const modelsUrl = new URL("../../src/app/models/page.tsx", import.meta.url);
const securityUrl = new URL("../../src/lib/api/security.ts", import.meta.url);
const nextConfigUrl = new URL("../../next.config.ts", import.meta.url);

test("Release migration enforces a private knowledge bucket and global-plus-project RAG", async () => {
  const source = await readFile(migrationUrl, "utf8");
  assert.match(source, /INSERT INTO storage\.buckets[\s\S]*'knowledge'[\s\S]*false/);
  assert.match(source, /UPDATE storage\.buckets[\s\S]*public\s*=\s*false[\s\S]*id\s*=\s*'knowledge'/);
  assert.match(source, /CREATE POLICY "Authorized knowledge object access"/);
  assert.match(source, /p_project_id IS NULL\s+AND kc\.project_id IS NULL/);
  assert.match(
    source,
    /p_project_id IS NOT NULL[\s\S]*kc\.project_id IS NULL\s+OR kc\.project_id = p_project_id/,
  );
  assert.match(source, /STABLE\s+SET search_path = ''/);
});

test("Client-submitted usage is stored and presented as an estimate", async () => {
  const [migration, usage, models] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(usageUrl, "utf8"),
    readFile(modelsUrl, "utf8"),
  ]);
  assert.match(migration, /trust_level/);
  assert.match(usage, /trust_level:\s*"client-reported"/);
  assert.match(usage, /trust:\s*"client-reported-estimate"/);
  assert.match(models, /Client-reported events are estimates/);
});

test("Best-effort local rate limiter does not trust arbitrary x-forwarded-for and prunes buckets", async () => {
  const source = await readFile(securityUrl, "utf8");
  assert.doesNotMatch(source, /headers\.get\("x-forwarded-for"\)/);
  assert.match(source, /x-vercel-forwarded-for/);
  assert.match(source, /pruneExpiredBuckets/);
  assert.match(source, /MAX_RATE_LIMIT_BUCKETS/);
});

test("Production CSP excludes unsafe-eval while development keeps Next.js debugging support", async () => {
  const source = await readFile(nextConfigUrl, "utf8");
  assert.match(source, /isDevelopment/);
  assert.match(source, /isDevelopment\s*\?\s*["'] 'unsafe-eval'["']\s*:\s*["']["']/);
  assert.doesNotMatch(source, /script-src 'self' 'unsafe-inline' 'unsafe-eval'/);
});

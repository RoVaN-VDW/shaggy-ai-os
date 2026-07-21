import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const routeUrl = new URL("../../src/app/api/projects/route.ts", import.meta.url);

test("projects API guards local access before reading and always disables caching", async () => {
  const source = await readFile(routeUrl, "utf8");
  const guardIndex = source.indexOf("requireLocalAccess(req)");
  const readIndex = source.indexOf("readAll()");

  assert.ok(guardIndex >= 0 && readIndex > guardIndex);
  assert.match(source, /rateLimit\(req, "local-projects",/);
  assert.match(source, /dynamic\s*=\s*["']force-dynamic["']/);
  assert.match(source, /Cache-Control["']?\s*:\s*["']no-store/);
  assert.match(source, /status:\s*503/);
  assert.doesNotMatch(source, /supabase/i);
});

test("projects POST validates a bounded idempotent same-origin mutation before one atomic create", async () => {
  const source = await readFile(routeUrl, "utf8");
  const postBody = source.slice(source.indexOf("export async function POST"));

  assert.notEqual(source.indexOf("export async function POST"), -1);
  assert.ok(postBody.indexOf("requireLocalAccess(req)") < postBody.indexOf("req.text()"));
  assert.match(postBody, /MAX_MUTATION_BODY_BYTES/);
  assert.match(postBody, /Idempotency-Key/i);
  assert.match(postBody, /projectsStore\.create/);
  assert.match(postBody, /status: result\.replayed \? 200 : 201/);
  assert.match(postBody, /ProjectsMutationConflictError/);
  assert.match(postBody, /status: 409/);
  assert.match(postBody, /Cache-Control["']?\s*:\s*["']no-store/);
});

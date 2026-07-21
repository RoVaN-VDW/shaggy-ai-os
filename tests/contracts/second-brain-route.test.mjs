import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const routeUrl = new URL("../../src/app/api/second-brain/route.ts", import.meta.url);

test("Second Brain route verifies local access before reading a private aggregate snapshot", async () => {
  const source = await readFile(routeUrl, "utf8");
  const authIndex = source.indexOf("requireLocalAccess(req)");
  const readIndex = source.indexOf("readFile(");
  assert.ok(authIndex >= 0 && readIndex > authIndex);
  assert.match(source, /rateLimit\(req, "second-brain",/);
  assert.match(source, /parseSecondBrainSnapshot/);
  assert.match(source, /Cache-Control["']?\s*:\s*["']no-store/);
  assert.doesNotMatch(source, /rawDocument|documentBody|chatContent/);
});

test("Second Brain fails truthfully on clean deployments without shipping a private snapshot", async () => {
  const source = await readFile(routeUrl, "utf8");
  assert.match(source, /availability:\s*["']local-only["']/);
  assert.match(source, /Local Second Brain snapshot source is unavailable/);
  assert.match(source, /status:\s*503/);
});

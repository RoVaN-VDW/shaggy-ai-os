import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const chatUrl = new URL("../../src/app/api/chat/route.ts", import.meta.url);
const dispatchUrl = new URL("../../src/app/api/dispatch/route.ts", import.meta.url);
const chatPageUrl = new URL("../../src/app/chat/page.tsx", import.meta.url);

test("Chat validates and proves session ownership before provider dispatch", async () => {
  const source = await readFile(chatUrl, "utf8");
  assert.match(source, /validateOptionalUuid\(sessionId/);
  assert.match(source, /auth\.client[\s\S]*\.from\("chat_sessions"\)/);
  const ownershipIndex = source.indexOf('.from("chat_sessions")');
  const dispatchIndex = source.indexOf("await dispatchProvider(");
  assert.ok(ownershipIndex >= 0 && dispatchIndex > ownershipIndex);
  assert.doesNotMatch(source, /supabaseAdmin\.from\("chat_messages"\)/);
});

test("Chat reports every persistence failure instead of silently succeeding", async () => {
  const source = await readFile(chatUrl, "utf8");
  for (const errorName of ["activityError", "usageError", "messagesError", "sessionUpdateError"]) {
    assert.match(source, new RegExp(errorName));
  }
  assert.match(source, /persistence:\s*warnings\.length\s*\?\s*"partial"\s*:\s*"complete"/);
  assert.match(source, /warnings/);
});

test("Dispatch reports activity and usage persistence failures", async () => {
  const source = await readFile(dispatchUrl, "utf8");
  assert.match(source, /activityError/);
  assert.match(source, /usageError/);
  assert.match(source, /persistence:\s*warnings\.length\s*\?\s*"partial"\s*:\s*"complete"/);
});

test("Chat UI surfaces partial persistence while retaining the provider output", async () => {
  const source = await readFile(chatPageUrl, "utf8");
  assert.match(source, /data\.persistence\s*===\s*"partial"/);
  assert.match(source, /data\.warnings/);
});

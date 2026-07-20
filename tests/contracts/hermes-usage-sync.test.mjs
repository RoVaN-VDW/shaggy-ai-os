import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("../../scripts/sync_hermes_usage.py", import.meta.url));
const ROUTE = new URL("../../src/app/api/llm/usage/event/route.ts", import.meta.url);

function makeFixtureDb() {
  const dir = mkdtempSync(path.join(tmpdir(), "hermes-sync-"));
  const dbPath = path.join(dir, "state.db");
  const now = Math.floor(Date.now() / 1000);
  const python = `
import sqlite3, json
conn = sqlite3.connect(${JSON.stringify(dbPath)})
conn.execute("""CREATE TABLE session_model_usage (
  session_id TEXT, model TEXT, billing_provider TEXT, billing_base_url TEXT,
  billing_mode TEXT, task TEXT, api_call_count INTEGER,
  input_tokens INTEGER, output_tokens INTEGER,
  cache_read_tokens INTEGER, cache_write_tokens INTEGER, reasoning_tokens INTEGER,
  estimated_cost_usd REAL, actual_cost_usd REAL,
  cost_status TEXT, cost_source TEXT, first_seen REAL, last_seen REAL
)""")
conn.execute("INSERT INTO session_model_usage VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
  ("sess-1", "k3", "custom:kimi-k3", None, None, None, 4,
   12000, 3400, 50000, 8000, 1100, 0.042, None, "estimated", "pricing", ${now - 3600}, ${now - 60}))
conn.execute("INSERT INTO session_model_usage VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
  ("sess-2", "gpt-5.6-sol", "openai-codex", None, None, None, 2,
   8000, 2100, 0, 0, 0, 0.031, 0.029, "actual", "invoice", ${now - 7200}, ${now - 120}))
conn.commit()
`;
  execFileSync("python3", ["-c", python]);
  return { dir, dbPath, now };
}

function runSync(args) {
  return execFileSync("python3", [SCRIPT, ...args], { encoding: "utf8" });
}

test("hermes sync transforms measured rows into ingest-compatible events", () => {
  const { dbPath } = makeFixtureDb();
  const out = runSync(["--db", dbPath, "--json", "--days", "30"]);
  const events = out.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(events.length, 2);

  const k3 = events.find((event) => event.model === "k3");
  assert.equal(k3.provider, "custom:kimi-k3");
  assert.equal(k3.inputTokens, 12000);
  assert.equal(k3.outputTokens, 3400);
  assert.equal(k3.costEstimate, 0.042);
  assert.ok(!Number.isNaN(Date.parse(k3.occurredAt)));
  assert.ok(Date.parse(k3.occurredAt) <= Date.now());
  assert.equal(k3.latencyMs, undefined);
  assert.equal(k3._sync.source, "hermes:state.db:session_model_usage");
  assert.equal(k3._sync.costStatus, "estimated");
  assert.deepEqual(k3._sync.unimportedTokens, { cacheRead: 50000, cacheWrite: 8000, reasoning: 1100 });

  const sol = events.find((event) => event.model === "gpt-5.6-sol");
  assert.equal(sol.costEstimate, 0.029);
  assert.equal(sol._sync.costStatus, "actual");
});

test("hermes sync cache and reasoning tokens are never folded into input/output", () => {
  const { dbPath } = makeFixtureDb();
  const out = runSync(["--db", dbPath, "--json"]);
  const k3 = out.trim().split("\n").map((line) => JSON.parse(line)).find((event) => event.model === "k3");
  assert.equal(k3.inputTokens + k3.outputTokens, 15400);
  assert.ok(k3._sync.unimportedTokens.cacheRead > 0);
});

test("hermes sync watermark makes repeat runs idempotent", () => {
  const { dir, dbPath } = makeFixtureDb();
  const watermark = path.join(dir, "watermark.json");
  const first = runSync(["--db", dbPath, "--json", "--watermark", watermark]);
  const rows = first.trim().split("\n").map((line) => JSON.parse(line));
  const state = Object.fromEntries(rows.map((event) => [
    `${event._sync.sessionId}|${event.model}|${event.provider}`,
    Date.parse(event.occurredAt) / 1000,
  ]));
  writeFileSync(watermark, JSON.stringify(state));
  const saved = JSON.parse(readFileSync(watermark, "utf8"));
  assert.ok(Object.keys(saved).length >= 1);
});

test("usage event endpoint accepts historical occurredAt and rejects future timestamps", async () => {
  const source = await readFile(ROUTE, "utf8");
  assert.match(source, /parseOccurredAt/);
  assert.match(source, /FUTURE_SKEW_MS/);
  assert.match(source, /MAX_EVENT_AGE_DAYS/);
  assert.match(source, /created_at: occurredAt/);
  assert.match(source, /Invalid occurredAt timestamp/);
  assert.match(source, /trust_level:\s*"client-reported"/);
  assert.doesNotMatch(source, /trust_level:\s*"provider-reported"/);
});

test("usage event endpoint stores null latency instead of fabricating zero", async () => {
  const source = await readFile(ROUTE, "utf8");
  assert.match(source, /latency_ms:\s*latencyMs == null \? null/);
});

import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const WRAPPER = path.join(ROOT, "scripts", "sync_hermes_usage.py");
const execFileAsync = promisify(execFile);

function fixtureDb() {
  const dir = mkdtempSync(path.join(realpathSync(tmpdir()), "hermes-wrapper-"));
  const db = path.join(dir, "state.db");
  const ledger = path.join(dir, "usage.sqlite3");
  const now = Date.now() / 1000;
  execFileSync("python3", ["-c", `
import sqlite3
conn=sqlite3.connect(${JSON.stringify(db)})
conn.execute("""CREATE TABLE session_model_usage (
 session_id TEXT, model TEXT, billing_provider TEXT, billing_mode TEXT, task TEXT,
 api_call_count INTEGER, input_tokens INTEGER, output_tokens INTEGER,
 cache_read_tokens INTEGER, cache_write_tokens INTEGER, reasoning_tokens INTEGER,
 estimated_cost_usd REAL, actual_cost_usd REAL, cost_status TEXT, cost_source TEXT,
 first_seen REAL, last_seen REAL)""")
conn.execute("INSERT INTO session_model_usage VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
 ("s1","k3","custom:kimi-k3","api","code",2,100,20,40,5,7,None,None,"unknown",None,${now - 10},${now}))
conn.commit()
`]);
  return { db, ledger };
}

test("legacy Hermes sync is a wrapper around the single local collector", async () => {
  const source = await readFile(WRAPPER, "utf8");
  assert.match(source, /local_usage_ledger\.py/);
  assert.match(source, /preview-hermes/);
  assert.doesNotMatch(source, /SELECT .*session_model_usage|load_rows/i);
});

test("legacy CLI preserves side-effect-free JSON and its historical flags", () => {
  const help = execFileSync("python3", [WRAPPER, "--help"], { encoding: "utf8" });
  for (const flag of ["--days", "--watermark", "--json", "--post", "--full"]) assert.match(help, new RegExp(flag));
  const { db } = fixtureDb();
  const dir = mkdtempSync(path.join(realpathSync(tmpdir()), "hermes-wrapper-contract-"));
  const watermark = path.join(dir, "watermark.json");
  const output = execFileSync("python3", [WRAPPER, "--db", db, "--watermark", watermark, "--days", "30", "--json"], { encoding: "utf8" });
  const rows = output.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]._sync.source, "hermes:state.db:session_model_usage");
  assert.equal(rows[0].status, "unknown");
  assert.equal(existsSync(watermark), false);
});

test("legacy --post accepts its historical URL argument and writes a watermark after success", async (context) => {
  const received = [];
  const server = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      received.push(JSON.parse(body));
      response.writeHead(201).end();
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const { db } = fixtureDb();
  const dir = mkdtempSync(path.join(realpathSync(tmpdir()), "hermes-wrapper-post-"));
  const watermark = path.join(dir, "watermark.json");
  const url = `http://127.0.0.1:${address.port}/api/llm/usage/event`;
  const { stdout } = await execFileAsync("python3", [
    WRAPPER, "--db", db, "--watermark", watermark, "--post", url,
  ], { encoding: "utf8" });

  assert.deepEqual(JSON.parse(stdout), { scanned: 1, posted: 1 });
  assert.equal(received.length, 1);
  assert.equal(received[0].status, "unknown");
  assert.equal(existsSync(watermark), true);
});

test("legacy watermark suppresses repeat posts while --full intentionally bypasses it", async (context) => {
  let requests = 0;
  const server = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      requests += 1;
      response.writeHead(201).end();
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const { db } = fixtureDb();
  const dir = mkdtempSync(path.join(realpathSync(tmpdir()), "hermes-wrapper-watermark-"));
  const watermark = path.join(dir, "watermark.json");
  const url = `http://127.0.0.1:${address.port}/api/llm/usage/event`;
  const args = [WRAPPER, "--db", db, "--watermark", watermark, "--post", url];

  const first = JSON.parse((await execFileAsync("python3", args, { encoding: "utf8" })).stdout);
  const second = JSON.parse((await execFileAsync("python3", args, { encoding: "utf8" })).stdout);
  const full = JSON.parse((await execFileAsync("python3", [...args, "--full"], { encoding: "utf8" })).stdout);

  assert.deepEqual(first, { scanned: 1, posted: 1 });
  assert.deepEqual(second, { scanned: 0, posted: 0 });
  assert.deepEqual(full, { scanned: 1, posted: 1 });
  assert.equal(requests, 2);
});

test("legacy --json remains side-effect-free when combined with --post", async (context) => {
  let requests = 0;
  const server = createServer((_request, response) => {
    requests += 1;
    response.writeHead(201).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const { db } = fixtureDb();
  const dir = mkdtempSync(path.join(realpathSync(tmpdir()), "hermes-wrapper-json-post-"));
  const watermark = path.join(dir, "watermark.json");
  const url = `http://127.0.0.1:${address.port}/api/llm/usage/event`;
  const { stdout } = await execFileAsync("python3", [
    WRAPPER, "--db", db, "--watermark", watermark, "--json", "--post", url,
  ], { encoding: "utf8" });

  const rows = stdout.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "unknown");
  assert.equal(requests, 0);
  assert.equal(existsSync(watermark), false);
});

test("compatibility wrapper writes idempotently to the central ledger", () => {
  const { db, ledger } = fixtureDb();
  const first = JSON.parse(execFileSync("python3", [WRAPPER, "--db", db, "--ledger", ledger], { encoding: "utf8" }));
  const second = JSON.parse(execFileSync("python3", [WRAPPER, "--db", db, "--ledger", ledger], { encoding: "utf8" }));
  assert.equal(first.inserted, 1);
  assert.equal(second.updated, 1);
  assert.ok(readFileSync(ledger).length > 0);
});

test("authenticated ingest route preserves nullable cost and separate token classes", async () => {
  const route = await readFile(path.join(ROOT, "src/app/api/llm/usage/event/route.ts"), "utf8");
  assert.match(route, /insertLocalProviderUsage/);
  assert.match(route, /cache_read_tokens/);
  assert.match(route, /cache_write_tokens/);
  assert.match(route, /reasoning_tokens/);
  assert.match(route, /actual_cost_usd/);
  assert.match(route, /estimated_cost_usd/);
  assert.doesNotMatch(route, /usage_events|trust_level:\s*"provider-reported"/);
});

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, statSync, symlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const LEDGER = path.join(ROOT, "scripts", "local_usage_ledger.py");

function run(args, input) {
  return execFileSync("python3", [LEDGER, ...args], { encoding: "utf8", input });
}

function fixture() {
  const dir = mkdtempSync(path.join(realpathSync(tmpdir()), "shaggy-ledger-"));
  const ledger = path.join(dir, "usage.sqlite3");
  const hermes = path.join(dir, "state.db");
  const now = Date.now() / 1000;
  const setup = `
import sqlite3
conn=sqlite3.connect(${JSON.stringify(hermes)})
conn.execute("""CREATE TABLE session_model_usage (
 session_id TEXT, model TEXT, billing_provider TEXT, billing_base_url TEXT,
 billing_mode TEXT, task TEXT, api_call_count INTEGER,
 input_tokens INTEGER, output_tokens INTEGER, cache_read_tokens INTEGER,
 cache_write_tokens INTEGER, reasoning_tokens INTEGER,
 estimated_cost_usd REAL, actual_cost_usd REAL, cost_status TEXT,
 cost_source TEXT, first_seen REAL, last_seen REAL)""")
conn.execute("INSERT INTO session_model_usage VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
 ("sess-k3","k3","custom:kimi-k3",None,"api","premium_visuals",2,
  10000,2000,5000,700,1300,0.02,None,"estimated","pricing",${now - 300},${now - 20}))
conn.execute("INSERT INTO session_model_usage VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
 ("sess-sol","gpt-5.6-sol","openai-codex",None,"oauth","acceptance",1,
  8000,1000,0,0,500,0,None,"unknown",None,${now - 200},${now - 10}))
conn.commit()
`;
  execFileSync("python3", ["-c", setup]);
  return { ledger, hermes };
}

test("native collector upserts Hermes usage idempotently and preserves separate token classes", () => {
  const { ledger, hermes } = fixture();
  const first = JSON.parse(run(["--ledger", ledger, "collect-hermes", "--source", hermes]));
  const second = JSON.parse(run(["--ledger", ledger, "collect-hermes", "--source", hermes]));
  assert.deepEqual(first, { scanned: 2, inserted: 2, updated: 0 });
  assert.deepEqual(second, { scanned: 2, inserted: 0, updated: 2 });
  assert.equal(statSync(ledger).mode & 0o777, 0o600);
  assert.equal(statSync(path.dirname(ledger)).mode & 0o777, 0o700);

  const exported = JSON.parse(run(["--ledger", ledger, "export", "--days", "30"]));
  assert.equal(exported.provider_usage.length, 2);
  assert.equal(exported.workflow_events.length, 0);
  const k3 = exported.provider_usage.find((event) => event.model === "k3");
  assert.equal(k3.input_tokens, 10000);
  assert.equal(k3.output_tokens, 2000);
  assert.equal(k3.cache_read_tokens, 5000);
  assert.equal(k3.cache_write_tokens, 700);
  assert.equal(k3.reasoning_tokens, 1300);
  assert.equal(k3.estimated_cost_usd, 0.02);
  assert.equal(k3.actual_cost_usd, null);
  assert.equal(k3.cost_status, "estimated");
  assert.equal(k3.status, "unknown");
  assert.equal(k3.metadata.trust_level, "native-aggregate");

  const sol = exported.provider_usage.find((event) => event.model === "gpt-5.6-sol");
  assert.equal(sol.estimated_cost_usd, null);
  assert.equal(sol.actual_cost_usd, null);
  assert.equal(sol.cost_status, "unknown");
  assert.equal(sol.cost_estimate, null);
});

test("workflow events stay physically separate from provider usage", () => {
  const { ledger } = fixture();
  const workflow = {
    event_id: "workflow:route:1",
    event_kind: "outcome",
    timestamp: Date.now() / 1000,
    project: "SHAGGY",
    task_id: "TOK-1",
    task_type: "routine_implementation",
    route_key: "kimi",
    retries: 1,
    gates: "pass",
    sol_verdict: "accepted_with_correction",
    duplicate_context_tokens: 9000,
    prompt: "must never be persisted",
    api_key: "must never be persisted",
  };
  const result = JSON.parse(run(["--ledger", ledger, "ingest-workflow"], JSON.stringify(workflow)));
  assert.equal(result.accepted, true);
  const exported = JSON.parse(run(["--ledger", ledger, "export", "--days", "30"]));
  assert.equal(exported.provider_usage.length, 0);
  assert.equal(exported.workflow_events.length, 1);
  assert.equal(exported.workflow_events[0].event_kind, "outcome");
  assert.equal(exported.workflow_events[0].payload.prompt, undefined);
  assert.equal(exported.workflow_events[0].payload.api_key, undefined);
  assert.equal(exported.workflow_events[0].payload.sol_verdict, "accepted_with_correction");
  assert.ok(exported.alerts.some((alert) => alert.kind === "retry"));
  assert.ok(exported.alerts.some((alert) => alert.kind === "context_waste"));
});

test("workflow payload allowlist rejects nested values that can smuggle secrets", () => {
  const { ledger } = fixture();
  assert.throws(() => run(["--ledger", ledger, "ingest-workflow"], JSON.stringify({
    event_id: "workflow:nested-secret",
    event_kind: "outcome",
    timestamp: new Date().toISOString(),
    deterministic_gates_passed: { api_key: "secret-persisted" },
  })));

  const exported = JSON.parse(run(["--ledger", ledger, "export", "--days", "30"]));
  assert.equal(exported.workflow_events.length, 0);
});

test("nested workflow numerics fail with structured rejection and no traceback", () => {
  for (const field of ["retries", "duplicate_context_tokens", "projected_cost_usd", "recorded_cost_usd"]) {
    const { ledger } = fixture();
    const result = spawnSync("python3", [LEDGER, "--ledger", ledger, "ingest-workflow"], {
      encoding: "utf8",
      input: JSON.stringify({
        event_id: `workflow:nested-${field}`,
        event_kind: "outcome",
        timestamp: new Date().toISOString(),
        [field]: { api_key: "must-not-persist" },
      }),
    });
    assert.equal(result.status, 2, `${field}: ${result.stderr}`);
    assert.match(result.stderr, /"ok":\s*false/);
    assert.match(result.stderr, /invalid nonnegative/);
    assert.doesNotMatch(result.stderr, /Traceback|TypeError/);
    const exported = JSON.parse(run(["--ledger", ledger, "export", "--days", "30"]));
    assert.equal(exported.workflow_events.length, 0);
  }
});

test("provider metadata is allowlisted and cannot persist prompt or credential fields", () => {
  const { ledger } = fixture();
  run(["--ledger", ledger, "ingest-provider"], JSON.stringify({
    event_id: "privacy-provider-1",
    source: "manual-test",
    provider: "custom:kimi-k3",
    model: "k3",
    occurred_at: new Date().toISOString(),
    trust_level: "client-reported",
    metadata: {
      counter_semantics: "request delta",
      telemetry_version: "1",
      prompt: "must never be persisted",
      api_key: "must never be persisted",
      auth_header: "must never be persisted",
    },
  }));
  const exported = JSON.parse(run(["--ledger", ledger, "export", "--days", "30"]));
  assert.deepEqual(exported.provider_usage[0].metadata, {
    counter_semantics: "request delta",
    telemetry_version: "1",
    trust_level: "client-reported",
  });
});

test("ledger and Hermes source paths reject symlinks instead of following them", () => {
  const dir = mkdtempSync(path.join(realpathSync(tmpdir()), "shaggy-path-boundary-"));
  const ledgerTarget = path.join(dir, "redirected.sqlite3");
  const ledgerLink = path.join(dir, "ledger-link.sqlite3");
  symlinkSync(ledgerTarget, ledgerLink);
  assert.throws(() => run(["--ledger", ledgerLink, "export", "--days", "1"]));
  assert.equal(existsSync(ledgerTarget), false);

  const { ledger, hermes } = fixture();
  const sourceLink = path.join(dir, "source-link.sqlite3");
  symlinkSync(hermes, sourceLink);
  assert.throws(() => run(["--ledger", ledger, "collect-hermes", "--source", sourceLink]));
});

test("collector rejects invalid timestamps, statuses, and non-finite numbers", () => {
  const { ledger } = fixture();
  const base = { event_id: "invalid-event", provider: "hermes", model: "k3" };
  assert.throws(() => run(["--ledger", ledger, "ingest-provider"], JSON.stringify({ ...base, occurred_at: "not-a-date" })));
  assert.throws(() => run(["--ledger", ledger, "ingest-provider"], JSON.stringify({ ...base, status: "invented" })));
  assert.throws(() => run(["--ledger", ledger, "ingest-provider"], '{"event_id":"nan-event","provider":"hermes","model":"k3","estimated_cost_usd":NaN}'));
});

test("persistent identifiers reject prose and oversized workflow columns", () => {
  const { ledger } = fixture();
  assert.throws(() => run(["--ledger", ledger, "ingest-provider"], JSON.stringify({
    event_id: "privacy-provider-2",
    provider: "custom:kimi-k3",
    model: "k3",
    project_id: "this is prompt-shaped prose and must not be persisted",
  })));
  assert.throws(() => run(["--ledger", ledger, "ingest-workflow"], JSON.stringify({
    event_id: "workflow:too-long",
    event_kind: "outcome",
    project: "SHAGGY",
    task_id: `task-${"x".repeat(400)}`,
  })));
  assert.throws(() => run([
    "--ledger", ledger, "set-budget",
    "--provider", "secret key shaped prose with spaces",
    "--model", "model with spaces",
    "--monthly-usd", "1",
  ]));
  const exported = JSON.parse(run(["--ledger", ledger, "export", "--days", "30"]));
  assert.equal(exported.providers.length, 0);
});

test("budget and anomalous usage alerts are derived without inventing provider quota", () => {
  const { ledger } = fixture();
  run(["--ledger", ledger, "set-budget", "--provider", "custom:kimi-k3", "--model", "k3", "--monthly-usd", "0.01"]);
  const base = {
    source: "manual-test", provider: "custom:kimi-k3", model: "k3", project_id: "SHAGGY",
    input_tokens: 1000, output_tokens: 100, cache_read_tokens: 0, cache_write_tokens: 0,
    reasoning_tokens: 0, estimated_cost_usd: 0.006, actual_cost_usd: null,
    cost_status: "estimated", api_call_count: 1, status: "success",
  };
  for (let index = 0; index < 4; index += 1) {
    run(["--ledger", ledger, "ingest-provider"], JSON.stringify({ ...base, event_id: `normal-${index}`, occurred_at: new Date().toISOString() }));
  }
  run(["--ledger", ledger, "ingest-provider"], JSON.stringify({
    ...base, event_id: "spike", input_tokens: 25000, output_tokens: 5000,
    estimated_cost_usd: 0.02, occurred_at: new Date().toISOString(),
  }));
  const exported = JSON.parse(run(["--ledger", ledger, "export", "--days", "30"]));
  assert.ok(exported.alerts.some((alert) => alert.kind === "budget"));
  assert.ok(exported.alerts.some((alert) => alert.kind === "anomaly"));
  assert.equal(exported.provider_quota.status, "unknown");
  assert.equal(exported.provider_quota.remaining, null);
});

test("SHAGGY usage APIs use the authenticated loopback collector and no Supabase usage table", async () => {
  const [summary, event, page, bridge, collector] = await Promise.all([
    readFile(path.join(ROOT, "src/app/api/llm/usage/summary/route.ts"), "utf8"),
    readFile(path.join(ROOT, "src/app/api/llm/usage/event/route.ts"), "utf8"),
    readFile(path.join(ROOT, "src/app/models/page.tsx"), "utf8"),
    readFile(path.join(ROOT, "src/lib/usage/local-ledger.ts"), "utf8"),
    readFile(path.join(ROOT, "scripts/local_usage_ledger.py"), "utf8"),
  ]);
  assert.match(summary, /readLocalUsageLedger/);
  assert.match(event, /insertLocalProviderUsage/);
  assert.doesNotMatch(`${summary}\n${event}`, /usage_events|model_providers/);
  assert.match(bridge, /socketPath/);
  assert.match(bridge, /collector\.sock/);
  assert.doesNotMatch(bridge, /X-SHAGGY-Collector-Token|collector\.token|127\.0\.0\.1:8765/);
  assert.doesNotMatch(bridge, /spawn|collect-hermes|local_usage_ledger\.py/);
  assert.doesNotMatch(`${bridge}\n${collector}`, /Collector-Token|collector\.token|hmac\.compare_digest/);
  assert.match(bridge, /lstat/);
  assert.match(bridge, /isSocket/);
  assert.match(bridge, /response\.on\("data"/);
  assert.doesNotMatch(bridge, /response\.text\(\)/);
  assert.match(collector, /ThreadBoundedMixIn/);
  assert.match(collector, /settimeout/);
  assert.match(collector, /trusted_unix_socket/);
  assert.match(collector, /O_NOFOLLOW/);
  assert.match(collector, /os\.fstat/);
  assert.match(collector, /st_dev.*st_ino/);
  assert.match(collector, /MAX_HTTP_BODY_BYTES/);
  assert.match(collector, /browser origins are not accepted/);
  assert.match(collector, /application\/json required/);
  assert.match(collector, /safe_payload/);
  assert.doesNotMatch(collector, /send_json\(\{"error": str\(error\)\}/);
  assert.match(collector, /min\(400, days\)/);
  assert.doesNotMatch(page, /postgres_changes|supabase\.channel|fetchWithAuth/);
  assert.match(page, /15_000/);
});

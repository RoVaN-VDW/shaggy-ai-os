import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { test } from "node:test";

const ORIGIN = "http://localhost:3000";
const SECONDARY_DEV_ORIGIN = "http://localhost:3001";

async function startCompanion() {
  const child = spawn("python3", ["services/voice-companion/server.py", "--mock", "--port", "0"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const lines = createInterface({ input: child.stdout });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("voice companion did not start")), 5_000);
    lines.once("line", (line) => {
      clearTimeout(timer);
      resolve(JSON.parse(line));
    });
    child.once("exit", (code) => reject(new Error(`voice companion exited early with ${code}`)));
  });
  const info = await ready;
  return { child, baseUrl: `http://127.0.0.1:${info.port}` };
}

async function stopCompanion(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await once(child, "exit");
}

test("loopback voice companion exposes health, CORS and bounded bilingual synthesis", async (t) => {
  const { child, baseUrl } = await startCompanion();
  t.after(() => stopCompanion(child));

  const health = await fetch(`${baseUrl}/health`, { headers: { Origin: ORIGIN } });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("access-control-allow-origin"), ORIGIN);
  const status = await health.json();
  assert.deepEqual(Object.keys(status.languages), ["nl-BE", "en-GB"]);
  assert.equal(status.languages["nl-BE"].voice, "Vlaamse Butler");
  assert.equal(status.languages["en-GB"].voice, "Sentinel K");

  const secondaryOrigin = await fetch(`${baseUrl}/health`, { headers: { Origin: SECONDARY_DEV_ORIGIN } });
  assert.equal(secondaryOrigin.status, 200);
  assert.equal(secondaryOrigin.headers.get("access-control-allow-origin"), SECONDARY_DEV_ORIGIN);

  const audio = await fetch(`${baseUrl}/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ language: "nl-BE", text: "Dit is een test." }),
  });
  assert.equal(audio.status, 200);
  assert.equal(audio.headers.get("content-type"), "audio/wav");
  assert.equal(Buffer.from(await audio.arrayBuffer()).subarray(0, 4).toString(), "RIFF");

  const invalid = await fetch(`${baseUrl}/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ language: "fr-FR", text: "Bonjour" }),
  });
  assert.equal(invalid.status, 400);

  const blocked = await fetch(`${baseUrl}/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
    body: JSON.stringify({ language: "en-GB", text: "No side effect." }),
  });
  assert.equal(blocked.status, 403);
});

test("production companion suppresses third-party synthesis output that can contain requested text", () => {
  const source = readFileSync(new URL("../../services/voice-companion/server.py", import.meta.url), "utf8");
  assert.match(source, /redirect_stdout\(io\.StringIO\(\)\)/);
  assert.match(source, /redirect_stderr\(io\.StringIO\(\)\)/);
});

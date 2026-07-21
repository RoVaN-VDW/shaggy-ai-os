import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const capabilityUrl = new URL("../../src/lib/local/owner-capability.ts", import.meta.url);

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "shaggy-owner-"));
  chmodSync(directory, 0o700);
  const secretPath = path.join(directory, "owner.secret");
  const pairPath = path.join(directory, "owner.pair");
  writeFileSync(secretPath, "a".repeat(64), { encoding: "ascii", mode: 0o600, flag: "wx" });
  writeFileSync(pairPath, "b".repeat(64), { encoding: "ascii", mode: 0o600, flag: "wx" });
  return { directory, secretPath, pairPath };
}

test("owner sessions are time-bounded HMAC capabilities backed by a private file", async () => {
  const { createOwnerSession, verifyOwnerSession } = await import(capabilityUrl.href);
  const { secretPath } = fixture();
  const now = Date.UTC(2026, 6, 21, 12, 0, 0);
  const cookie = await createOwnerSession(secretPath, now, 60_000);
  assert.match(cookie, /^\d+\.[a-f0-9]{64}$/);
  assert.equal(await verifyOwnerSession(secretPath, cookie, now + 59_000), true);
  assert.equal(await verifyOwnerSession(secretPath, cookie, now + 61_000), false);
  assert.equal(await verifyOwnerSession(secretPath, `${cookie.slice(0, -1)}0`, now + 1_000), false);
});

test("owner secret rejects permissive files and symlinks", async () => {
  const { createOwnerSession } = await import(capabilityUrl.href);
  const permissive = fixture();
  chmodSync(permissive.secretPath, 0o644);
  await assert.rejects(() => createOwnerSession(permissive.secretPath, Date.now(), 60_000), /private owner file/);

  const linked = fixture();
  const symlinkPath = path.join(linked.directory, "linked.secret");
  symlinkSync(linked.secretPath, symlinkPath);
  await assert.rejects(() => createOwnerSession(symlinkPath, Date.now(), 60_000));

  const permissiveParent = fixture();
  chmodSync(permissiveParent.directory, 0o755);
  await assert.rejects(() => createOwnerSession(permissiveParent.secretPath, Date.now(), 60_000), /directory is not private/);

  const oversized = fixture();
  writeFileSync(oversized.secretPath, "d".repeat(129), { encoding: "ascii", mode: 0o600 });
  await assert.rejects(() => createOwnerSession(oversized.secretPath, Date.now(), 60_000), /private owner file/);
});

test("rotating the owner secret invalidates an existing session", async () => {
  const { createOwnerSession, verifyOwnerSession } = await import(capabilityUrl.href);
  const { secretPath } = fixture();
  const now = Date.UTC(2026, 6, 21, 12, 0, 0);
  const cookie = await createOwnerSession(secretPath, now, 60_000);
  writeFileSync(secretPath, "d".repeat(64), { encoding: "ascii", mode: 0o600 });
  assert.equal(await verifyOwnerSession(secretPath, cookie, now + 1_000), false);
});

test("pairing token is consumed once and wrong candidates do not destroy it", async () => {
  const { consumePairToken } = await import(capabilityUrl.href);
  const { pairPath } = fixture();
  assert.equal(await consumePairToken(pairPath, "c".repeat(64)), false);
  await access(pairPath);
  assert.equal(await consumePairToken(pairPath, "b".repeat(64)), true);
  await assert.rejects(() => access(pairPath));
  assert.equal(await consumePairToken(pairPath, "b".repeat(64)), false);

  const linked = fixture();
  const linkedPairPath = path.join(linked.directory, "linked.pair");
  symlinkSync(linked.pairPath, linkedPairPath);
  assert.equal(await consumePairToken(linkedPairPath, "b".repeat(64)), false);
});

test("concurrent pairing claims authorize at most one request", async () => {
  const { consumePairToken } = await import(capabilityUrl.href);
  const { pairPath } = fixture();
  const results = await Promise.all([
    consumePairToken(pairPath, "b".repeat(64)),
    consumePairToken(pairPath, "b".repeat(64)),
  ]);
  assert.deepEqual(results.sort(), [false, true]);
});

test("local owner session route and gate enforce pairing before API access", async () => {
  const [route, server, gate, packageJson] = await Promise.all([
    readFile(path.join(ROOT, "src/app/api/local-owner/session/route.ts"), "utf8"),
    readFile(path.join(ROOT, "src/lib/local/server.ts"), "utf8"),
    readFile(path.join(ROOT, "src/components/auth-gate.tsx"), "utf8"),
    readFile(path.join(ROOT, "package.json"), "utf8").then(JSON.parse),
  ]);
  assert.match(route, /consumePairToken/);
  assert.match(route, /httpOnly:\s*true/);
  assert.match(route, /sameSite:\s*"strict"/);
  assert.match(route, /createOwnerSession/);
  assert.match(server, /verifyOwnerSession/);
  assert.match(server, /missing-owner-session/);
  assert.match(gate, /owner-pair/);
  assert.match(gate, /\/api\/local-owner\/session/);
  assert.match(packageJson.scripts["owner:open"], /open-local-owner\.mjs/);
});

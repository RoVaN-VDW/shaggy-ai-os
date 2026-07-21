import assert from "node:assert/strict";
import { access, chmod, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { createProjectsStore } from "../../src/lib/local/projects-store.ts";

test("projects store initializes a versioned schema and reads an empty collection", async (t) => {
  const dataRoot = await mkdtemp(join(tmpdir(), "shaggy-projects-init-"));
  t.after(() => rm(dataRoot, { recursive: true, force: true }));

  const store = createProjectsStore({ dataRoot });
  const projects = await store.readAll();
  const persisted = JSON.parse(await readFile(join(dataRoot, "projects.v1.json"), "utf8"));

  assert.deepEqual(projects, []);
  assert.deepEqual(persisted, { schemaVersion: 1, projects: [] });
});

test("projects store persists writes across fresh repository instances", async (t) => {
  const dataRoot = await mkdtemp(join(tmpdir(), "shaggy-projects-persist-"));
  t.after(() => rm(dataRoot, { recursive: true, force: true }));
  const project = {
    id: "4cbdab55-e9af-4f9c-9a56-cf83a39e1cb1",
    name: "Local SHAGGY",
    description: "Local-only migration",
    status: "active",
    type: "product",
    health_score: 73,
    created_at: "2026-07-20T10:00:00.000Z",
    updated_at: "2026-07-20T10:00:00.000Z",
  };

  await createProjectsStore({ dataRoot }).replaceAll([project]);
  const restartedStore = createProjectsStore({ dataRoot });

  assert.deepEqual(await restartedStore.readAll(), [project]);
});

test("projects store rejects malformed persisted data instead of returning partial records", async (t) => {
  const dataRoot = await mkdtemp(join(tmpdir(), "shaggy-projects-malformed-"));
  t.after(() => rm(dataRoot, { recursive: true, force: true }));
  await writeFile(
    join(dataRoot, "projects.v1.json"),
    JSON.stringify({
      schemaVersion: 1,
      projects: [{
        id: "not-a-uuid",
        name: "Invalid",
        description: null,
        status: "active",
        type: "product",
        health_score: 101,
        created_at: "not-a-date",
        updated_at: "not-a-date",
        rawDocument: "must never pass",
      }],
    }),
  );

  await assert.rejects(
    createProjectsStore({ dataRoot }).readAll(),
    /Local projects data is malformed/,
  );
});

test("projects store persists one atomic create receipt and replays it after restart", async (t) => {
  const dataRoot = await mkdtemp(join(tmpdir(), "shaggy-projects-create-"));
  t.after(() => rm(dataRoot, { recursive: true, force: true }));
  const input = {
    name: "Mutation plane",
    description: "Created locally",
    type: "product",
  };
  const idempotencyKey = "af9fb5e2-c8f5-4b2d-a8fa-646e133a5b32";

  const created = await createProjectsStore({ dataRoot }).create(input, { idempotencyKey });
  const replayed = await createProjectsStore({ dataRoot }).create(input, { idempotencyKey });
  const persisted = JSON.parse(await readFile(join(dataRoot, "projects.v2.json"), "utf8"));

  assert.equal(created.replayed, false);
  assert.equal(replayed.replayed, true);
  assert.deepEqual(replayed.project, created.project);
  assert.equal(replayed.receipt.mutationId, created.receipt.mutationId);
  assert.equal(persisted.schemaVersion, 2);
  assert.equal(persisted.projects.length, 1);
  assert.equal(persisted.receipts.length, 1);
  assert.deepEqual(await createProjectsStore({ dataRoot }).readAll(), [created.project]);
});

test("projects store preserves the committed snapshot when a later write fails", async (t) => {
  const dataRoot = await mkdtemp(join(tmpdir(), "shaggy-projects-rollback-"));
  t.after(() => rm(dataRoot, { recursive: true, force: true }));
  const store = createProjectsStore({ dataRoot });
  await store.create(
    { name: "Committed", description: null, type: "product" },
    { idempotencyKey: "9b4b64ec-f38c-4e80-ae9b-7558e6343f1a" },
  );
  const before = await readFile(join(dataRoot, "projects.v2.json"));

  await chmod(dataRoot, 0o500);
  try {
    await assert.rejects(
      store.create(
        { name: "Must roll back", description: null, type: "product" },
        { idempotencyKey: "5f59fc86-ea3a-4da8-8cf4-3c55d79608de" },
      ),
    );
  } finally {
    await chmod(dataRoot, 0o700);
  }

  assert.deepEqual(await readFile(join(dataRoot, "projects.v2.json")), before);
  assert.deepEqual((await readdir(dataRoot)).filter((name) => name.endsWith(".tmp")), []);
});

test("projects store refuses a symlinked data root and writes nothing outside it", async (t) => {
  const container = await mkdtemp(join(tmpdir(), "shaggy-projects-boundary-"));
  t.after(() => rm(container, { recursive: true, force: true }));
  const outside = join(container, "outside");
  const linkedRoot = join(container, "data");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(outside));
  await symlink(outside, linkedRoot);

  await assert.rejects(
    createProjectsStore({ dataRoot: linkedRoot }).readAll(),
    /must not be a symbolic link/,
  );
  await assert.rejects(access(join(outside, "projects.v1.json")));
});

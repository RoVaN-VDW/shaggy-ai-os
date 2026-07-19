import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../../scripts/build-second-brain-snapshot.mjs", import.meta.url));

test("package exposes the local Second Brain snapshot command", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  assert.equal(packageJson.scripts["snapshot:second-brain"], "node scripts/build-second-brain-snapshot.mjs");
});

test("Second Brain generator emits aggregate continuity and verified backup state", async () => {
  const temp = await mkdtemp(join(tmpdir(), "shaggy-second-brain-"));
  const workspace = join(temp, "workspace");
  const backup = join(temp, "backup");
  const project = join(workspace, "Project A");
  const files = ["START_HERE.md", "CURRENT_STATE.md", "PROJECT_INDEX.md", "docs/DECISION_LOG.md", "docs/NEXT_ACTIONS.md", "tasks/todo.md", "tasks/lessons.md"];
  try {
    for (const file of files) {
      await mkdir(join(project, file, "..").replace(/\/[^/]+\/\.\.$/, ""), { recursive: true }).catch(() => {});
      const path = join(project, file);
      await mkdir(join(path, ".."), { recursive: true });
      await writeFile(path, file.endsWith("todo.md") ? "- [ ] Build\n- [x] Done\n" : "# Canon\n");
    }
    await writeFile(join(workspace, "AI_WORKSPACE_INDEX.md"), "# Index\n| Project A |\n");
    await cp(workspace, backup, { recursive: true });
    const output = join(temp, "snapshot.json");
    const run = spawnSync(process.execPath, [script, "--workspace", workspace, "--backup", backup, "--output", output], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    const snapshot = JSON.parse(await readFile(output, "utf8"));
    assert.equal(snapshot.indexedProjects, 1);
    assert.equal(snapshot.continuityFilesPresent, 7);
    assert.equal(snapshot.continuityFilesExpected, 7);
    assert.equal(snapshot.openActions, 1);
    assert.equal(snapshot.backupState, "verified");
    assert.equal("rawDocument" in snapshot, false);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("Second Brain generator never blocks on sparse cloud placeholders", async () => {
  const temp = await mkdtemp(join(tmpdir(), "shaggy-second-brain-sparse-"));
  const workspace = join(temp, "workspace");
  const backup = join(temp, "backup");
  const files = ["START_HERE.md", "CURRENT_STATE.md", "PROJECT_INDEX.md", "docs/DECISION_LOG.md", "docs/NEXT_ACTIONS.md", "tasks/todo.md", "tasks/lessons.md"];
  try {
    for (const root of [workspace, backup]) {
      for (const file of files) {
        const path = join(root, "Cloud Project", file);
        await mkdir(join(path, ".."), { recursive: true });
        await writeFile(path, "");
        await truncate(path, 4096);
      }
    }
    const output = join(temp, "snapshot.json");
    const run = spawnSync(process.execPath, [script, "--workspace", workspace, "--backup", backup, "--output", output], { encoding: "utf8", timeout: 3000 });
    assert.equal(run.status, 0, run.stderr || run.error?.message);
    const snapshot = JSON.parse(await readFile(output, "utf8"));
    assert.equal(snapshot.openActions, null);
    assert.equal(snapshot.unresolvedDecisions, null);
    assert.equal(snapshot.backupState, "stale");
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

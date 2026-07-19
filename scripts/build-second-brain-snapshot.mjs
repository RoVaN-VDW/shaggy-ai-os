#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const CANONICAL_FILES = [
  "START_HERE.md",
  "CURRENT_STATE.md",
  "PROJECT_INDEX.md",
  "docs/DECISION_LOG.md",
  "docs/NEXT_ACTIONS.md",
  "tasks/todo.md",
  "tasks/lessons.md",
];
const STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1_000;

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

async function hash(path) {
  const metadata = await stat(path);
  if (metadata.size > 0 && metadata.blocks === 0) throw new Error("cloud placeholder is not materialized");
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function readMaterializedText(path, metadata) {
  if (metadata.size > 0 && metadata.blocks === 0) return null;
  return readFile(path, "utf8");
}

function countOpenActions(text) {
  return (text.match(/^\s*-\s*\[\s\]\s+/gm) ?? []).length;
}

function countOpenDecisions(text) {
  return text.split("\n").filter((line) => /(?:\[open\]|status\s*:\s*open|onopgelost|unresolved|te beslissen)/i.test(line)).length;
}

function changeKind(relativePath) {
  if (relativePath.endsWith("DECISION_LOG.md")) return "decision";
  if (relativePath.endsWith("NEXT_ACTIONS.md") || relativePath.endsWith("todo.md")) return "action";
  if (relativePath.endsWith("PROJECT_INDEX.md")) return "index";
  return "state";
}

async function inspectProject(workspace, name) {
  const root = join(workspace, name);
  const present = [];
  const changes = [];
  let openActions = 0;
  let unresolvedDecisions = 0;
  let actionsReadable = true;
  let decisionsReadable = true;
  for (const relativePath of CANONICAL_FILES) {
    const path = join(root, relativePath);
    if (!(await exists(path))) continue;
    present.push(relativePath);
    const metadata = await stat(path);
    changes.push({ project: name, kind: changeKind(relativePath), at: metadata.mtime.toISOString() });
    if (relativePath.endsWith("todo.md") || relativePath.endsWith("NEXT_ACTIONS.md")) {
      const text = await readMaterializedText(path, metadata);
      if (text === null) actionsReadable = false;
      else openActions += countOpenActions(text);
    }
    if (relativePath.endsWith("DECISION_LOG.md")) {
      const text = await readMaterializedText(path, metadata);
      if (text === null) decisionsReadable = false;
      else unresolvedDecisions += countOpenDecisions(text);
    }
  }
  if (present.length === 0) return null;
  const currentStatePath = join(root, "CURRENT_STATE.md");
  const currentState = await stat(currentStatePath).catch(() => null);
  return {
    name,
    present,
    openActions: actionsReadable ? openActions : null,
    unresolvedDecisions: decisionsReadable ? unresolvedDecisions : null,
    stale: !currentState || (Date.now() - currentState.mtimeMs) > STALE_AFTER_MS,
    changes,
  };
}

async function resolveBackupState(workspace, backup, projects) {
  if (!backup || !(await exists(backup))) return "unavailable";
  for (const project of projects) {
    for (const relativePath of project.present) {
      const source = join(workspace, project.name, relativePath);
      const destination = join(backup, project.name, relativePath);
      if (!(await exists(destination))) return "pending";
      try {
        if (await hash(source) !== await hash(destination)) return "pending";
      } catch {
        return "stale";
      }
    }
  }
  return "verified";
}

async function main() {
  const workspace = resolve(argument("--workspace", join(homedir(), "Desktop/AI workspace")));
  const backup = resolve(argument("--backup", join(homedir(), "Library/CloudStorage/GoogleDrive-vdw.ronald@gmail.com/My Drive/AI workspace - Back up")));
  const output = resolve(argument("--output", join(process.cwd(), ".hermes/runtime/second-brain-snapshot.json")));
  const entries = await readdir(workspace, { withFileTypes: true });
  const projects = (await Promise.all(entries
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => inspectProject(workspace, entry.name))))
    .filter(Boolean);
  const recentChanges = projects
    .flatMap((project) => project.changes)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 20);
  const snapshot = {
    version: 1,
    observedAt: new Date().toISOString(),
    indexedProjects: projects.length,
    continuityFilesPresent: projects.reduce((sum, project) => sum + project.present.length, 0),
    continuityFilesExpected: projects.length * CANONICAL_FILES.length,
    openActions: projects.some((project) => project.openActions === null)
      ? null
      : projects.reduce((sum, project) => sum + project.openActions, 0),
    unresolvedDecisions: projects.some((project) => project.unresolvedDecisions === null)
      ? null
      : projects.reduce((sum, project) => sum + project.unresolvedDecisions, 0),
    staleProjects: projects.filter((project) => project.stale).length,
    backupState: await resolveBackupState(workspace, backup, projects),
    recentChanges,
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${output}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

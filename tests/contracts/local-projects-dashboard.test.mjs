import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("dashboard and Projects Hub use only the local same-origin no-store projects API", async () => {
  const [hook, resources, projectsPage] = await Promise.all([
    source("src/hooks/useCockpitData.ts"),
    source("src/hooks/cockpit-resource-status.ts"),
    source("src/app/projects/page.tsx"),
  ]);

  assert.match(hook, /fetch\(["']\/api\/projects["']/);
  assert.match(hook, /cache:\s*["']no-store["']/);
  assert.doesNotMatch(hook, /from\(["']projects["']\)/);
  assert.match(resources, /projects:\s*["']local-api:projects["']/);
  assert.match(projectsPage, /fetch\(["']\/api\/projects["']/);
  assert.match(projectsPage, /method:\s*["']POST["']/);
  assert.match(projectsPage, /Idempotency-Key/);
  assert.match(projectsPage, /crypto\.randomUUID\(\)/);
  assert.match(projectsPage, /cache:\s*["']no-store["']/);
  assert.doesNotMatch(projectsPage, /supabase/i);
  assert.doesNotMatch(projectsPage, /from\(["']projects["']\)/);
});

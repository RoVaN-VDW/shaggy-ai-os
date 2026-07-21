import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const packageUrl = new URL("../../package.json", import.meta.url);

test("scaffolding CLI dependencies stay outside the production dependency graph", async () => {
  const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));

  assert.equal(
    packageJson.dependencies?.shadcn,
    undefined,
    "shadcn is a scaffolding CLI and must not ship as a production dependency",
  );
  assert.equal(
    typeof packageJson.devDependencies?.shadcn,
    "string",
    "shadcn must remain available as a development-only tool",
  );
  assert.notEqual(packageJson.devDependencies.shadcn.trim(), "");
});

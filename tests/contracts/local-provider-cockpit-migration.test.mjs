import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";

const hookUrl = new URL("../../src/hooks/useCockpitData.ts", import.meta.url);
const resourceStatusUrl = new URL("../../src/hooks/cockpit-resource-status.ts", import.meta.url);
const registryUrl = new URL("../../src/lib/capabilities/registry.ts", import.meta.url);
const srcUrl = new URL("../../src/", import.meta.url);

async function filesContaining(directory, needle) {
  const matches = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) {
      matches.push(...await filesContaining(child, needle));
    } else if (/\.(?:ts|tsx)$/.test(entry.name) && (await readFile(child, "utf8")).includes(needle)) {
      matches.push(child.pathname.slice(srcUrl.pathname.length));
    }
  }
  return matches.sort();
}

test("cockpit provider reads use the local API and remove the dead split-brain mutation", async () => {
  const source = await readFile(hookUrl, "utf8");

  assert.match(source, /import \{ fetchLocalProviders \} from "@\/lib\/api\/local-providers"/);
  assert.match(source, /fetchLocalProviders\(\)/);
  assert.match(source, /providers: providersRes\.observedAt/);
  assert.doesNotMatch(source, /model_providers/);
  assert.doesNotMatch(source, /updateProviderStatus/);
});

test("provider provenance is local while the broad cockpit registry stays explicitly pinned to legacy", async () => {
  const resourceSource = await readFile(resourceStatusUrl, "utf8");
  const registrySource = await readFile(registryUrl, "utf8");

  assert.match(resourceSource, /providers: "local-api:providers"/);
  assert.match(registrySource, /P1 provider readplane is tracked per resource/);
  assert.match(registrySource, /source: "supabase:cockpit-resources"/);
});

test("non-cockpit provider capabilities remain explicitly inventoried as legacy", async () => {
  assert.deepEqual(await filesContaining(srcUrl, "model_providers"), [
    "app/api/chat/route.ts",
    "app/api/dispatch/route.ts",
    "app/api/health/route.ts",
    "app/chat/page.tsx",
    "app/creative/page.tsx",
  ]);
});

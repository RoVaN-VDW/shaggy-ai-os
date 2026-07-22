import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const hookUrl = new URL("../../src/hooks/useCockpitData.ts", import.meta.url);
const resourceStatusUrl = new URL("../../src/hooks/cockpit-resource-status.ts", import.meta.url);
const registryUrl = new URL("../../src/lib/capabilities/registry.ts", import.meta.url);
const chatRouteUrl = new URL("../../src/app/api/chat/route.ts", import.meta.url);
const dispatchRouteUrl = new URL("../../src/app/api/dispatch/route.ts", import.meta.url);

test("Live Activity reads through the local API and no longer queries Supabase agent_activity", async () => {
  const source = await readFile(hookUrl, "utf8");

  assert.match(source, /import \{ fetchLocalActivity \} from "@\/lib\/api\/local-activity"/);
  assert.match(source, /fetchLocalActivity\(\)/);
  assert.match(source, /agentActivity: activityRes\.observedAt/);
  assert.doesNotMatch(source, /\.from\("agent_activity"\)/);
});

test("activity provenance is local while the broad cockpit registry remains legacy", async () => {
  const resourceSource = await readFile(resourceStatusUrl, "utf8");
  const registrySource = await readFile(registryUrl, "utf8");

  assert.match(resourceSource, /agentActivity: "local-api:activity"/);
  assert.match(registrySource, /P1 provider readplane is tracked per resource; P2 activity readplane is too/);
  assert.match(registrySource, /source: "supabase:cockpit-resources"/);
});

test("P2 leaves chat and dispatch activity persistence outside the readplane unchanged", async () => {
  const [chatSource, dispatchSource] = await Promise.all([
    readFile(chatRouteUrl, "utf8"),
    readFile(dispatchRouteUrl, "utf8"),
  ]);

  assert.match(chatSource, /\.from\("agent_activity"\)\.insert/);
  assert.match(dispatchSource, /\.from\("agent_activity"\)\.insert/);
});

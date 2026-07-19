import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Settings proves its local-only capability boundary without static security claims", async () => {
  const settings = await source("src/app/settings/page.tsx");

  assert.match(settings, /CAPABILITY_REGISTRY\.settings/);
  assert.match(settings, /resolveCapabilityTruth/);
  assert.match(settings, /settingsTruth\.status/);
  assert.match(settings, /settingsTruth\.source/);
  assert.match(settings, /window\.localStorage\.setItem/);
  assert.doesNotMatch(settings, /state="Protected"/);
});

test("Settings keeps Connections scroll-reachable and Save preferences outside the scroll region", async () => {
  const settings = await source("src/app/settings/page.tsx");

  assert.match(settings, /h-full min-h-0 flex flex-col/);
  assert.match(settings, /data-settings-scroll-region/);
  assert.match(settings, /min-h-0 flex-1 overflow-y-auto/);
  assert.match(settings, /data-settings-actions/);
  assert.match(settings, /shrink-0/);

  const scrollRegion = settings.indexOf("data-settings-scroll-region");
  const connections = settings.indexOf("Connections");
  const actions = settings.indexOf("data-settings-actions");
  const save = settings.indexOf("Save preferences");
  assert.ok(scrollRegion >= 0 && scrollRegion < connections);
  assert.ok(connections < actions && actions < save);
});

test("Review Queue derives pending and empty states from source truth and remains decision-only", async () => {
  const review = await source("src/app/review/page.tsx");

  assert.match(review, /resources\.reviews/);
  assert.match(review, /CAPABILITY_REGISTRY\.reviewQueue/);
  assert.match(review, /resolveCapabilityTruth/);
  assert.match(review, /reviewTruth\.status/);
  assert.match(review, /reviewTruth\.source/);
  assert.match(review, /reviewTruth\.status === "fresh" && reviews\.length === 0/);
  assert.match(review, /Decision queue only/);
  assert.match(review, /does not execute an external action/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { PRIMARY_NAV_ITEMS } from "../../src/features/command-center/shell-contract.ts";

const EXPECTED_LABELS = [
  "Command Center",
  "Projects",
  "Chat Studio",
  "Knowledge Brain",
  "Digital Twin",
  "Automation Hub",
  "Creative Studio",
  "Workflow Studio",
  "Growth Center",
  "Build & Deploy",
  "Reports & Insights",
  "Models & Costs",
  "Security & Backup",
  "Settings",
];

test("Dream v3 sidebar exposes all 14 Golden Frame labels in canonical order", () => {
  assert.equal(PRIMARY_NAV_ITEMS.length, 14);
  assert.deepEqual(PRIMARY_NAV_ITEMS.map((item) => item.label), EXPECTED_LABELS);
  assert.equal(new Set(PRIMARY_NAV_ITEMS.map((item) => item.label)).size, 14);
});

test("enabled navigation items always resolve to a real application route", () => {
  const enabled = PRIMARY_NAV_ITEMS.filter((item) => item.enabled);

  assert.ok(enabled.length >= 8);
  for (const item of enabled) {
    assert.match(item.href ?? "", /^\//);
  }
  for (const item of PRIMARY_NAV_ITEMS.filter((item) => !item.enabled)) {
    assert.equal(item.href, null);
  }
});

test("primary navigation exposes explicit available or planned truth instead of silent dots", async () => {
  for (const item of PRIMARY_NAV_ITEMS) {
    assert.equal(item.availability, item.enabled ? "available" : "planned");
  }

  const sidebar = await readFile(
    new URL("../../src/features/command-center/components/PrimarySidebar.tsx", import.meta.url),
    "utf8",
  );
  assert.match(sidebar, /item\.availability/);
  assert.match(sidebar, /Available/);
  assert.match(sidebar, /Planned/);
  assert.doesNotMatch(sidebar, /!item\.enabled\s*&&\s*<i/);
});

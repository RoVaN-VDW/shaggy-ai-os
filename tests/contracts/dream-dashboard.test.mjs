import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { buildDreamDashboardModel, COGNITIVE_SPACES } from "../../src/features/command-center/dashboard-model.ts";

const empty = {
  projects: [], providers: [], reviews: [], usage: [], dailyUsage: [], notifications: [], knowledgeDocs: [], agentActivity: [],
};

test("empty cockpit data produces explicit unavailable states without invented metrics", () => {
  const model = buildDreamDashboardModel(empty);
  assert.equal(model.mission.available, false);
  assert.equal(model.mission.health, null);
  assert.equal("progress" in model.mission, false);
  assert.equal(model.health.score, null);
  assert.equal(model.insights.spend, null);
  assert.equal(model.briefing.length, 0);
});

test("dashboard model derives mission and health from supplied records", () => {
  const model = buildDreamDashboardModel({
    ...empty,
    resources: {
      projects: { status: "live", source: "supabase:projects", fetchedAt: "2026-07-15T00:00:00.000Z", error: null },
      providers: { status: "live", source: "supabase:model_providers", fetchedAt: "2026-07-15T00:00:00.000Z", error: null },
      dailyUsage: { status: "live", source: "supabase:get_daily_usage", fetchedAt: "2026-07-15T00:00:00.000Z", error: null },
    },
    projects: [{ id: "p1", name: "Dream v3", description: "Build the command center", status: "active", type: "product", health_score: 72 }],
    providers: [
      { id: "a", provider: "openai", model: "sol", status: "active", health_status: "healthy", last_seen_at: null },
      { id: "b", provider: "other", model: "x", status: "active", health_status: "unknown", last_seen_at: null },
    ],
    dailyUsage: [{ day: "2026-07-15", provider: "openai", total_cost: 1, total_input_tokens: 100, total_output_tokens: 50, event_count: 2 }],
  });
  assert.equal(model.mission.title, "Dream v3");
  assert.equal(model.mission.health, 72);
  assert.deepEqual(model.usageTrend, [{ day: "2026-07-15", cost: 1, tokens: 150, events: 2 }]);
  assert.equal(model.health.score, 50);
  assert.equal(model.health.healthy, 1);
});

test("cognitive dock exposes six working spaces", () => {
  assert.equal(COGNITIVE_SPACES.length, 6);
  for (const space of COGNITIVE_SPACES) assert.match(space.href, /^\//);
});

test("cognitive dock metadata is derived from readable dashboard records", () => {
  const model = buildDreamDashboardModel({
    ...empty,
    resources: {
      projects: { status: "live", source: "projects", fetchedAt: "2026-07-15T00:00:00.000Z", error: null },
      reviews: { status: "live", source: "reviews", fetchedAt: "2026-07-15T00:00:00.000Z", error: null },
      knowledgeDocs: { status: "live", source: "knowledge", fetchedAt: "2026-07-15T00:00:00.000Z", error: null },
      usage: { status: "live", source: "usage", fetchedAt: "2026-07-15T00:00:00.000Z", error: null },
    },
    projects: [{ id: "p1", name: "One", description: "", status: "active", type: "product", health_score: 80 }],
    knowledgeDocs: [{ id: "k1", name: "Canon", file_type: "md", size_bytes: 1, embedding_status: "ready", created_at: "2026-07-15T00:00:00.000Z" }],
  });
  assert.deepEqual(model.cognitiveSpaces.map(({ label, meta }) => ({ label, meta })), [
    { label: "Command", meta: "1 project" },
    { label: "Knowledge", meta: "1 source" },
    { label: "Create", meta: "Workspace" },
    { label: "Automate", meta: "0 approvals" },
    { label: "Analyze", meta: "0 events" },
    { label: "Evolve", meta: "Twin" },
  ]);
});

test("cognitive dock renders metadata with its dedicated readable style hook", () => {
  const source = readFileSync(new URL("../../src/features/command-center/components/DreamCommandCenter.tsx", import.meta.url), "utf8");
  assert.match(source, /<small className="dream-dock__meta">\{space\.meta\}<\/small>/);
});

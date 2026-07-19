import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildDreamDashboardModel,
  formatCountMetric,
  formatCurrencyMetric,
} from "../../src/features/command-center/dashboard-model.ts";

const emptyRecords = {
  projects: [],
  providers: [],
  reviews: [],
  usage: [],
  notifications: [],
  knowledgeDocs: [],
  agentActivity: [],
};

function status(state, fetchedAt = null, error = null) {
  return { status: state, source: "supabase", fetchedAt, error };
}

function resources(usage) {
  return {
    projects: status("live", "2026-07-15T00:00:00.000Z"),
    providers: status("live", "2026-07-15T00:00:00.000Z"),
    reviews: status("live", "2026-07-15T00:00:00.000Z"),
    usage,
    dailyUsage: status("live", "2026-07-15T00:00:00.000Z"),
    notifications: status("live", "2026-07-15T00:00:00.000Z"),
    knowledgeDocs: status("live", "2026-07-15T00:00:00.000Z"),
    agentActivity: status("live", "2026-07-15T00:00:00.000Z"),
  };
}

test("failed usage source is unavailable instead of being rendered as a zero", () => {
  const model = buildDreamDashboardModel({
    ...emptyRecords,
    resources: resources(status("error", null, "permission denied")),
  });

  assert.equal(model.insights.sourceStatus, "error");
  assert.equal(model.insights.spend, null);
  assert.equal(model.insights.events, null);
  assert.equal(model.insights.fetchedAt, null);
});

test("successful empty usage source produces a truthful zero", () => {
  const fetchedAt = "2026-07-15T01:00:00.000Z";
  const model = buildDreamDashboardModel({
    ...emptyRecords,
    resources: resources(status("live", fetchedAt)),
  });

  assert.equal(model.insights.sourceStatus, "live");
  assert.equal(model.insights.spend, 0);
  assert.equal(model.insights.events, 0);
  assert.equal(model.insights.fetchedAt, fetchedAt);
});

test("metric formatters distinguish unavailable from a truthful zero", () => {
  assert.equal(formatCurrencyMetric(null), "Unavailable");
  assert.equal(formatCurrencyMetric(0), "$0.00");
  assert.equal(formatCountMetric(null), "Unavailable");
  assert.equal(formatCountMetric(0), "0");
});

test("failed dashboard resources do not leak cached arrays as current metrics", () => {
  const failedResources = resources(status("live", "2026-07-15T01:00:00.000Z"));
  failedResources.projects = status("error", null, "projects denied");
  failedResources.providers = status("error", null, "providers denied");
  failedResources.notifications = status("error", null, "notifications denied");
  failedResources.knowledgeDocs = status("error", null, "knowledge denied");
  failedResources.agentActivity = status("error", null, "activity denied");

  const model = buildDreamDashboardModel({
    ...emptyRecords,
    resources: failedResources,
    projects: [{ id: "cached-project", name: "Cached", description: "stale", status: "active", type: "product", health_score: 90 }],
    providers: [{ id: "cached-provider", provider: "cached", model: "cached", status: "active", health_status: "healthy", last_seen_at: null }],
    notifications: [{ id: "cached-note", level: "info", title: "Cached", message: "stale", read: false, created_at: "2026-07-15T00:00:00.000Z" }],
    knowledgeDocs: [{ id: "cached-doc", name: "Cached", file_type: "md", size_bytes: 1, embedding_status: "ready", created_at: "2026-07-15T00:00:00.000Z" }],
    agentActivity: [{ id: "cached-activity", agent: "cached", action: "cached", status: "success", metadata: {}, created_at: "2026-07-15T00:00:00.000Z" }],
  });

  assert.equal(model.mission.title, "Mission data unavailable");
  assert.equal(model.mission.sourceStatus, "error");
  assert.equal(model.projectCount, null);
  assert.equal(model.health.score, null);
  assert.equal(model.health.healthy, null);
  assert.equal(model.health.total, null);
  assert.equal(model.insights.unread, null);
  assert.equal(model.knowledgeCount, null);
  assert.equal(model.briefing.length, 0);
  assert.equal(model.activity.length, 0);
});

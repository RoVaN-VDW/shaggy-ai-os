import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createInitialResourceStates,
  markResourcesRefreshing,
  resolveCockpitResourceStates,
  resolveResourceData,
  resolveResourceState,
  setNotificationReadValue,
} from "../../src/hooks/cockpit-resource-status.ts";

test("cockpit resources identify local projects and providers while unmigrated sources remain Supabase legacy", () => {
  const resources = createInitialResourceStates();

  assert.equal(resources.projects.status, "loading");
  assert.equal(resources.projects.source, "local-api:projects");
  assert.equal(resources.providers.source, "local-api:providers");
  assert.equal(resources.usage.source, "supabase:usage_events");
  assert.equal(resources.dailyUsage.source, "supabase:get_daily_usage");
  assert.equal(resources.usage.fetchedAt, null);
});

test("first resource failure is error and never receives a fabricated freshness timestamp", () => {
  const initial = createInitialResourceStates().usage;
  const failed = resolveResourceState(initial, "permission denied", "2026-07-15T01:00:00.000Z");

  assert.equal(failed.status, "error");
  assert.equal(failed.fetchedAt, null);
  assert.equal(failed.error, "permission denied");
});

test("refresh preserves live data as stale and a later success restores live freshness", () => {
  const initial = createInitialResourceStates();
  const liveUsage = resolveResourceState(initial.usage, null, "2026-07-15T01:00:00.000Z");
  const refreshing = markResourcesRefreshing({ ...initial, usage: liveUsage });
  const failedRefresh = resolveResourceState(refreshing.usage, "timeout", "2026-07-15T02:00:00.000Z");
  const recovered = resolveResourceState(failedRefresh, null, "2026-07-15T03:00:00.000Z");

  assert.equal(refreshing.usage.status, "stale");
  assert.equal(failedRefresh.status, "stale");
  assert.equal(failedRefresh.fetchedAt, "2026-07-15T01:00:00.000Z");
  assert.equal(failedRefresh.error, "timeout");
  assert.equal(recovered.status, "live");
  assert.equal(recovered.fetchedAt, "2026-07-15T03:00:00.000Z");
  assert.equal(recovered.error, null);
});

test("one failed query does not erase freshness from successful resources", () => {
  const initial = createInitialResourceStates();
  const fetchedAt = "2026-07-15T04:00:00.000Z";
  const resources = resolveCockpitResourceStates(initial, {
    projects: null,
    providers: null,
    reviews: null,
    usage: "permission denied",
    dailyUsage: null,
    notifications: null,
    knowledgeDocs: null,
    agentActivity: null,
  }, fetchedAt);

  assert.equal(resources.usage.status, "error");
  assert.equal(resources.usage.fetchedAt, null);
  assert.equal(resources.projects.status, "live");
  assert.equal(resources.projects.fetchedAt, fetchedAt);
  assert.equal(resources.providers.status, "live");
});

test("provider freshness uses collector observation time instead of browser fetch time", () => {
  const initial = createInitialResourceStates();
  const browserFetchedAt = "2026-07-21T12:00:30.000Z";
  const providerObservedAt = "2026-07-21T12:00:00.000Z";
  const resources = resolveCockpitResourceStates(initial, {
    projects: null,
    providers: null,
    reviews: null,
    usage: null,
    dailyUsage: null,
    notifications: null,
    knowledgeDocs: null,
    agentActivity: null,
  }, browserFetchedAt, { providers: providerObservedAt });

  assert.equal(resources.projects.fetchedAt, browserFetchedAt);
  assert.equal(resources.providers.fetchedAt, providerObservedAt);
});

test("failed refresh preserves previous records while successful empty response clears them", () => {
  const previous = [{ id: "event-1" }];

  assert.deepEqual(resolveResourceData(previous, null, "timeout"), previous);
  assert.deepEqual(resolveResourceData(previous, [], null), []);
  assert.deepEqual(resolveResourceData(previous, [{ id: "event-2" }], null), [{ id: "event-2" }]);
});

test("notification read updates are reversible without touching sibling records", () => {
  const notifications = [
    { id: "a", read: false, title: "Target" },
    { id: "b", read: false, title: "Sibling" },
  ];
  const optimistic = setNotificationReadValue(notifications, "a", true);
  const rolledBack = setNotificationReadValue(optimistic, "a", false);

  assert.equal(optimistic[0].read, true);
  assert.equal(optimistic[1], notifications[1]);
  assert.equal(rolledBack[0].read, false);
  assert.equal(rolledBack[1], notifications[1]);
});

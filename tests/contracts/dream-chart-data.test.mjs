import assert from "node:assert/strict";
import { test } from "node:test";

import { buildActivityTrace, buildDailyUsageSeries, buildKnowledgeGraph, buildMissionHealth, buildProjectHealthBars, classifyHealthTone, formatKnowledgeGraphLabel, getKnowledgeGraphLabelPlacement } from "../../src/features/command-center/visualization/chart-model.ts";
import { formatIndexedSourceCount } from "../../src/features/command-center/dashboard-model.ts";

test("mission health is clamped and never represented as progress", () => {
  assert.deepEqual(buildMissionHealth(87), { health: 87, label: "Mission health" });
  assert.deepEqual(buildMissionHealth(140), { health: 100, label: "Mission health" });
  assert.deepEqual(buildMissionHealth(Number.NaN), { health: null, label: "Mission health" });
  assert.equal("progress" in buildMissionHealth(50), false);
});

test("daily usage is aggregated by day and sorted without invented points", () => {
  const series = buildDailyUsageSeries([
    { day: "2026-07-15", provider: "openai", total_cost: 1.2, total_input_tokens: 100, total_output_tokens: 50, event_count: 2 },
    { day: "2026-07-14", provider: "kimi", total_cost: 0, total_input_tokens: 80, total_output_tokens: 40, event_count: 1 },
    { day: "2026-07-15", provider: "anthropic", total_cost: 0.8, total_input_tokens: 60, total_output_tokens: 30, event_count: 1 },
  ]);

  assert.deepEqual(series, [
    { day: "2026-07-14", cost: 0, tokens: 120, events: 1 },
    { day: "2026-07-15", cost: 2, tokens: 240, events: 3 },
  ]);
});

test("project health bars prioritize risk and keep health semantics", () => {
  const bars = buildProjectHealthBars([
    { id: "healthy", name: "Healthy", status: "active", health_score: 92 },
    { id: "risk", name: "Risk", status: "active", health_score: 34 },
    { id: "invalid", name: "Invalid", status: "paused", health_score: Number.NaN },
  ]);

  assert.deepEqual(bars.map(({ id, health, label }) => ({ id, health, label })), [
    { id: "risk", health: 34, label: "Project health" },
    { id: "healthy", health: 92, label: "Project health" },
    { id: "invalid", health: null, label: "Project health" },
  ]);
  assert.deepEqual(bars.map(({ id, tone }) => ({ id, tone })), [
    { id: "risk", tone: "critical" },
    { id: "healthy", tone: "healthy" },
    { id: "invalid", tone: "unavailable" },
  ]);
});

test("health tones and indexed-source copy are explicit and deterministic", () => {
  assert.equal(classifyHealthTone(null), "unavailable");
  assert.equal(classifyHealthTone(39), "critical");
  assert.equal(classifyHealthTone(40), "attention");
  assert.equal(classifyHealthTone(69), "attention");
  assert.equal(classifyHealthTone(70), "healthy");
  assert.equal(formatIndexedSourceCount(null), "Knowledge source unavailable");
  assert.equal(formatIndexedSourceCount(0), "No indexed sources");
  assert.equal(formatIndexedSourceCount(1), "1 indexed source");
  assert.equal(formatIndexedSourceCount(2), "2 indexed sources");
});

test("activity trace is newest first with truthful event tones", () => {
  const trace = buildActivityTrace([
    { id: "old", agent: "Sol", action: "Started", status: "running", created_at: "2026-07-15T10:00:00.000Z" },
    { id: "new", agent: "Sol", action: "Failed", status: "error", created_at: "2026-07-15T11:00:00.000Z" },
    { id: "done", agent: "Hermes", action: "Verified", status: "success", created_at: "2026-07-15T10:30:00.000Z" },
  ]);

  assert.deepEqual(trace.map(({ id, tone, order }) => ({ id, tone, order })), [
    { id: "new", tone: "error", order: 0 },
    { id: "done", tone: "success", order: 1 },
    { id: "old", tone: "active", order: 2 },
  ]);
});

test("knowledge graph creates only provable project membership edges", () => {
  const projects = [{ id: "p1", name: "SHAGGY" }];
  const docs = [
    { id: "d1", name: "Canon", project_id: "p1", embedding_status: "indexed" },
    { id: "d2", name: "Orphan", embedding_status: "pending" },
  ];
  const first = buildKnowledgeGraph(projects, docs);
  const second = buildKnowledgeGraph(projects, docs);

  assert.deepEqual(first, second);
  assert.equal(first.nodes.length, 3);
  assert.deepEqual(first.edges, [{ source: "project:p1", target: "doc:d1" }]);
  assert.equal(first.nodes.find((node) => node.id === "doc:d2")?.group, "unassigned");
});

test("knowledge graph labels use readable non-overlapping edge-aware placements", () => {
  const base = { id: "node", label: "Label", group: "g", status: "ready" };
  assert.deepEqual(getKnowledgeGraphLabelPlacement({ ...base, kind: "project", x: 50, y: 20 }), { x: 50, y: 30, textAnchor: "middle" });
  assert.deepEqual(getKnowledgeGraphLabelPlacement({ ...base, kind: "document", x: 61, y: 20 }), { x: 61, y: 16, textAnchor: "middle" });
  assert.deepEqual(getKnowledgeGraphLabelPlacement({ ...base, kind: "project", x: 74, y: 62 }), { x: 96, y: 55, textAnchor: "end" });
  assert.deepEqual(getKnowledgeGraphLabelPlacement({ ...base, kind: "project", x: 26, y: 62 }), { x: 4, y: 72, textAnchor: "start" });
  assert.equal(formatKnowledgeGraphLabel("A very long project label"), "A very long pro…");
  assert.equal(formatKnowledgeGraphLabel("MoveID"), "MoveID");
});

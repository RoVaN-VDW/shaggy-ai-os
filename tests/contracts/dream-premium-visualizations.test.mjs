import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Dream command center composes truthful premium visualizations", async () => {
  const component = await source("src/features/command-center/components/DreamCommandCenter.tsx");
  for (const name of ["MissionHealthGauge", "SystemUsageTrend", "ProjectHealthBars", "ActivityTrace", "KnowledgeGraph", "SecondBrainTwinSummary", "CommandPulse"]) {
    assert.match(component, new RegExp(`<${name}\\b`), `${name} is not rendered`);
  }
  assert.doesNotMatch(component, /mission\.progress/);
  assert.match(component, /mission\.health/);
});

test("premium visualizations use real SVG or Recharts and no second RAF loop", async () => {
  const [charts, pulse, twin] = await Promise.all([
    source("src/features/command-center/components/visualization/SystemUsageTrend.tsx"),
    source("src/features/command-center/components/visualization/CommandPulse.tsx"),
    source("src/features/command-center/components/visualization/SecondBrainTwinSummary.tsx"),
  ]);
  assert.match(charts, /AreaChart/);
  assert.match(charts, /dataKey="cost"/);
  assert.match(pulse, /useReducedMotion/);
  assert.doesNotMatch(pulse, /requestAnimationFrame/);
  assert.match(twin, /Second Brain/);
  assert.match(twin, /buildSecondBrainContinuitySummary/);
  assert.match(twin, /file continuity/);
  assert.match(twin, /snapshot\.openActions\s*===\s*null\s*\?\s*["']Unavailable["']/);
  assert.match(twin, /data-state=\{continuity\.state\}/);
});

test("premium visualization CSS preserves interaction and reduced-motion boundaries", async () => {
  const css = await source("src/features/command-center/tokens.css");
  for (const selector of [".dream-health-gauge", ".dream-usage-trend", ".dream-health-bars", ".dream-activity-trace", ".dream-knowledge-graph", ".dream-twin-summary", ".dream-command-pulse"]) {
    assert.match(css, new RegExp(selector.replace(".", "\\.")));
  }
  assert.match(css, /\.dream-command-pulse\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*\.dream-command-pulse/);
  assert.doesNotMatch(css, /\.dream-health-bar\s*>\s*i\s*>\s*b\s*\{[^}]*linear-gradient\([^}]*--dream-critical[^}]*--dream-success/s);
  assert.match(css, /\.dream-health-bar\[data-tone="healthy"\]/);
  assert.match(css, /\.dream-knowledge-node__label/);
});

test("low-data knowledge and cognitive dock remain truthful and useful", async () => {
  const [dashboard, graph] = await Promise.all([
    source("src/features/command-center/components/DreamCommandCenter.tsx"),
    source("src/features/command-center/components/visualization/KnowledgeGraph.tsx"),
  ]);
  assert.match(dashboard, /formatIndexedSourceCount\(model\.knowledgeCount\)/);
  assert.match(dashboard, /model\.cognitiveSpaces\.map/);
  assert.match(dashboard, /Index more sources/);
  assert.match(graph, /dream-knowledge-node__label/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../../", import.meta.url);

test("dashboard motion grammar exposes causal pointer focus press and truthful status feedback", async () => {
  const [styles, component, command] = await Promise.all([
    readFile(new URL("src/features/command-center/tokens.css", root), "utf8"),
    readFile(new URL("src/features/command-center/components/DreamCommandCenter.tsx", root), "utf8"),
    readFile(new URL("src/features/command-center/components/GlobalCommand.tsx", root), "utf8"),
  ]);

  assert.match(component, /handleDashboardPointerMove/);
  assert.match(component, /closest<HTMLElement>\("\.dream-panel"\)/);
  assert.match(component, /onPointerMove=\{handleDashboardPointerMove\}/);
  assert.match(styles, /\.dream-panel::before\s*\{[^}]*--pointer-x/s);
  assert.match(styles, /:focus-visible\s*\{/);
  assert.match(styles, /:where\(a,button\):active\s*\{/);
  assert.match(styles, /\[aria-busy="true"\]/);
  assert.match(styles, /:has\(\.dream-source-meta--stale\)/);
  assert.match(styles, /:has\(\.dream-source-meta--error\)/);
  assert.match(component, /ACTIVE_ENTITY_STATES:\s*ReadonlySet<EntityState>/);
  assert.match(component, /data-active=\{isEntityWaveActive\(entityState\)\}/);
  assert.match(styles, /\.dream-entity__wave\[data-active="true"\]\s+i\s*\{[^}]*animation:/s);
  assert.match(styles, /\.dream-entity__wave\s*\{[^}]*opacity:\s*0/s);
  assert.match(styles, /\.dream-entity__wave\[data-active="true"\]\s*\{[^}]*opacity:/s);
  assert.match(command, /Voice input unavailable/);
  assert.match(command, /dream-command-voice-status/);
  assert.match(styles, /\.dream-empty\s*\{[^}]*border:/s);
  assert.match(styles, /prefers-reduced-motion:[^)]+\)[^{]*\{[^}]*\.dream-panel::before/s);
});

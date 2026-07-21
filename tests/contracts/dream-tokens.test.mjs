import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const REQUIRED_TOKENS = {
  "--dream-os-black": "#020609",
  "--dream-os-navy": "#061019",
  "--dream-cyan": "#00d4ff",
  "--dream-cyan-hot": "#42e9ff",
  "--dream-gold": "#f0b429",
  "--dream-gold-hot": "#ffd36a",
  "--dream-success": "#1de9a4",
  "--dream-warning": "#f4b526",
  "--dream-critical": "#ff4d45",
  "--dream-text": "#f3f7fa",
  "--dream-muted": "#8d9aa6",
  "--dream-motion-micro": "160ms",
  "--dream-motion-panel": "320ms",
  "--dream-motion-entity": "520ms",
};

test("Dream v3 exposes the canonical visual and motion tokens", async () => {
  const [tokens, globals] = await Promise.all([
    readFile(resolve(root, "src/features/command-center/tokens.css"), "utf8"),
    readFile(resolve(root, "src/app/globals.css"), "utf8"),
  ]);

  assert.match(globals, /@import\s+["']\.\.\/features\/command-center\/tokens\.css["'];/);
  for (const [name, value] of Object.entries(REQUIRED_TOKENS)) {
    assert.match(tokens.toLowerCase(), new RegExp(`${name}:\\s*${value.replace("#", "#")}`));
  }
  assert.match(tokens, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(tokens, /--dream-glass-blur:\s*18px/);
  assert.match(tokens, /--dream-region-gap:\s*12px/);
});

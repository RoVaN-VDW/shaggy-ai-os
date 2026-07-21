import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../../", import.meta.url);

test("Dream typography remains readable after fixed-screen scaling", async () => {
  const [styles, ...shellComponents] = await Promise.all([
    readFile(new URL("src/features/command-center/tokens.css", root), "utf8"),
    readFile(new URL("src/features/command-center/components/ProductIdentity.tsx", root), "utf8"),
    readFile(new URL("src/features/command-center/components/PrimarySidebar.tsx", root), "utf8"),
    readFile(new URL("src/features/command-center/components/SystemStatus.tsx", root), "utf8"),
    readFile(new URL("src/features/command-center/components/UtilityProfile.tsx", root), "utf8"),
  ]);
  const shellTypography = shellComponents.join("\n");

  assert.match(styles, /--dream-type-micro:\s*11px;/);
  assert.match(styles, /--dream-type-caption:\s*12px;/);
  assert.match(styles, /--dream-type-body:\s*13px;/);
  assert.match(styles, /--dream-type-control:\s*14px;/);
  assert.doesNotMatch(styles, /font-size:\s*(?:7|8|9|10)px;/);
  assert.match(styles, /\.dream-panel-title\s*\{[^}]*font-size:\s*var\(--dream-type-caption\)/s);
  assert.match(styles, /\.dream-knowledge-node__label\s*\{[^}]*font-size:\s*var\(--dream-type-micro\)/s);
  assert.match(styles, /\.dream-list-item b,[^{]+\{[^}]*font-size:\s*var\(--dream-type-body\)/s);
  assert.match(styles, /\.dream-footer[^}]+small[^}]*font-size:var\(--dream-type-micro\)/s);
  assert.doesNotMatch(shellTypography, /text-\[(?:7|8|9|10)px\]/);
  assert.match(shellTypography, /PrimarySidebar[\s\S]+text-\[12px\]/);
  assert.match(shellTypography, /System Status[\s\S]+text-\[12px\]/);
});

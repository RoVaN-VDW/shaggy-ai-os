import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const layout = await import("../../src/features/command-center/layout-contract.ts");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const TARGET_VIEWPORTS = [
  { width: 1536, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 3840, height: 2160 },
];

const MACBOOK_VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1512, height: 857 },
  { width: 1440, height: 820 },
];

const LOWER_CARD_IDS = ["knowledge-map", "project-portfolio", "digital-twin", "system-insights"];
const FOOTER_IDS = ["command-mode-footer", "trust-status-footer", "brand-promise"];

test("the canonical dashboard scales as one centered plane without lower-card/footer overlap", () => {
  assert.equal(typeof layout.computeDreamViewportTransform, "function", "viewport transform contract is missing");
  assert.equal(typeof layout.projectLayoutRegion, "function", "region projection contract is missing");

  const lowerCards = layout.DREAM_REGIONS.filter((region) => LOWER_CARD_IDS.includes(region.id));
  const footers = layout.DREAM_REGIONS.filter((region) => FOOTER_IDS.includes(region.id));

  for (const viewport of TARGET_VIEWPORTS) {
    const transform = layout.computeDreamViewportTransform(viewport);
    const expectedScale = Math.min(
      viewport.width / layout.CANONICAL_VIEWPORT.width,
      viewport.height / layout.CANONICAL_VIEWPORT.height,
    );

    assert.ok(Math.abs(transform.scale - expectedScale) < 1e-9, `${viewport.width}×${viewport.height} uses height-aware scale`);
    assert.ok(transform.offsetX >= 0 && transform.offsetY >= 0, `${viewport.width}×${viewport.height} stays inside the viewport`);
    assert.ok(Math.abs((layout.CANONICAL_VIEWPORT.width * transform.scale) + (2 * transform.offsetX) - viewport.width) < 1e-6 || transform.offsetY === 0);
    assert.ok(Math.abs((layout.CANONICAL_VIEWPORT.height * transform.scale) + (2 * transform.offsetY) - viewport.height) < 1e-6 || transform.offsetX === 0);

    const projectedCards = lowerCards.map((region) => layout.projectLayoutRegion(region, transform));
    const projectedFooters = footers.map((region) => layout.projectLayoutRegion(region, transform));
    const lowerBottom = Math.max(...projectedCards.map((region) => region.y + region.height));
    const footerTop = Math.min(...projectedFooters.map((region) => region.y));

    assert.ok(footerTop > lowerBottom, `${viewport.width}×${viewport.height} preserves visible card/footer separation`);
    assert.ok(Math.abs((footerTop - lowerBottom) - (10 * transform.scale)) < 1e-6, `${viewport.width}×${viewport.height} preserves the canonical gap`);
  }
});

test("the production shell applies the shared viewport transform to cards and footer", async () => {
  const [appShell, commandCenter, viewport, styles] = await Promise.all([
    readFile(resolve(ROOT, "src/features/command-center/components/AppShell.tsx"), "utf8"),
    readFile(resolve(ROOT, "src/features/command-center/components/DreamCommandCenter.tsx"), "utf8"),
    readFile(resolve(ROOT, "src/features/command-center/components/DreamViewport.tsx"), "utf8").catch(() => ""),
    readFile(resolve(ROOT, "src/features/command-center/tokens.css"), "utf8"),
  ]);

  assert.match(appShell, /<DreamViewport>[\s\S]*className="dream-shell"[\s\S]*<TrustFooter\s*\/>[\s\S]*<\/DreamViewport>/);
  assert.doesNotMatch(commandCenter, /className="dream-footer"/);
  assert.match(viewport, /computeDreamViewportTransform/);
  assert.match(viewport, /ResizeObserver/);
  assert.match(viewport, /data-layout=\{transform\?\.layout \?\? "standard"\}/);
  assert.match(viewport, /width:\s*`\$\{transform\.canonicalWidth\}px`/);
  assert.match(styles, /\.dream-viewport__canvas\s*\{[^}]*width:\s*1536px;[^}]*height:\s*1024px;/s);
  assert.doesNotMatch(styles, /\.dream-viewport__canvas\[data-layout="wide"\][^}]*width:\s*1792px/s);
  assert.match(styles, /\.dream-viewport__canvas\[data-layout="wide"\]\s+\.dream-shell\s*\{[^}]*width:\s*100%;/s);
  assert.match(styles, /\.dream-viewport__canvas\[data-layout="wide"\]\s+\.dream-shell__command[^}]*calc\(50% - 297px\)/s);
  assert.match(styles, /\.dream-viewport__canvas\[data-layout="wide"\]\s+\.dream-dashboard\s*\{[^}]*--dream-face-frame-left:\s*clamp\(360px,26%,440px\);[^}]*--dream-face-frame-right:\s*clamp\(440px,27%,500px\);/s);
  assert.match(styles, /\.dream-viewport__canvas\[data-layout="wide"\]\s+\.dream-briefing,[^{]+\.dream-activity\s*\{[^}]*right:\s*0;[^}]*width:\s*var\(--dream-face-frame-right\);/s);
  assert.match(styles, /\.dream-viewport__canvas\[data-layout="wide"\]\s+\.dream-dock\s*\{[^}]*left:\s*0;[^}]*width:\s*100%;/s);
  assert.match(styles, /\.dream-viewport__canvas\[data-layout="wide"\]\s+\.dream-insights[^}]*left:\s*calc\(62% \+ 18px\)/s);
  assert.match(styles, /\.dream-footer\s*\{[^}]*position:\s*absolute;/s);
  assert.doesNotMatch(styles, /\.dream-footer\s*\{[^}]*position:\s*fixed;/s);
  assert.doesNotMatch(styles, /@media\s*\(max-width:\s*1360px\)/);
});

test("wide laptop viewports use a native wide scene without horizontal distortion or gutters", async () => {
  assert.equal(typeof layout.getDreamRegionsForLayout, "function", "fluid region selector is missing");

  for (const viewport of MACBOOK_VIEWPORTS) {
    const transform = layout.computeDreamViewportTransform(viewport);
    const usedWidth = transform.canonicalWidth * transform.scale;
    const expectedCanonicalWidth = viewport.width * transform.canonicalHeight / viewport.height;

    assert.equal(transform.layout, "wide", `${viewport.width}×${viewport.height} selects the fluid scene`);
    assert.ok(Math.abs(transform.canonicalWidth - expectedCanonicalWidth) < 0.001, `${viewport.width}×${viewport.height} follows the exact viewport aspect ratio`);
    assert.ok(Math.abs(usedWidth - viewport.width) < 0.001, `${viewport.width}×${viewport.height} fills the full width`);
    assert.ok(Math.abs(transform.offsetX) < 0.001, `${viewport.width}×${viewport.height} has no horizontal gutter`);
    assert.ok(Math.abs(transform.offsetY) < 0.001, `${viewport.width}×${viewport.height} has no vertical gutter`);

    const regions = layout.getDreamRegionsForLayout(transform.layout, transform.canonicalWidth);
    const lowerCards = regions.filter((region) => LOWER_CARD_IDS.includes(region.id));
    const footers = regions.filter((region) => FOOTER_IDS.includes(region.id));
    const dock = regions.find((region) => region.id === "cognitive-dock");
    const mission = regions.find((region) => region.id === "todays-mission");
    const entity = regions.find((region) => region.id === "neural-entity-stage");
    const briefing = regions.find((region) => region.id === "intelligence-briefing");
    const activity = regions.find((region) => region.id === "live-activity");
    const projectedCards = lowerCards.map((region) => layout.projectLayoutRegion(region, transform));
    const projectedFooters = footers.map((region) => layout.projectLayoutRegion(region, transform));
    const lowerBottom = Math.max(...projectedCards.map((region) => region.y + region.height));
    const footerTop = Math.min(...projectedFooters.map((region) => region.y));

    assert.ok(footerTop > lowerBottom, `${viewport.width}×${viewport.height} preserves card/footer separation`);
    assert.ok(mission.width >= 360, `${viewport.width}×${viewport.height} gives the mission rail premium reading width`);
    assert.ok(briefing.width >= 440 && activity.width === briefing.width, `${viewport.width}×${viewport.height} gives the right rail premium reading width`);
    assert.equal(dock.x, mission.x, `${viewport.width}×${viewport.height} aligns the dock with the face frame`);
    assert.ok(Math.abs(dock.width - (transform.canonicalWidth - 249)) < 0.001, `${viewport.width}×${viewport.height} spans the full dashboard width`);
    assert.equal(dock.y - (mission.y + mission.height), 12, `${viewport.width}×${viewport.height} keeps a twelve-pixel mission/dock gap`);
    assert.equal(dock.y - (activity.y + activity.height), 12, `${viewport.width}×${viewport.height} keeps a twelve-pixel activity/dock gap`);
    const corridorCenter = ((mission.x + mission.width) + briefing.x) / 2;
    assert.ok(Math.abs((entity.x + (entity.width / 2)) - corridorCenter) < 0.001, `${viewport.width}×${viewport.height} centers the entity between both rails`);
  }

  const golden = layout.computeDreamViewportTransform({ width: 1536, height: 1024 });
  assert.equal(golden.layout, "standard", "Golden Frame remains the canonical standard scene");
  assert.equal(golden.scale, 1);
});

test("development visual QA hides the Next indicator instead of padding production footer content", async () => {
  const config = await readFile(resolve(ROOT, "next.config.ts"), "utf8");
  assert.match(config, /devIndicators:\s*false/);
});

export const CANONICAL_VIEWPORT = Object.freeze({ width: 1536, height: 1024 });
export const WIDE_LAYOUT_MIN_ASPECT = CANONICAL_VIEWPORT.width / CANONICAL_VIEWPORT.height;

export type DreamLayout = "standard" | "wide";

export const DREAM_REGION_IDS = [
  "product-identity",
  "global-command",
  "utility-profile",
  "primary-sidebar",
  "system-status",
  "todays-mission",
  "neural-entity-stage",
  "intelligence-briefing",
  "live-activity",
  "cognitive-dock",
  "knowledge-map",
  "project-portfolio",
  "digital-twin",
  "system-insights",
  "command-mode-footer",
  "trust-status-footer",
  "brand-promise",
  "ambient-background",
] as const;

export type DreamRegionId = (typeof DREAM_REGION_IDS)[number];

export type LayoutRegion = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ViewportSize = {
  width: number;
  height: number;
};

export type DreamViewportTransform = {
  layout: DreamLayout;
  canonicalWidth: number;
  canonicalHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
};

export const DREAM_REGIONS = [
  { id: "product-identity", label: "Product identity", x: 16, y: 14, width: 197, height: 51 },
  { id: "global-command", label: "Global command", x: 466, y: 15, width: 594, height: 49 },
  { id: "utility-profile", label: "Utility and profile", x: 1195, y: 14, width: 320, height: 51 },
  { id: "primary-sidebar", label: "Primary sidebar", x: 16, y: 79, width: 197, height: 574 },
  { id: "system-status", label: "System status", x: 16, y: 664, width: 197, height: 204 },
  { id: "todays-mission", label: "Today's mission", x: 224, y: 80, width: 317, height: 427 },
  { id: "neural-entity-stage", label: "Neural entity stage", x: 518, y: 65, width: 572, height: 512 },
  { id: "intelligence-briefing", label: "Intelligence briefing", x: 1100, y: 79, width: 411, height: 332 },
  { id: "live-activity", label: "Live activity", x: 1100, y: 421, width: 411, height: 216 },
  { id: "cognitive-dock", label: "Cognitive dock", x: 273, y: 578, width: 812, height: 64 },
  { id: "knowledge-map", label: "Knowledge map", x: 224, y: 658, width: 232, height: 257 },
  { id: "project-portfolio", label: "Project portfolio", x: 466, y: 658, width: 259, height: 257 },
  { id: "digital-twin", label: "Digital twin", x: 737, y: 658, width: 322, height: 257 },
  { id: "system-insights", label: "System insights", x: 1070, y: 658, width: 441, height: 257 },
  { id: "command-mode-footer", label: "Command mode footer", x: 16, y: 925, width: 325, height: 81 },
  { id: "trust-status-footer", label: "Trust and status footer", x: 362, y: 925, width: 761, height: 81 },
  { id: "brand-promise", label: "Brand promise", x: 1135, y: 925, width: 376, height: 81 },
  { id: "ambient-background", label: "Ambient background", x: 0, y: 0, width: 1536, height: 1024 },
] as const satisfies readonly LayoutRegion[];

export function getDreamRegionsForLayout(
  layout: DreamLayout,
  canonicalWidth = CANONICAL_VIEWPORT.width,
): readonly LayoutRegion[] {
  if (layout === "standard") return DREAM_REGIONS;

  const dashboardWidth = canonicalWidth - 249;
  const faceFrameLeft = Math.min(440, Math.max(360, dashboardWidth * 0.26));
  const faceFrameRight = Math.min(500, Math.max(440, dashboardWidth * 0.27));
  const faceCorridorX = 224 + faceFrameLeft + 12;
  const faceCorridorWidth = dashboardWidth - faceFrameLeft - faceFrameRight - 24;
  const overrides: Partial<Record<DreamRegionId, Partial<LayoutRegion>>> = {
    "global-command": { x: (canonicalWidth / 2) - 297 },
    "utility-profile": { x: canonicalWidth - 336 },
    "todays-mission": { width: faceFrameLeft, height: 486 },
    "neural-entity-stage": { x: faceCorridorX, width: faceCorridorWidth },
    "intelligence-briefing": {
      x: canonicalWidth - 25 - faceFrameRight,
      width: faceFrameRight,
      height: 316,
    },
    "live-activity": {
      x: canonicalWidth - 25 - faceFrameRight,
      y: 407,
      width: faceFrameRight,
      height: 159,
    },
    "cognitive-dock": { x: 224, width: dashboardWidth },
    "knowledge-map": { width: (dashboardWidth * 0.18) - 6 },
    "project-portfolio": {
      x: 224 + (dashboardWidth * 0.18) + 6,
      width: (dashboardWidth * 0.2) - 6,
    },
    "digital-twin": {
      x: 224 + (dashboardWidth * 0.38) + 12,
      width: (dashboardWidth * 0.24) - 6,
    },
    "system-insights": {
      x: 224 + (dashboardWidth * 0.62) + 18,
      width: (dashboardWidth * 0.38) - 18,
    },
    "trust-status-footer": { width: canonicalWidth - 775 },
    "brand-promise": { x: canonicalWidth - 392 },
    "ambient-background": { width: canonicalWidth },
  };

  return DREAM_REGIONS.map((region) => ({
    ...region,
    ...overrides[region.id],
  }));
}

export function computeDreamViewportTransform(viewport: ViewportSize): DreamViewportTransform {
  const layout: DreamLayout = viewport.width / viewport.height > WIDE_LAYOUT_MIN_ASPECT
    ? "wide"
    : "standard";
  const canonical = layout === "wide"
    ? {
        width: viewport.width * CANONICAL_VIEWPORT.height / viewport.height,
        height: CANONICAL_VIEWPORT.height,
      }
    : CANONICAL_VIEWPORT;
  const scale = Math.min(
    viewport.width / canonical.width,
    viewport.height / canonical.height,
  );

  return {
    layout,
    canonicalWidth: canonical.width,
    canonicalHeight: canonical.height,
    scale,
    offsetX: (viewport.width - (canonical.width * scale)) / 2,
    offsetY: (viewport.height - (canonical.height * scale)) / 2,
  };
}

export function projectLayoutRegion(
  region: LayoutRegion,
  transform: DreamViewportTransform,
): LayoutRegion {
  return {
    ...region,
    x: transform.offsetX + (region.x * transform.scale),
    y: transform.offsetY + (region.y * transform.scale),
    width: region.width * transform.scale,
    height: region.height * transform.scale,
  };
}

export function validateLayoutContract(regions: readonly LayoutRegion[]) {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const region of regions) {
    if (seen.has(region.id)) {
      errors.push(`duplicate region id: ${region.id}`);
    }
    seen.add(region.id);

    if (region.width <= 0 || region.height <= 0) {
      errors.push(`${region.id} must have positive dimensions`);
    }

    const outside =
      region.x < 0 ||
      region.y < 0 ||
      region.x + region.width > CANONICAL_VIEWPORT.width ||
      region.y + region.height > CANONICAL_VIEWPORT.height;

    if (outside) {
      errors.push(`${region.id} is outside the 1536×1024 viewport`);
    }
  }

  return errors;
}

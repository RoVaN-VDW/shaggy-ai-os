export type RenderMotion = "full" | "reduced";
export type RenderQuality = "static" | "low" | "medium" | "high";

export type RenderPolicy = {
  motion: RenderMotion;
  quality: RenderQuality;
  visible: boolean;
  dpr: number;
};

export type RenderPolicyInput = {
  reducedMotion: boolean;
  quality: RenderQuality;
  visible: boolean;
  dpr: number;
};

export function createRenderPolicy(input: RenderPolicyInput): RenderPolicy {
  return {
    motion: input.reducedMotion ? "reduced" : "full",
    quality: input.quality,
    visible: input.visible,
    dpr: Math.min(Math.max(input.dpr, 1), 2),
  };
}

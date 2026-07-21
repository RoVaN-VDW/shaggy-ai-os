import type { EntityState } from "./entity-state";

export type EntityRendererMode = "legacy" | "v2";
export type LegacyEntityState = "idle" | "thinking" | "warning";

export function resolveEntityRenderer(flag: string | undefined): EntityRendererMode {
  return flag === "false" ? "legacy" : "v2";
}

export function mapEntityStateToLegacy(state: EntityState): LegacyEntityState {
  if (state === "error" || state === "warning") return "warning";
  if (state === "booting" || state === "understanding") return "thinking";
  return "idle";
}

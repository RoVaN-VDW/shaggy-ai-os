import type { RenderPolicy } from "../core/render-policy";
import type { RafLifecycle } from "./raf-lifecycle";

type RendererPolicy = Pick<RenderPolicy, "visible" | "motion">;

export function applyRendererPolicy(
  lifecycle: RafLifecycle,
  policy: RendererPolicy,
) {
  if (!policy.visible) {
    lifecycle.stop();
    return;
  }
  if (policy.motion === "reduced") {
    lifecycle.stop();
    lifecycle.renderOnce();
    return;
  }
  lifecycle.start();
}

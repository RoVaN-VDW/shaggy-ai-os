import assert from "node:assert/strict";
import { test } from "node:test";

import { applyRendererPolicy } from "../../src/features/entity/render/perf.ts";

function recordLifecycle() {
  const calls = [];
  return {
    calls,
    lifecycle: {
      start: () => calls.push("start"),
      renderOnce: () => calls.push("renderOnce"),
      stop: () => calls.push("stop"),
    },
  };
}

test("render policy selects continuous one-shot or stopped lifecycle", () => {
  const hidden = recordLifecycle();
  applyRendererPolicy(hidden.lifecycle, { visible: false, motion: "full" });
  assert.deepEqual(hidden.calls, ["stop"]);

  const reduced = recordLifecycle();
  applyRendererPolicy(reduced.lifecycle, { visible: true, motion: "reduced" });
  assert.deepEqual(reduced.calls, ["stop", "renderOnce"]);

  const active = recordLifecycle();
  applyRendererPolicy(active.lifecycle, { visible: true, motion: "full" });
  assert.deepEqual(active.calls, ["start"]);
});

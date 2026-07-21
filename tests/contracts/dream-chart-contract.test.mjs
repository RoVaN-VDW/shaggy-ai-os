import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveChartState } from "../../src/features/command-center/visualization/chart-contract.ts";

const base = { source: "supabase:get_daily_usage", fetchedAt: "2026-07-15T12:00:00.000Z", error: null };

test("chart truth state distinguishes insufficient history from unavailable data", () => {
  assert.equal(resolveChartState({ ...base, status: "live" }, 1, 2).status, "insufficient");
  assert.equal(resolveChartState({ ...base, status: "live" }, 2, 2).status, "live");
  assert.equal(resolveChartState({ ...base, status: "stale" }, 2, 2).status, "stale");
  assert.equal(resolveChartState({ ...base, status: "error", error: "denied" }, 10, 2).status, "error");
  assert.equal(resolveChartState({ ...base, status: "unavailable" }, 0, 2).status, "unavailable");
});

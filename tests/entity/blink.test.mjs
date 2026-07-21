import assert from "node:assert/strict";
import { test } from "node:test";

const blink = await import("../../src/features/entity/core/blink.ts").catch(() => ({}));

test("seeded blink schedules are deterministic and restrained", () => {
  assert.equal(typeof blink.createSeededBlinkSchedule, "function", "seeded blink scheduler is missing");

  const first = blink.createSeededBlinkSchedule({ seed: 7717, count: 10, startAt: 0 });
  const replay = blink.createSeededBlinkSchedule({ seed: 7717, count: 10, startAt: 0 });
  const alternate = blink.createSeededBlinkSchedule({ seed: 7718, count: 10, startAt: 0 });

  assert.deepEqual(first, replay);
  assert.notDeepEqual(first, alternate);
  for (const [index, event] of first.entries()) {
    const previousAt = index === 0 ? 0 : first[index - 1].at;
    assert.ok(event.at - previousAt >= 2800);
    assert.ok(event.at - previousAt <= 6200);
    assert.ok(event.duration >= 120);
    assert.ok(event.duration <= 180);
  }
});

test("blink closure peaks once and remains open outside the event", () => {
  assert.equal(typeof blink.sampleBlinkClosure, "function", "blink sampler is missing");

  const event = { at: 1000, duration: 160 };
  assert.equal(blink.sampleBlinkClosure(event, 999), 0);
  assert.equal(blink.sampleBlinkClosure(event, 1000), 0);
  assert.equal(blink.sampleBlinkClosure(event, 1080), 1);
  assert.equal(blink.sampleBlinkClosure(event, 1160), 0);
  assert.equal(blink.sampleBlinkClosure(event, 1200), 0);
  assert.ok(blink.sampleBlinkClosure(event, 1040) > 0);
  assert.ok(blink.sampleBlinkClosure(event, 1040) < 1);
});

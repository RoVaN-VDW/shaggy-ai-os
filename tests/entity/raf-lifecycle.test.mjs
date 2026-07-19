import assert from "node:assert/strict";
import { test } from "node:test";

import { createRafLifecycle } from "../../src/features/entity/render/raf-lifecycle.ts";

function createFakeRaf() {
  let nextId = 1;
  const pending = new Map();
  return {
    pending,
    request(callback) {
      const id = nextId;
      nextId += 1;
      pending.set(id, callback);
      return id;
    },
    cancel(id) {
      pending.delete(id);
    },
    flushOne(time = 0) {
      const entry = pending.entries().next().value;
      if (!entry) return;
      const [id, callback] = entry;
      pending.delete(id);
      callback(time);
    },
  };
}

test("RAF lifecycle deduplicates starts and resize renders and cleans every handle", () => {
  const fake = createFakeRaf();
  let renders = 0;
  const lifecycle = createRafLifecycle({
    requestFrame: (callback) => fake.request(callback),
    cancelFrame: (id) => fake.cancel(id),
    render: () => { renders += 1; },
  });

  lifecycle.start();
  lifecycle.start();
  lifecycle.renderOnce();
  assert.equal(fake.pending.size, 1);

  fake.flushOne(16);
  assert.equal(renders, 1);
  assert.equal(fake.pending.size, 1);

  lifecycle.renderOnce();
  lifecycle.renderOnce();
  assert.equal(fake.pending.size, 1);

  lifecycle.stop();
  assert.equal(fake.pending.size, 0);

  for (let cycle = 0; cycle < 50; cycle += 1) {
    lifecycle.start();
    lifecycle.stop();
  }
  assert.equal(fake.pending.size, 0);
});

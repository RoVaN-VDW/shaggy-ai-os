import assert from "node:assert/strict";
import { test } from "node:test";

import { createNeutralFacePose } from "../../src/features/entity/core/face-pose.ts";
import { createCanvasRenderer } from "../../src/features/entity/render/canvas-renderer.ts";
import { createFaceGeometry } from "../../src/features/entity/render/geometry.ts";
import { createFaceTopology } from "../../src/features/entity/render/topology.ts";

test("missing 2D context returns an explicit static fallback renderer", () => {
  const geometry = createFaceGeometry({ seed: 4242, neuralPointCount: 24 });
  const topology = createFaceTopology(geometry);
  const renderer = createCanvasRenderer({
    canvas: { getContext: () => null },
    geometry,
    topology,
  });

  assert.deepEqual(renderer, {
    mode: "fallback",
    reason: "canvas-context-unavailable",
  });
});

function createRecordingContext() {
  const operations = [];
  const record = (name) => () => { operations.push(name); };
  return {
    operations,
    setTransform: record("setTransform"),
    clearRect: record("clearRect"),
    beginPath: record("beginPath"),
    closePath: record("closePath"),
    moveTo: record("moveTo"),
    lineTo: record("lineTo"),
    quadraticCurveTo: record("quadraticCurveTo"),
    ellipse: record("ellipse"),
    arc: record("arc"),
    stroke: record("stroke"),
    fill: record("fill"),
    save: record("save"),
    restore: record("restore"),
    createRadialGradient() {
      operations.push("createRadialGradient");
      return { addColorStop: record("addColorStop") };
    },
  };
}

test("canvas renderer draws a complete static T1 anatomy frame", () => {
  const geometry = createFaceGeometry({ seed: 4242, neuralPointCount: 32 });
  const topology = createFaceTopology(geometry);
  const context = createRecordingContext();
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    getContext: () => context,
  };
  const renderer = createCanvasRenderer({ canvas, geometry, topology });

  assert.equal(renderer.mode, "canvas");
  renderer.render({
    width: 572,
    height: 498,
    dpr: 3,
    pose: createNeutralFacePose(),
    state: "idle",
    time: 0,
  });

  assert.equal(canvas.width, 1144);
  assert.equal(canvas.height, 996);
  assert.ok(context.operations.filter((operation) => operation === "ellipse").length >= 2);
  assert.ok(context.operations.filter((operation) => operation === "arc").length >= 34);
  assert.ok(context.operations.filter((operation) => operation === "lineTo").length >= 20);
});

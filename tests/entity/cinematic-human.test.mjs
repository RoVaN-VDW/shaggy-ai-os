import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const identityPath = resolve(root, "public/entity/shaggy-cinematic-human.png");

function readPngDimensions(buffer) {
  assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(buffer.subarray(12, 16).toString("ascii"), "IHDR");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test("the approved cinematic human identity is an immutable production asset", async () => {
  const buffer = await readFile(identityPath);

  assert.deepEqual(readPngDimensions(buffer), { width: 1254, height: 1254 });
  assert.equal(
    createHash("sha256").update(buffer).digest("hex"),
    "04e092f8f491f9605c98da68dbf9268c853dbf343058336ebcdbd7ed2f0b815c",
  );
});

test("NeuralEntity keeps the human portrait above peripheral renderer effects", async () => {
  const component = await readFile(
    resolve(root, "src/features/entity/components/NeuralEntity.tsx"),
    "utf8",
  );
  const styles = await readFile(
    resolve(root, "src/features/command-center/tokens.css"),
    "utf8",
  );

  assert.match(component, /className="neural-entity-v2__portrait"/);
  assert.match(
    styles,
    /\.neural-entity-v2__portrait\s*\{[^}]*background-image:\s*url\("\/entity\/shaggy-cinematic-human\.png"\)[^}]*z-index:\s*2/s,
  );
  assert.match(styles, /\.neural-entity-v2__canvas\s*\{[^}]*z-index:\s*1/s);
  assert.match(styles, /\[data-state="error"\]\s+\.neural-entity-v2__portrait/);
});

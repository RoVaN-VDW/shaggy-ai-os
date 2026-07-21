import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const GOLDEN_FRAME_CONTRACT = Object.freeze({
  width: 1536,
  height: 1024,
  bytes: 1_911_686,
  sha256: "238a051d8c2fe3ce6e8021822770895f4c46bb6667fc93c2bd5b08428dd3ae76",
  canonicalPath: "design-source/canonical/v3/Golden-Frame-01.png",
});

function readPngDimensions(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature || buffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("Golden Frame is not a valid PNG with an IHDR header.");
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

export async function verifyGoldenFrame(root = process.cwd()) {
  const filePath = resolve(root, GOLDEN_FRAME_CONTRACT.canonicalPath);
  const buffer = await readFile(filePath);
  const dimensions = readPngDimensions(buffer);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const result = { ...dimensions, bytes: buffer.byteLength, sha256 };
  const mismatches = Object.entries(result)
    .filter(([key, value]) => value !== GOLDEN_FRAME_CONTRACT[key])
    .map(([key, value]) => `${key}: expected ${GOLDEN_FRAME_CONTRACT[key]}, received ${value}`);

  if (mismatches.length > 0) {
    throw new Error(`Golden Frame contract mismatch:\n${mismatches.join("\n")}`);
  }

  return { ok: true, ...result, path: filePath };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyGoldenFrame()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}

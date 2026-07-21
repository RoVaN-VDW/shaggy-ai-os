#!/usr/bin/env node
import { constants } from "node:fs";
import { chmod, lstat, mkdir, open, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";

const directory = path.join(process.env.HOME || process.cwd(), "Library", "Application Support", "SHAGGY", "owner");
const secretPath = path.join(directory, "owner.secret");
const pairPath = path.join(directory, "owner.pair");
const tokenPattern = /^[a-f0-9]{64}$/;

async function writeExclusivePrivate(filePath, value) {
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW;
  const handle = await open(filePath, flags, 0o600);
  try {
    await handle.writeFile(`${value}\n`, { encoding: "ascii" });
    await handle.chmod(0o600);
  } finally {
    await handle.close();
  }
}

async function validatePrivateToken(filePath) {
  const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const metadata = await handle.stat();
    const value = (await handle.readFile({ encoding: "ascii" })).trim();
    if (!metadata.isFile() || metadata.uid !== process.getuid() || (metadata.mode & 0o077) !== 0 || !tokenPattern.test(value)) {
      throw new Error("owner token is not a private owner file");
    }
  } finally {
    await handle.close();
  }
}

await mkdir(directory, { recursive: true, mode: 0o700 });
await chmod(directory, 0o700);
const parent = await lstat(directory);
if (!parent.isDirectory() || parent.uid !== process.getuid() || (parent.mode & 0o077) !== 0) {
  throw new Error("owner directory is not private");
}

try {
  await writeExclusivePrivate(secretPath, randomBytes(32).toString("hex"));
} catch (error) {
  if (error?.code !== "EEXIST") throw error;
}
await validatePrivateToken(secretPath);

try {
  const existing = await lstat(pairPath);
  if (!existing.isFile() || existing.uid !== process.getuid()) throw new Error("existing owner pair path is unsafe");
  await unlink(pairPath);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const pairToken = randomBytes(32).toString("hex");
await writeExclusivePrivate(pairPath, pairToken);
const url = `http://127.0.0.1:3000/#owner-pair=${pairToken}`;
const opened = spawnSync("open", [url], { stdio: "ignore" });
if (opened.status !== 0) throw new Error("could not open the local owner pairing URL");
console.log("SHAGGY owner pairing launched in the default browser; the one-time capability was not printed.");

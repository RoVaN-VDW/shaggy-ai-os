import { constants } from "node:fs";
import { open, lstat, rename, unlink } from "node:fs/promises";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import path from "node:path";

export const OWNER_COOKIE_NAME = "shaggy_owner";
export const OWNER_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const MAX_PRIVATE_FILE_BYTES = 128;

const OWNER_DIRECTORY = path.join(
  process.env.HOME || process.cwd(),
  "Library", "Application Support", "SHAGGY", "owner",
);
export const OWNER_SECRET_PATH = path.join(OWNER_DIRECTORY, "owner.secret");
export const OWNER_PAIR_PATH = path.join(OWNER_DIRECTORY, "owner.pair");

type PrivateFile = {
  text: string;
  device: bigint | number;
  inode: bigint | number;
};

async function readPrivateOwnerFile(filePath: string): Promise<PrivateFile> {
  const currentUid = process.getuid?.();
  if (currentUid == null) throw new Error("Owner capability requires a local UID");
  const parent = await lstat(path.dirname(filePath));
  if (!parent.isDirectory() || parent.uid !== currentUid || (parent.mode & 0o077) !== 0) {
    throw new Error("Owner capability directory is not private");
  }

  const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const metadata = await handle.stat({ bigint: true });
    if (!metadata.isFile() || Number(metadata.uid) !== currentUid || (Number(metadata.mode) & 0o077) !== 0 || metadata.size > BigInt(MAX_PRIVATE_FILE_BYTES)) {
      throw new Error("Owner capability is not a private owner file");
    }
    const text = (await handle.readFile({ encoding: "ascii" })).trim();
    if (!TOKEN_PATTERN.test(text)) throw new Error("Owner capability is malformed");
    return { text, device: metadata.dev, inode: metadata.ino };
  } finally {
    await handle.close();
  }
}

function signature(secret: string, expiresAt: number): string {
  return createHmac("sha256", Buffer.from(secret, "hex"))
    .update(`shaggy-owner-session-v1:${expiresAt}`)
    .digest("hex");
}

export async function createOwnerSession(
  secretPath = OWNER_SECRET_PATH,
  now = Date.now(),
  ttlMs = OWNER_SESSION_TTL_MS,
): Promise<string> {
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > OWNER_SESSION_TTL_MS) {
    throw new Error("Invalid owner session lifetime");
  }
  const { text: secret } = await readPrivateOwnerFile(secretPath);
  const expiresAt = now + ttlMs;
  return `${expiresAt}.${signature(secret, expiresAt)}`;
}

export async function verifyOwnerSession(
  secretPath: string = OWNER_SECRET_PATH,
  cookie: string | null | undefined,
  now = Date.now(),
): Promise<boolean> {
  const match = /^(\d{13})\.([a-f0-9]{64})$/.exec(cookie || "");
  if (!match) return false;
  const expiresAt = Number(match[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + OWNER_SESSION_TTL_MS) return false;
  try {
    const { text: secret } = await readPrivateOwnerFile(secretPath);
    return timingSafeEqual(Buffer.from(match[2], "hex"), Buffer.from(signature(secret, expiresAt), "hex"));
  } catch {
    return false;
  }
}

export async function consumePairToken(
  pairPath: string = OWNER_PAIR_PATH,
  candidate: unknown,
): Promise<boolean> {
  if (typeof candidate !== "string" || !TOKEN_PATTERN.test(candidate)) return false;
  let pair: PrivateFile;
  try {
    pair = await readPrivateOwnerFile(pairPath);
  } catch {
    return false;
  }
  if (!timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(pair.text, "hex"))) return false;

  const claimPath = `${pairPath}.claim-${process.pid}-${randomUUID()}`;
  try {
    await rename(pairPath, claimPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }

  try {
    const claimed = await lstat(claimPath, { bigint: true });
    if (!claimed.isFile() || claimed.dev !== pair.device || claimed.ino !== pair.inode) {
      throw new Error("Owner pairing capability changed while validating");
    }
    return true;
  } finally {
    try {
      await unlink(claimPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

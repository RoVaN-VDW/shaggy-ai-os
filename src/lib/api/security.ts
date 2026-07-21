import { NextRequest, NextResponse } from "next/server";

const WINDOW_MS = 60_000;
const MAX_BODY_BYTES = 100_000;
const MAX_RATE_LIMIT_BUCKETS = 2_048;
const buckets = new Map<string, { count: number; resetAt: number }>();

function pruneExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  while (buckets.size >= MAX_RATE_LIMIT_BUCKETS) {
    const oldestKey = buckets.keys().next().value as string | undefined;
    if (!oldestKey) break;
    buckets.delete(oldestKey);
  }
}

export function getClientKey(req: NextRequest, scope: string) {
  const platformForwardedFor = req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  const ip = platformForwardedFor || req.headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}

export function rateLimit(req: NextRequest, scope: string, limit: number) {
  const key = getClientKey(req, scope);
  const now = Date.now();
  pruneExpiredBuckets(now);
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }

  if (current.count >= limit) {
    return NextResponse.json(
      { error: "Too many requests. Please wait and try again." },
      { status: 429 }
    );
  }

  current.count += 1;
  return null;
}

export function validateJsonSize(req: NextRequest) {
  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  }
  return null;
}

export async function readBoundedJson(req: NextRequest) {
  if (req.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    return { body: null, error: NextResponse.json({ error: "application/json required." }, { status: 415 }) };
  }
  const reader = req.body?.getReader();
  if (!reader) return { body: null, error: NextResponse.json({ error: "Missing JSON body." }, { status: 400 }) };
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return { body: null, error: NextResponse.json({ error: "Request is too large." }, { status: 413 }) };
      }
      chunks.push(value);
    }
    const raw = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { body: null, error: NextResponse.json({ error: "JSON object required." }, { status: 400 }) };
    }
    return { body: body as Record<string, unknown>, error: null };
  } catch {
    return { body: null, error: NextResponse.json({ error: "Invalid JSON." }, { status: 400 }) };
  } finally {
    reader.releaseLock();
  }
}

export function validatePrompt(prompt: unknown) {
  if (typeof prompt !== "string" || !prompt.trim()) {
    return "Missing prompt";
  }
  if (prompt.length > 20_000) {
    return "Prompt is too large.";
  }
  return null;
}

export function validateOptionalUuid(value: unknown, label = "project id") {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return `Invalid ${label}.`;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
    ? null
    : `Invalid ${label}.`;
}

export function validateUuid(value: unknown, label = "id") {
  if (typeof value !== "string" || !value) return `Missing ${label}.`;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
    ? null
    : `Invalid ${label}.`;
}

export function publicError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.startsWith("No API key configured")) {
    return error.message;
  }
  return fallback;
}

export function withTimeout(ms = 45_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timeout) };
}

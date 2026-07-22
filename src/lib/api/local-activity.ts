import type { LocalActivity } from "../local/activity-readplane.ts";

export type LocalActivityResult = {
  data: LocalActivity[] | null;
  observedAt: string | null;
  error: { message: string } | null;
};

const ENDPOINT = "/api/activity";
const SOURCE = "local-sqlite:provider_usage";
const MAX_ACTIVITY_EVENTS = 50;
const MAX_PUBLIC_ERROR_LENGTH = 240;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1_000;
const MAX_SNAPSHOT_AGE_MS = 60 * 1_000;
const VALID_STATUSES = new Set(["success", "error", "cached", "unknown"]);
const VALID_TRUST_LEVELS = new Set(["native-aggregate", "client-reported"]);
const ISO_UTC_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/;

type ParsedIsoTimestamp = {
  epochMs: number;
  sortKey: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max && value.trim() === value;
}

function isNonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function parseIsoTimestamp(value: unknown): ParsedIsoTimestamp | null {
  if (typeof value !== "string") return null;
  const match = ISO_UTC_PATTERN.exec(value);
  if (match === null) return null;
  const base = match[1];
  const fraction = match[2] ?? "";
  const milliseconds = fraction.padEnd(3, "0").slice(0, 3);
  const normalizedMs = `${base}.${milliseconds}Z`;
  const epochMs = Date.parse(normalizedMs);
  if (!Number.isFinite(epochMs) || new Date(epochMs).toISOString() !== normalizedMs) return null;
  return {
    epochMs,
    sortKey: `${base}.${fraction.padEnd(6, "0")}Z`,
  };
}

function isIsoTimestamp(value: unknown): value is string {
  return parseIsoTimestamp(value) !== null;
}

function fail(message: string): LocalActivityResult {
  return { data: null, observedAt: null, error: { message } };
}

function publicError(payload: unknown, status: number): string {
  if (isRecord(payload) && typeof payload.error === "string") {
    const message = payload.error.trim();
    if (message.length > 0) return message.slice(0, MAX_PUBLIC_ERROR_LENGTH);
  }
  return `Activity feed request failed with status ${status}.`;
}

function parseActivity(value: unknown, observedAtKey: string, index: number): LocalActivity {
  if (!isRecord(value)) throw new Error(`invalid activity at index ${index}`);
  if (!isBoundedString(value.id, 240)) throw new Error(`invalid activity id at index ${index}`);
  if (!isBoundedString(value.agent, 160)) throw new Error(`invalid activity agent at index ${index}`);
  if (!isBoundedString(value.action, 160)) throw new Error(`invalid activity action at index ${index}`);
  if (!VALID_STATUSES.has(String(value.status))) throw new Error(`invalid activity status at index ${index}`);
  if (!isIsoTimestamp(value.created_at) || parseIsoTimestamp(value.created_at)!.sortKey > observedAtKey) {
    throw new Error(`invalid activity timestamp at index ${index}`);
  }
  if (!isRecord(value.metadata)) throw new Error(`invalid activity metadata at index ${index}`);
  if (!isBoundedString(value.metadata.provider, 160)) throw new Error(`invalid activity provider at index ${index}`);
  if (value.metadata.project_id !== null && !isBoundedString(value.metadata.project_id, 240)) {
    throw new Error(`invalid activity project at index ${index}`);
  }
  if (!isNonnegativeInteger(value.metadata.api_call_count)
    || !isNonnegativeInteger(value.metadata.input_tokens)
    || !isNonnegativeInteger(value.metadata.output_tokens)) {
    throw new Error(`invalid activity counters at index ${index}`);
  }
  if (!VALID_TRUST_LEVELS.has(String(value.metadata.trust_level))) {
    throw new Error(`invalid activity trust at index ${index}`);
  }

  return {
    id: value.id,
    agent: value.agent,
    action: value.action,
    status: value.status as LocalActivity["status"],
    metadata: {
      provider: value.metadata.provider,
      project_id: value.metadata.project_id,
      api_call_count: value.metadata.api_call_count,
      input_tokens: value.metadata.input_tokens,
      output_tokens: value.metadata.output_tokens,
      trust_level: value.metadata.trust_level as LocalActivity["metadata"]["trust_level"],
    },
    created_at: value.created_at,
  };
}

function parsePayload(value: unknown, nowMs = Date.now()): { activity: LocalActivity[]; observedAt: string } {
  if (!isRecord(value) || value.ok !== true || value.source !== SOURCE || value.truncated !== false) {
    throw new Error("invalid activity response");
  }
  if (!isIsoTimestamp(value.observedAt) || !Number.isFinite(nowMs)) throw new Error("invalid activity observation time");
  const observedAt = parseIsoTimestamp(value.observedAt)!;
  const observedAtMs = observedAt.epochMs;
  if (observedAtMs > nowMs + MAX_FUTURE_SKEW_MS || nowMs - observedAtMs > MAX_SNAPSHOT_AGE_MS) {
    throw new Error("invalid activity freshness");
  }
  if (!Array.isArray(value.activity) || value.activity.length > MAX_ACTIVITY_EVENTS) {
    throw new Error("invalid activity collection");
  }
  const activity = value.activity.map((event, index) => parseActivity(event, observedAt.sortKey, index));
  if (new Set(activity.map(({ id }) => id)).size !== activity.length) throw new Error("duplicate activity id");
  return { activity, observedAt: value.observedAt };
}

export async function fetchLocalActivity(): Promise<LocalActivityResult> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch {
    return fail("Activity feed is unavailable.");
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) return fail(publicError(payload, response.status));
  try {
    const parsed = parsePayload(payload);
    return { data: parsed.activity, observedAt: parsed.observedAt, error: null };
  } catch {
    return fail("Activity feed response was malformed.");
  }
}

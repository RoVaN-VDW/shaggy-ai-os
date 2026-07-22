export type LocalActivity = {
  id: string;
  agent: string;
  action: string;
  status: "success" | "error" | "cached" | "unknown";
  metadata: {
    provider: string;
    project_id: string | null;
    api_call_count: number;
    input_tokens: number;
    output_tokens: number;
    trust_level: "native-aggregate" | "client-reported";
  };
  created_at: string;
};

export type LocalActivitySnapshot = {
  source: "local-sqlite:provider_usage";
  observedAt: string;
  activity: LocalActivity[];
};

type ParseLocalActivityOptions = {
  nowMs?: number;
};

const SOURCE = "local-sqlite:provider_usage" as const;
const VALID_STATUSES = new Set(["success", "error", "cached", "unknown"]);
const VALID_TRUST_LEVELS = new Set(["native-aggregate", "client-reported"]);
const MAX_SOURCE_EVENTS = 10_000;
const MAX_ACTIVITY_EVENTS = 50;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1_000;
const MAX_SNAPSHOT_AGE_MS = 60 * 1_000;
const ISO_UTC_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/;

type ParsedIsoTimestamp = {
  epochMs: number;
  sortKey: string;
};

function malformed(reason: string): Error {
  return new Error(`Local activity data is malformed: ${reason}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= max
    && value.trim() === value;
}

function isOptionalIdentifier(value: unknown): value is string | null {
  return value === null || isBoundedString(value, 240);
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

function parseActivity(value: unknown, index: number, generatedAtKey: string): LocalActivity {
  if (!isRecord(value)) throw malformed(`invalid event at index ${index}`);
  if (!isBoundedString(value.id, 240)) throw malformed(`invalid event id at index ${index}`);
  if (!isBoundedString(value.provider, 160)) throw malformed(`invalid provider at index ${index}`);
  if (!isBoundedString(value.model, 160)) throw malformed(`invalid model at index ${index}`);
  if (!isOptionalIdentifier(value.project_id)) throw malformed(`invalid project at index ${index}`);
  if (value.task !== null && !isBoundedString(value.task, 160)) throw malformed(`invalid task at index ${index}`);
  if (!VALID_STATUSES.has(String(value.status))) throw malformed(`invalid status at index ${index}`);
  if (!isNonnegativeInteger(value.api_call_count)) throw malformed(`invalid call count at index ${index}`);
  if (!isNonnegativeInteger(value.input_tokens)) throw malformed(`invalid input tokens at index ${index}`);
  if (!isNonnegativeInteger(value.output_tokens)) throw malformed(`invalid output tokens at index ${index}`);
  if (!isIsoTimestamp(value.created_at) || parseIsoTimestamp(value.created_at)!.sortKey > generatedAtKey) {
    throw malformed(`invalid event timestamp at index ${index}`);
  }
  if (!isRecord(value.metadata) || !VALID_TRUST_LEVELS.has(String(value.metadata.trust_level))) {
    throw malformed(`invalid trust level at index ${index}`);
  }

  return {
    id: value.id,
    agent: value.model,
    action: value.task ?? "model activity",
    status: value.status as LocalActivity["status"],
    metadata: {
      provider: value.provider,
      project_id: value.project_id,
      api_call_count: value.api_call_count,
      input_tokens: value.input_tokens,
      output_tokens: value.output_tokens,
      trust_level: value.metadata.trust_level as LocalActivity["metadata"]["trust_level"],
    },
    created_at: value.created_at,
  };
}

export function parseLocalActivitySnapshot(
  value: unknown,
  { nowMs = Date.now() }: ParseLocalActivityOptions = {},
): LocalActivitySnapshot {
  if (!isRecord(value)) throw malformed("invalid ledger export");
  if (value.schema !== 1) throw malformed("unsupported schema version");
  if (value.source !== SOURCE) throw malformed("unexpected ledger source");
  if (value.truncated !== false) throw malformed("collector export is incomplete");
  if (!isIsoTimestamp(value.generated_at)) throw malformed("invalid generated timestamp");
  if (!Number.isFinite(nowMs)) throw malformed("invalid validation clock");
  const generatedAt = parseIsoTimestamp(value.generated_at)!;
  const generatedAtMs = generatedAt.epochMs;
  if (generatedAtMs > nowMs + MAX_FUTURE_SKEW_MS) throw malformed("generated timestamp is in the future");
  if (nowMs - generatedAtMs > MAX_SNAPSHOT_AGE_MS) throw malformed("generated timestamp is stale");
  if (!Array.isArray(value.provider_usage) || value.provider_usage.length > MAX_SOURCE_EVENTS) {
    throw malformed("invalid activity collection");
  }

  const activity = value.provider_usage.map((event, index) => {
    const parsed = parseActivity(event, index, generatedAt.sortKey);
    return { parsed, sortKey: parseIsoTimestamp(parsed.created_at)!.sortKey };
  });
  const ids = new Set<string>();
  for (const { parsed: event } of activity) {
    if (ids.has(event.id)) throw malformed("duplicate event id");
    ids.add(event.id);
  }

  return {
    source: SOURCE,
    observedAt: value.generated_at,
    activity: activity
      .sort((a, b) => {
        if (a.sortKey !== b.sortKey) return a.sortKey > b.sortKey ? -1 : 1;
        return a.parsed.id < b.parsed.id ? -1 : a.parsed.id > b.parsed.id ? 1 : 0;
      })
      .slice(0, MAX_ACTIVITY_EVENTS)
      .map(({ parsed }) => parsed),
  };
}

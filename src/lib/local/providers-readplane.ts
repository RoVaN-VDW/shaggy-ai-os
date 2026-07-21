export type LocalProviderCostProfile = {
  monthly_budget_usd?: number;
  monthly_token_budget?: number;
  budget_reset_day?: number;
};

export type LocalProvider = {
  id: string;
  provider: string;
  model: string;
  status: string;
  health_status: string;
  last_seen_at: string | null;
  cost_profile?: LocalProviderCostProfile;
};

export type LocalProvidersSnapshot = {
  source: "local-sqlite:provider_usage";
  observedAt: string;
  providers: LocalProvider[];
};

type ParseLocalProvidersOptions = {
  nowMs?: number;
};

const SOURCE = "local-sqlite:provider_usage" as const;
const MAX_PROVIDERS = 1_000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1_000;
const MAX_SNAPSHOT_AGE_MS = 60 * 1_000;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;

function malformed(reason: string): Error {
  return new Error(`Local providers data is malformed: ${reason}`);
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

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && ISO_UTC_PATTERN.test(value)
    && Number.isFinite(Date.parse(value));
}

function parseCostProfile(value: unknown, index: number): LocalProviderCostProfile | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw malformed(`invalid cost profile at index ${index}`);

  const allowedKeys = new Set(["monthly_budget_usd", "monthly_token_budget", "budget_reset_day"]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    throw malformed(`invalid cost profile at index ${index}`);
  }
  if (value.monthly_budget_usd !== undefined
    && (typeof value.monthly_budget_usd !== "number"
      || !Number.isFinite(value.monthly_budget_usd)
      || value.monthly_budget_usd < 0)) {
    throw malformed(`invalid cost budget at index ${index}`);
  }
  if (value.monthly_token_budget !== undefined
    && (!Number.isSafeInteger(value.monthly_token_budget) || (value.monthly_token_budget as number) < 0)) {
    throw malformed(`invalid token budget at index ${index}`);
  }
  if (value.budget_reset_day !== undefined
    && (!Number.isSafeInteger(value.budget_reset_day)
      || (value.budget_reset_day as number) < 1
      || (value.budget_reset_day as number) > 28)) {
    throw malformed(`invalid budget reset day at index ${index}`);
  }

  return {
    ...(value.monthly_budget_usd === undefined ? {} : { monthly_budget_usd: value.monthly_budget_usd as number }),
    ...(value.monthly_token_budget === undefined ? {} : { monthly_token_budget: value.monthly_token_budget as number }),
    ...(value.budget_reset_day === undefined ? {} : { budget_reset_day: value.budget_reset_day as number }),
  };
}

function parseProvider(value: unknown, index: number, generatedAtMs: number): LocalProvider {
  if (!isRecord(value)) throw malformed(`invalid provider at index ${index}`);
  if (!isBoundedString(value.id, 200)) throw malformed(`invalid provider id at index ${index}`);
  if (!isBoundedString(value.provider, 160)) throw malformed(`invalid provider name at index ${index}`);
  if (!isBoundedString(value.model, 160)) throw malformed(`invalid model name at index ${index}`);
  if (!isBoundedString(value.status, 40)) throw malformed(`invalid provider status at index ${index}`);
  if (!isBoundedString(value.health_status, 40)) throw malformed(`invalid provider health at index ${index}`);
  if (value.last_seen_at !== null && !isIsoTimestamp(value.last_seen_at)) {
    throw malformed(`invalid provider timestamp at index ${index}`);
  }
  if (value.last_seen_at !== null && Date.parse(value.last_seen_at) > generatedAtMs) {
    throw malformed(`provider timestamp is after snapshot at index ${index}`);
  }
  const costProfile = parseCostProfile(value.cost_profile, index);

  return {
    id: value.id,
    provider: value.provider,
    model: value.model,
    status: value.status,
    health_status: value.health_status,
    last_seen_at: value.last_seen_at,
    ...(costProfile === undefined ? {} : { cost_profile: costProfile }),
  };
}

export function parseLocalProvidersSnapshot(
  value: unknown,
  { nowMs = Date.now() }: ParseLocalProvidersOptions = {},
): LocalProvidersSnapshot {
  if (!isRecord(value)) throw malformed("invalid ledger export");
  if (value.schema !== 1) throw malformed("unsupported schema version");
  if (value.source !== SOURCE) throw malformed("unexpected ledger source");
  if (value.truncated !== false) throw malformed("collector export is incomplete");
  if (!isIsoTimestamp(value.generated_at)) throw malformed("invalid generated timestamp");
  if (!Number.isFinite(nowMs)) throw malformed("invalid validation clock");
  const generatedAtMs = Date.parse(value.generated_at);
  if (generatedAtMs > nowMs + MAX_FUTURE_SKEW_MS) {
    throw malformed("generated timestamp is in the future");
  }
  if (nowMs - generatedAtMs > MAX_SNAPSHOT_AGE_MS) {
    throw malformed("generated timestamp is stale");
  }
  if (!Array.isArray(value.providers) || value.providers.length > MAX_PROVIDERS) {
    throw malformed("invalid provider collection");
  }

  const providers = value.providers.map((provider, index) => parseProvider(provider, index, generatedAtMs));
  const ids = new Set<string>();
  const identities = new Set<string>();
  for (const provider of providers) {
    const identity = `${provider.provider}\u0000${provider.model}`;
    if (ids.has(provider.id)) throw malformed("duplicate provider id");
    if (identities.has(identity)) throw malformed("duplicate provider identity");
    ids.add(provider.id);
    identities.add(identity);
  }

  return {
    source: SOURCE,
    observedAt: value.generated_at,
    providers,
  };
}

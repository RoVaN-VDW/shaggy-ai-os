export const CAPABILITY_TRUTH_DEFAULTS = {
  streamHeartbeatExpectedMs: 15_000,
  streamingMaxAgeMs: 45_000,
  clockSkewToleranceMs: 5_000,
} as const;

export type CapabilityKey =
  | "cockpit"
  | "secondBrain"
  | "twin"
  | "settings"
  | "reviewQueue";

export type CapabilityDefinition = {
  key: CapabilityKey;
  label: string;
  source: `${"supabase" | "local-snapshot" | "local-config"}:${string}`;
  ttlMs: number;
  claim: string;
};

export type CapabilityTruthStatus = "streaming" | "fresh" | "stale" | "offline";

export type CapabilityEvidence = {
  configured: boolean;
  observedAt: string | null;
  heartbeatAt?: string | null;
  refreshError?: string | null;
};

export type CapabilityTruth = {
  status: CapabilityTruthStatus;
  source: CapabilityDefinition["source"];
  observedAt: string | null;
  ageMs: number | null;
  reason:
    | "active-heartbeat"
    | "within-ttl"
    | "ttl-expired"
    | "refresh-failed"
    | "missing-evidence"
    | "not-configured"
    | "invalid-clock";
};

export const CAPABILITY_REGISTRY = {
  cockpit: {
    key: "cockpit",
    label: "Cockpit data",
    // P1 provider readplane is tracked per resource; P2 activity readplane is too.
    // This broad source remains legacy until the remaining resources leave Supabase.
    source: "supabase:cockpit-resources",
    ttlMs: 60_000,
    claim: "authorized source-backed data",
  },
  secondBrain: {
    key: "secondBrain",
    label: "Second Brain snapshot",
    source: "local-snapshot:second-brain",
    ttlMs: 86_400_000,
    claim: "private aggregate snapshot",
  },
  twin: {
    key: "twin",
    label: "Living Digital Twin",
    source: "local-snapshot:second-brain",
    ttlMs: 86_400_000,
    claim: "continuity view only",
  },
  settings: {
    key: "settings",
    label: "Settings",
    source: "local-config:settings",
    ttlMs: 60_000,
    claim: "local-only configuration",
  },
  reviewQueue: {
    key: "reviewQueue",
    label: "Review Queue",
    source: "supabase:review_items",
    ttlMs: 60_000,
    claim: "decision queue only",
  },
} as const satisfies Record<CapabilityKey, CapabilityDefinition>;

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function resolveCapabilityTruth(
  capability: CapabilityDefinition,
  evidence: CapabilityEvidence,
  nowMs = Date.now(),
): CapabilityTruth {
  const base = {
    source: capability.source,
    observedAt: evidence.observedAt,
  };

  if (!evidence.configured) {
    return { ...base, status: "offline", ageMs: null, reason: "not-configured" };
  }

  const observedMs = parseTimestamp(evidence.observedAt);
  if (evidence.observedAt && observedMs === null) {
    return { ...base, status: "offline", ageMs: null, reason: "missing-evidence" };
  }
  if (observedMs !== null && observedMs - nowMs > CAPABILITY_TRUTH_DEFAULTS.clockSkewToleranceMs) {
    return { ...base, status: "offline", ageMs: 0, reason: "invalid-clock" };
  }

  const heartbeatMs = parseTimestamp(evidence.heartbeatAt);
  if (heartbeatMs !== null) {
    if (heartbeatMs - nowMs > CAPABILITY_TRUTH_DEFAULTS.clockSkewToleranceMs) {
      return { ...base, status: "offline", ageMs: 0, reason: "invalid-clock" };
    }
    const heartbeatAgeMs = Math.max(0, nowMs - heartbeatMs);
    if (heartbeatAgeMs <= CAPABILITY_TRUTH_DEFAULTS.streamingMaxAgeMs) {
      return { ...base, status: "streaming", ageMs: heartbeatAgeMs, reason: "active-heartbeat" };
    }
  }

  if (observedMs === null) {
    return { ...base, status: "offline", ageMs: null, reason: "missing-evidence" };
  }

  const ageMs = Math.max(0, nowMs - observedMs);
  if (evidence.refreshError) {
    return { ...base, status: "stale", ageMs, reason: "refresh-failed" };
  }
  if (ageMs <= capability.ttlMs) {
    return { ...base, status: "fresh", ageMs, reason: "within-ttl" };
  }
  return { ...base, status: "stale", ageMs, reason: "ttl-expired" };
}

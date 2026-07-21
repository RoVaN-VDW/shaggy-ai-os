import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { publicError, rateLimit, readBoundedJson } from "@/lib/api/security";
import { requireLocalUsageIngestAccess } from "@/lib/local/server";
import { insertLocalProviderUsage } from "@/lib/usage/local-ledger";

export const runtime = "nodejs";

const MAX_PROVIDER_LENGTH = 80;
const MAX_MODEL_LENGTH = 160;
const MAX_EVENT_AGE_DAYS = 400;
const FUTURE_SKEW_MS = 5 * 60 * 1000;
const USAGE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/;
const VALID_USAGE_STATUS = new Set(["success", "error", "cached", "unknown"]);

function validateUsageIdentifier(value: unknown, maxLength: number, required = false): string | null {
  if (value == null || value === "") return required ? null : null;
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength && USAGE_IDENTIFIER.test(text) ? text : null;
}

function finiteNonNegative(value: unknown, fallback: number | null = 0) {
  if (value == null && fallback === null) return null;
  const number = typeof value === "number" ? value : Number(value ?? fallback);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function parseOccurredAt(value: unknown): string | null | "invalid" {
  if (value == null) return null;
  if (typeof value !== "string") return "invalid";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "invalid";
  const now = Date.now();
  if (timestamp > now + FUTURE_SKEW_MS) return "invalid";
  if (timestamp < now - MAX_EVENT_AGE_DAYS * 86_400_000) return "invalid";
  return new Date(timestamp).toISOString();
}

export async function POST(req: NextRequest) {
  const access = await requireLocalUsageIngestAccess(req);
  if ("error" in access) return access.error;
  const limited = rateLimit(req, "llm-usage-event", 120);
  if (limited) return limited;

  const parsed = await readBoundedJson(req);
  if (parsed.error) return parsed.error;

  try {
    const body = parsed.body;
    const provider = validateUsageIdentifier(body.provider, MAX_PROVIDER_LENGTH, true);
    const model = validateUsageIdentifier(body.model, MAX_MODEL_LENGTH, true);
    const rawEventId = body.eventId ?? body.event_id;
    const eventId = rawEventId == null ? randomUUID() : validateUsageIdentifier(rawEventId, 160, true);
    const rawProjectId = body.projectId ?? body.project_id;
    const projectId = rawProjectId == null ? null : validateUsageIdentifier(rawProjectId, 160);
    const occurredAt = parseOccurredAt(body.occurredAt ?? body.occurred_at);
    const inputTokens = finiteNonNegative(body.inputTokens ?? body.input_tokens);
    const outputTokens = finiteNonNegative(body.outputTokens ?? body.output_tokens);
    const latencyMs = finiteNonNegative(body.latencyMs ?? body.latency_ms, null);
    const cacheReadTokens = finiteNonNegative(body.cacheReadTokens ?? body.cache_read_tokens, null);
    const cacheWriteTokens = finiteNonNegative(body.cacheWriteTokens ?? body.cache_write_tokens, null);
    const reasoningTokens = finiteNonNegative(body.reasoningTokens ?? body.reasoning_tokens, null);
    const estimatedCostUsd = finiteNonNegative(body.estimatedCostUsd ?? body.estimated_cost_usd ?? body.costEstimate ?? body.cost_estimate, null);
    const actualCostUsd = finiteNonNegative(body.actualCostUsd ?? body.actual_cost_usd, null);
    const apiCallCount = finiteNonNegative(body.apiCallCount ?? body.api_call_count, null);
    const invalidOptionalMetric = [
      [body.cacheReadTokens ?? body.cache_read_tokens, cacheReadTokens],
      [body.cacheWriteTokens ?? body.cache_write_tokens, cacheWriteTokens],
      [body.reasoningTokens ?? body.reasoning_tokens, reasoningTokens],
      [body.estimatedCostUsd ?? body.estimated_cost_usd ?? body.costEstimate ?? body.cost_estimate, estimatedCostUsd],
      [body.actualCostUsd ?? body.actual_cost_usd, actualCostUsd],
      [body.apiCallCount ?? body.api_call_count, apiCallCount],
      [body.latencyMs ?? body.latency_ms, latencyMs],
    ].some(([raw, parsedValue]) => raw != null && parsedValue == null);
    const costStatus = body.costStatus ?? body.cost_status ?? "unknown";
    const usageStatus = body.status ?? "success";
    if (!provider) return NextResponse.json({ error: "Invalid provider." }, { status: 400 });
    if (!model) return NextResponse.json({ error: "Invalid model." }, { status: 400 });
    if (!eventId || (rawProjectId != null && !projectId)) return NextResponse.json({ error: "Invalid usage identifier." }, { status: 400 });
    if (occurredAt === "invalid") return NextResponse.json({ error: "Invalid occurredAt timestamp." }, { status: 400 });
    if (inputTokens == null || outputTokens == null) return NextResponse.json({ error: "Invalid usage metrics." }, { status: 400 });
    if (invalidOptionalMetric || (apiCallCount != null && (!Number.isInteger(apiCallCount) || apiCallCount < 1))) {
      return NextResponse.json({ error: "Invalid optional usage metrics." }, { status: 400 });
    }
    if (!["unknown", "estimated", "actual", "included"].includes(String(costStatus))) {
      return NextResponse.json({ error: "Invalid cost status." }, { status: 400 });
    }
    if (typeof usageStatus !== "string" || !VALID_USAGE_STATUS.has(usageStatus)) {
      return NextResponse.json({ error: "Invalid usage status." }, { status: 400 });
    }

    const result = await insertLocalProviderUsage({
      event_id: eventId,
      source: "shaggy:local-client",
      trust_level: "client-reported",
      provider,
      model,
      project_id: projectId,
      input_tokens: Math.floor(inputTokens),
      output_tokens: Math.floor(outputTokens),
      cache_read_tokens: Math.floor(cacheReadTokens ?? 0),
      cache_write_tokens: Math.floor(cacheWriteTokens ?? 0),
      reasoning_tokens: Math.floor(reasoningTokens ?? 0),
      estimated_cost_usd: estimatedCostUsd,
      actual_cost_usd: actualCostUsd,
      cost_status: costStatus,
      api_call_count: apiCallCount ?? 1,
      latency_ms: latencyMs == null ? null : Math.floor(latencyMs),
      status: usageStatus,
      occurred_at: occurredAt ?? new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, duplicate: result.duplicate, trust: "client-reported-estimate" }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    console.error("Local usage event failed", error);
    return NextResponse.json(
      { error: publicError(error, "Local usage collector unavailable.") },
      { status: 503 },
    );
  }
}

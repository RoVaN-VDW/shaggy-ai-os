import { NextRequest, NextResponse } from "next/server";
import { publicError, rateLimit, validateJsonSize, validateOptionalUuid } from "@/lib/api/security";
import { requireAuth } from "@/lib/supabase/server";

const MAX_PROVIDER_LENGTH = 80;
const MAX_MODEL_LENGTH = 160;
const MAX_EVENT_AGE_DAYS = 400;
const FUTURE_SKEW_MS = 5 * 60 * 1000;

function finiteNonNegative(value: unknown, fallback = 0) {
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
  const limited = rateLimit(req, "llm-usage-event", 120);
  if (limited) return limited;

  const tooLarge = validateJsonSize(req);
  if (tooLarge) return tooLarge;

  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const provider = typeof body.provider === "string" ? body.provider.trim() : "";
    const model = typeof body.model === "string" ? body.model.trim() : "";
    const projectId = body.projectId ?? body.project_id ?? null;
    const inputTokens = finiteNonNegative(body.inputTokens ?? body.input_tokens);
    const outputTokens = finiteNonNegative(body.outputTokens ?? body.output_tokens);
    const costEstimate = finiteNonNegative(body.costEstimate ?? body.cost_estimate);
    const hasLatency = body.latencyMs != null || body.latency_ms != null;
    const latencyMs = hasLatency ? finiteNonNegative(body.latencyMs ?? body.latency_ms) : null;
    const status = body.status === "error" || body.status === "cached" ? body.status : "success";
    const occurredAt = parseOccurredAt(body.occurredAt ?? body.occurred_at);

    const projectError = validateOptionalUuid(projectId);
    if (!provider || provider.length > MAX_PROVIDER_LENGTH) {
      return NextResponse.json({ error: "Invalid provider." }, { status: 400 });
    }
    if (!model || model.length > MAX_MODEL_LENGTH) {
      return NextResponse.json({ error: "Invalid model." }, { status: 400 });
    }
    if (occurredAt === "invalid") {
      return NextResponse.json({ error: "Invalid occurredAt timestamp." }, { status: 400 });
    }
    if (projectError || inputTokens == null || outputTokens == null || costEstimate == null || (hasLatency && latencyMs == null)) {
      return NextResponse.json({ error: projectError || "Invalid usage metrics." }, { status: 400 });
    }

    const { error } = await auth.client.from("usage_events").insert({
      provider,
      model,
      project_id: projectId || null,
      input_tokens: Math.floor(inputTokens),
      output_tokens: Math.floor(outputTokens),
      cost_estimate: costEstimate,
      latency_ms: latencyMs == null ? null : Math.floor(latencyMs),
      status,
      trust_level: "client-reported",
      ...(occurredAt ? { created_at: occurredAt } : {}),
      error_message:
        status === "error" && typeof body.errorMessage === "string"
          ? body.errorMessage.slice(0, 500)
          : null,
    });

    if (error) {
      console.error("Usage event insert failed", { message: error.message });
      return NextResponse.json({ error: "Usage event could not be stored." }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, trust: "client-reported-estimate" },
      { status: 201 },
    );
  } catch (error) {
    console.error("Usage event endpoint failed", error);
    return NextResponse.json({ error: publicError(error, "Usage event failed.") }, { status: 500 });
  }
}

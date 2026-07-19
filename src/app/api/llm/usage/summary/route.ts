import { NextRequest, NextResponse } from "next/server";
import { publicError, rateLimit } from "@/lib/api/security";
import { requireAuth } from "@/lib/supabase/server";
import {
  buildUsageSummary,
  type UsageLedgerEvent,
  type UsageProject,
  type UsageProvider,
} from "@/features/models-costs/usage-summary";
import { convertUsageInputsToEuro, getEcbUsdToEurRate } from "@/features/models-costs/euro-currency";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;
const MAX_EVENTS = 10_000;
const VALID_PERIODS = new Set([1, 7, 30]);

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "llm-usage-summary", 120);
  if (limited) return limited;

  const auth = await requireAuth(req);
  if (auth.error) {
    auth.error.headers.set("Cache-Control", "no-store");
    return auth.error;
  }

  try {
    const requestedDays = Number(req.nextUrl.searchParams.get("days") ?? 30);
    const periodDays = VALID_PERIODS.has(requestedDays) ? requestedDays : 30;
    const generatedAt = new Date().toISOString();
    const generatedDate = new Date(generatedAt);
    const since = new Date(generatedDate.getTime() - periodDays * 86_400_000).toISOString();
    const monthStart = new Date(Date.UTC(generatedDate.getUTCFullYear(), generatedDate.getUTCMonth(), 1)).toISOString();
    const fetchSince = since < monthStart ? since : monthStart;
    const client = auth.client;

    const [providersResult, projectsResult, currency] = await Promise.all([
      client
        .from("model_providers")
        .select("id, provider, model, status, health_status, last_seen_at, cost_profile")
        .order("provider", { ascending: true }),
      client.from("projects").select("id, name").order("name", { ascending: true }),
      getEcbUsdToEurRate(),
    ]);

    if (providersResult.error || projectsResult.error) {
      throw new Error(providersResult.error?.message || projectsResult.error?.message || "Usage sources unavailable.");
    }

    const allEvents: UsageLedgerEvent[] = [];
    for (let offset = 0; offset < MAX_EVENTS; offset += PAGE_SIZE) {
      const result = await client
        .from("usage_events")
        .select("id, provider, model, project_id, input_tokens, output_tokens, cost_estimate, latency_ms, status, created_at")
        .gte("created_at", fetchSince)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (result.error) throw new Error(result.error.message);
      const page = (result.data ?? []) as UsageLedgerEvent[];
      allEvents.push(...page);
      if (page.length < PAGE_SIZE) break;
    }

    const converted = convertUsageInputsToEuro({
      events: allEvents,
      providers: (providersResult.data ?? []) as UsageProvider[],
      usdToEurRate: currency.usdToEurRate,
    });
    const events = converted.events.filter((event) => event.created_at >= since);
    const budgetEvents = converted.events.filter((event) => event.created_at >= monthStart);
    const summary = buildUsageSummary({
      events,
      budgetEvents,
      providers: converted.providers,
      projects: (projectsResult.data ?? []) as UsageProject[],
      periodDays,
      generatedAt,
      currency,
      truncated: allEvents.length >= MAX_EVENTS,
    });

    return NextResponse.json(summary, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Usage summary failed", error);
    return NextResponse.json(
      { error: publicError(error, "Usage summary unavailable.") },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

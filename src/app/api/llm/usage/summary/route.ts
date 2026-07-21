import { NextRequest, NextResponse } from "next/server";

import { publicError, rateLimit } from "@/lib/api/security";
import { requireLocalAccess } from "@/lib/local/server";
import { buildUsageSummary } from "@/features/models-costs/usage-summary";
import { convertUsageInputsToEuro, getEcbUsdToEurRate } from "@/features/models-costs/euro-currency";
import { readLocalUsageLedger } from "@/lib/usage/local-ledger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_PERIODS = new Set([1, 7, 30]);

export async function GET(req: NextRequest) {
  const access = await requireLocalAccess(req);
  if (access.error) {
    access.error.headers.set("Cache-Control", "no-store");
    return access.error;
  }
  const limited = rateLimit(req, "llm-usage-summary", 120);
  if (limited) return limited;

  try {
    const requestedDays = Number(req.nextUrl.searchParams.get("days") ?? 30);
    const periodDays = VALID_PERIODS.has(requestedDays) ? requestedDays : 30;
    const generatedAt = new Date().toISOString();
    const generatedDate = new Date(generatedAt);
    const since = new Date(generatedDate.getTime() - periodDays * 86_400_000).toISOString();

    const [ledger, currency] = await Promise.all([
      readLocalUsageLedger(Math.max(periodDays, 31)),
      getEcbUsdToEurRate(),
    ]);
    const converted = convertUsageInputsToEuro({
      events: ledger.provider_usage,
      providers: ledger.providers,
      usdToEurRate: currency.usdToEurRate,
    });
    const periodEvents = converted.events.filter((event) => event.created_at >= since && event.created_at <= generatedAt);
    const periodWorkflowEvents = ledger.workflow_events.filter((event) => event.occurred_at >= since && event.occurred_at <= generatedAt);
    const selectedEventIds = new Set([
      ...periodEvents.map((event) => event.id),
      ...periodWorkflowEvents.map((event) => event.event_id),
    ]);
    const periodAlerts = ledger.alerts.filter((alert) =>
      alert.kind === "budget" || !alert.event_id || selectedEventIds.has(alert.event_id),
    );
    const summary = buildUsageSummary({
      events: periodEvents,
      budgetEvents: converted.events.filter((event) => event.created_at <= generatedAt),
      providers: converted.providers,
      projects: ledger.projects,
      periodDays,
      generatedAt,
      currency,
      truncated: ledger.truncated,
      alerts: periodAlerts,
      workflowEvents: periodWorkflowEvents,
      providerQuota: ledger.provider_quota,
      source: ledger.source,
    });

    return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Local usage summary failed", error);
    return NextResponse.json(
      { error: publicError(error, "Local usage collector unavailable.") },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

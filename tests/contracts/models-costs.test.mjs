import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { buildUsageSummary } from "../../src/features/models-costs/usage-summary.ts";
import { convertUsageInputsToEuro, parseEcbUsdEurCsv } from "../../src/features/models-costs/euro-currency.ts";
import { PRIMARY_NAV_ITEMS } from "../../src/features/command-center/shell-contract.ts";

const events = [
  { id: "1", provider: "openai", model: "sol", project_id: "p1", input_tokens: 1000, output_tokens: 250, cost_estimate: 0.02, latency_ms: 900, status: "success", created_at: "2026-07-19T10:00:00.000Z" },
  { id: "2", provider: "openai", model: "sol", project_id: "p1", input_tokens: 500, output_tokens: 100, cost_estimate: 0.01, latency_ms: 1100, status: "error", created_at: "2026-07-19T11:00:00.000Z" },
  { id: "3", provider: "kimi", model: "k3", project_id: null, input_tokens: 2000, output_tokens: 500, cost_estimate: 0.005, latency_ms: 700, status: "cached", created_at: "2026-07-18T11:00:00.000Z" },
];

const providers = [
  { id: "mp1", provider: "openai", model: "sol", status: "active", health_status: "healthy", last_seen_at: null, cost_profile: { monthly_budget_eur: 1, monthly_token_budget: 10000 } },
  { id: "mp2", provider: "kimi", model: "k3", status: "active", health_status: "unknown", last_seen_at: null, cost_profile: {} },
  { id: "mp3", provider: "anthropic", model: "claude-opus", status: "active", health_status: "healthy", last_seen_at: null, cost_profile: { monthly_token_budget: 2000000 } },
];
const currency = { code: "EUR", sourceCurrency: "USD", usdToEurRate: 0.9, source: "ECB", asOf: "2026-07-17" };
const euroInputs = convertUsageInputsToEuro({ events, providers, usdToEurRate: currency.usdToEurRate });

const summary = buildUsageSummary({
  events: euroInputs.events,
  providers: euroInputs.providers,
  projects: [{ id: "p1", name: "SHAGGY" }],
  periodDays: 30,
  generatedAt: "2026-07-19T12:00:00.000Z",
  truncated: false,
  currency,
});

test("ECB USD per EUR observations are inverted into a USD to EUR rate", () => {
  const fx = parseEcbUsdEurCsv("TIME_PERIOD,OBS_VALUE,CURRENCY,CURRENCY_DENOM\n2026-07-17,1.1435,USD,EUR\n");
  assert.equal(fx.asOf, "2026-07-17");
  assert.equal(fx.usdToEurRate, 0.8745080892);
  assert.equal(fx.source, "ECB");
});

test("ledger costs and legacy USD budgets convert to euro without relabeling", () => {
  const converted = convertUsageInputsToEuro({
    events: [events[0]],
    providers: [{ ...providers[0], cost_profile: { monthly_budget_usd: 10 } }],
    usdToEurRate: 0.9,
  });
  assert.equal(converted.events[0].cost_estimate, 0.018);
  assert.equal(converted.providers[0].cost_profile.monthly_budget_eur, 9);
  assert.equal("monthly_budget_usd" in converted.providers[0].cost_profile, false);
});

test("usage summary aggregates exact recorded ledger fields without inventing cache or provider credit", () => {
  assert.equal(summary.totals.requests, 3);
  assert.equal(summary.totals.inputTokens, 3500);
  assert.equal(summary.totals.outputTokens, 850);
  assert.equal(summary.totals.costEstimate, 0.0315);
  assert.equal(summary.totals.failedRequests, 1);
  assert.equal(summary.totals.averageLatencyMs, 900);
  assert.equal(summary.truth.providerBilling, "unavailable");
  assert.equal(summary.truth.providerCredits, "unavailable");
  assert.equal(summary.truth.cachedTokens, "unavailable");
  assert.equal(summary.truth.contextRemaining, "unavailable");
  assert.match(summary.truth.tokenSemantics, /fallbacks may be estimated/);
});

test("configured models remain visible with truthful zero usage", () => {
  const opus = summary.models.find((item) => item.model === "claude-opus");
  assert.equal(opus?.requests, 0);
  assert.equal(opus?.tokens, 0);
  assert.equal(opus?.costEstimate, 0);
  assert.equal(opus?.budget?.remainingTokens, 2000000);
  assert.equal(opus?.observationStatus, "configured-unobserved");
});

test("monthly budgets use the reset window independently from the visible usage period", () => {
  const olderMonthlyEvent = {
    ...events[0],
    id: "e-month",
    input_tokens: 800,
    output_tokens: 200,
    cost_estimate: 0.1,
    created_at: "2026-07-05T10:00:00.000Z",
  };
  const shortPeriod = buildUsageSummary({
    events: convertUsageInputsToEuro({ events: events.slice(0, 2), providers, usdToEurRate: 0.9 }).events,
    budgetEvents: convertUsageInputsToEuro({ events: [...events, olderMonthlyEvent], providers, usdToEurRate: 0.9 }).events,
    providers: euroInputs.providers,
    projects: [{ id: "p1", name: "SHAGGY" }],
    periodDays: 1,
    generatedAt: "2026-07-19T12:00:00.000Z",
    currency,
  });
  const openai = shortPeriod.models.find((item) => item.model === "sol");
  assert.equal(shortPeriod.totals.tokens, 1850);
  assert.equal(openai?.budget?.remainingTokens, 7150);
  assert.equal(openai?.budget?.remainingCostEur, 0.883);
});

test("collective internal token capacity includes only configured budgets and exposes provenance", () => {
  assert.deepEqual(summary.internalBudget, {
    configuredModels: 2,
    monthlyCostEur: 1,
    remainingCostEur: 0.973,
    monthlyTokens: 2010000,
    remainingTokens: 2008150,
    resetsAt: "2026-08-01T00:00:00.000Z",
    source: "model_providers.cost_profile",
  });
  assert.deepEqual(summary.quality.recordedTokens, { state: "recorded", source: "supabase:usage_events" });
  assert.deepEqual(summary.quality.internalBudget, { state: "calculated", source: "model_providers.cost_profile" });
  assert.deepEqual(summary.quality.providerQuota, { state: "unavailable", source: null });
});

test("token intelligence exposes provenance, freshness, windows, and unavailable provider quota per model", () => {
  const sol = summary.models.find((item) => item.model === "sol");
  assert.deepEqual(sol?.intelligence.recorded, {
    value: 1850,
    unit: "tokens",
    availability: "available",
    source: "supabase:usage_events",
    observedAt: "2026-07-19T11:00:00.000Z",
    confidence: "recorded-estimate",
    window: {
      type: "selected-period",
      startAt: "2026-06-19T12:00:00.000Z",
      endAt: "2026-07-19T12:00:00.000Z",
      resetAt: null,
    },
    reason: null,
  });
  assert.deepEqual(sol?.intelligence.providerRemaining, {
    value: null,
    unit: "tokens",
    availability: "unavailable",
    source: null,
    observedAt: null,
    confidence: "unknown",
    window: { type: "unknown", startAt: null, endAt: null, resetAt: null },
    reason: "No provider-reported remaining-token source is connected.",
  });
  assert.equal(sol?.intelligence.ownerBudget?.confidence, "manual-configuration");
  assert.equal(sol?.intelligence.ownerBudget?.value, 8150);
  assert.equal(sol?.intelligence.ownerBudget?.window.resetAt, "2026-08-01T00:00:00.000Z");
});

test("portfolio totals only aggregate comparable metrics and expose measured coverage", () => {
  assert.equal(summary.intelligence.recorded.value, 4350);
  assert.equal(summary.intelligence.recorded.unit, "tokens");
  assert.equal(summary.intelligence.recorded.confidence, "recorded-estimate");
  assert.deepEqual(summary.intelligence.coverage, {
    measuredProviders: 2,
    configuredProviders: 3,
    unavailableProviders: ["anthropic"],
    ratio: 2 / 3,
  });
  assert.equal(summary.intelligence.ownerBudgetRemaining.value, 2008150);
  assert.equal(summary.intelligence.providerRemaining.value, null);
  assert.equal(summary.intelligence.providerRemaining.availability, "unavailable");
  assert.equal(summary.intelligence.providerRemainingComparable, false);
});

test("catalog coverage distinguishes configured, observed, and unavailable official Claude inventory", () => {
  assert.deepEqual(summary.catalog, {
    configuredModels: 3,
    observedModels: 2,
    configuredUnobservedModels: 1,
    claudeConfiguredModels: 1,
    claudeObservedModels: 0,
    claudeCatalog: { state: "unavailable", source: null },
  });
});

test("configured internal budgets are explicit and missing budgets stay unavailable", () => {
  const openai = summary.models.find((item) => item.model === "sol");
  const kimi = summary.models.find((item) => item.model === "k3");
  assert.equal(openai?.budget?.monthlyCostEur, 1);
  assert.equal(openai?.budget?.remainingCostEur, 0.973);
  assert.equal(openai?.budget?.monthlyTokens, 10000);
  assert.equal(openai?.budget?.remainingTokens, 8150);
  assert.equal(kimi?.budget, null);
});

test("model rows expose auditable efficiency inputs instead of a fabricated composite score", () => {
  const sol = summary.models.find((item) => item.model === "sol");
  assert.equal(sol?.requests, 2);
  assert.equal(sol?.successRate, 50);
  assert.equal(sol?.costPerMillionTokens, 14.594595);
  assert.equal(sol?.averageLatencyMs, 1000);
  assert.equal("efficiencyScore" in (sol ?? {}), false);
});

test("projects and trend contain only recorded events", () => {
  assert.deepEqual(summary.projects, [
    { id: "p1", name: "SHAGGY", requests: 2, tokens: 1850, costEstimate: 0.027 },
    { id: null, name: "Unassigned", requests: 1, tokens: 2500, costEstimate: 0.0045 },
  ]);
  assert.deepEqual(summary.trend.map((item) => item.day), ["2026-07-18", "2026-07-19"]);
});

test("Models & Costs sidebar item is available and resolves to the module route", () => {
  const item = PRIMARY_NAV_ITEMS.find((candidate) => candidate.label === "Models & Costs");
  assert.deepEqual(item, { label: "Models & Costs", icon: "models", href: "/models", enabled: true, availability: "available" });
});

test("summary API authenticates before RLS-scoped reads, uses no service role, and is explicitly no-store", async () => {
  const source = await readFile(new URL("../../src/app/api/llm/usage/summary/route.ts", import.meta.url), "utf8");
  assert.match(source, /await requireAuth\(req\)/);
  assert.match(source, /auth\.client/);
  assert.doesNotMatch(source, /getSupabaseAdmin/);
  assert.match(source, /monthStart/);
  assert.match(source, /budgetEvents/);
  assert.match(source, /getEcbUsdToEurRate/);
  assert.match(source, /convertUsageInputsToEuro/);
  assert.match(source, /Cache-Control["']?\s*:\s*["']no-store/);
  assert.ok(source.indexOf("await requireAuth(req)") < source.indexOf("auth.client"));
});

test("usage event ingest writes through the authenticated RLS client without a service role", async () => {
  const source = await readFile(new URL("../../src/app/api/llm/usage/event/route.ts", import.meta.url), "utf8");
  assert.match(source, /await requireAuth\(req\)/);
  assert.match(source, /auth\.client/);
  assert.doesNotMatch(source, /getSupabaseAdmin/);
  assert.ok(source.indexOf("await requireAuth(req)") < source.indexOf("auth.client"));
});

test("Token Intelligence states ledger truth and never labels estimates as provider billing", async () => {
  const [page, cockpit] = await Promise.all([
    readFile(new URL("../../src/app/models/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/features/models-costs/token-current-cockpit.tsx", import.meta.url), "utf8"),
  ]);
  const source = `${page}\n${cockpit}`;
  assert.match(source, /Token Intelligence/);
  assert.match(source, /recorded usage/i);
  assert.match(source, /Owner budget left/);
  assert.match(source, /niet providerquota/);
  assert.match(source, /Provider remaining/);
  assert.match(source, /geen vergelijkbare bron aangesloten/);
  assert.match(source, /currency:\s*"EUR"/);
  assert.match(cockpit, /summary\.currency\.source/);
  assert.match(source, /provider-reported/);
  assert.match(source, /recorded-estimate/);
  assert.match(source, /quota, cache en context blijven onbekend zonder bron/);
  assert.match(page, /15_000/);
  assert.match(page, /postgres_changes/);
  assert.doesNotMatch(source, /DEMO LIVE/);
});

test("Token Intelligence keeps fixed-screen operational typography readable", async () => {
  const [page, cockpit] = await Promise.all([
    readFile(new URL("../../src/app/models/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/features/models-costs/token-current-cockpit.tsx", import.meta.url), "utf8"),
  ]);
  const source = `${page}\n${cockpit}`;
  assert.doesNotMatch(source, /text-\[(?:8|9|10|11|12)px\]/);
  assert.match(source, /text-\[13px\]/);
  assert.match(source, /text-\[14px\]/);
  assert.match(source, /text-\[15px\]/);
  assert.match(source, /text-\[16px\]/);
  assert.match(source, /text-\[24px\]/);
  assert.match(source, /text-\[32px\]/);
  assert.match(page, /h-full min-h-0.*overflow-hidden/);
  assert.match(cockpit, /min-h-0 overflow-auto/);
});

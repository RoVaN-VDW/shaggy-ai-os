export type UsageLedgerEvent = {
  id: string;
  provider: string;
  model: string;
  project_id: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_estimate: number;
  latency_ms: number;
  status: string;
  created_at: string;
};

export type UsageProvider = {
  id: string;
  provider: string;
  model: string;
  status: string;
  health_status: string;
  last_seen_at: string | null;
  cost_profile?: Record<string, unknown>;
};

export type UsageProject = { id: string; name: string };

type Budget = {
  monthlyCostEur: number | null;
  remainingCostEur: number | null;
  monthlyTokens: number | null;
  remainingTokens: number | null;
  period: "monthly";
  resetsAt: string;
  source: "model_providers.cost_profile";
};

function finiteNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function round(value: number, precision = 6): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function nextMonthlyReset(generatedAt: string, configuredDay: unknown): string {
  const now = new Date(generatedAt);
  const parsedDay = finiteNumber(configuredDay);
  const resetDay = Math.min(28, Math.max(1, Math.floor(parsedDay ?? 1)));
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), resetDay));
  if (reset.getTime() <= now.getTime()) reset.setUTCMonth(reset.getUTCMonth() + 1);
  return reset.toISOString();
}

function configuredBudget(
  profile: Record<string, unknown> | undefined,
  cost: number,
  tokens: number,
  generatedAt: string,
): Budget | null {
  if (!profile) return null;
  const monthlyCostEur = finiteNumber(profile.monthly_budget_eur ?? profile.monthlyBudgetEur);
  const monthlyTokens = finiteNumber(profile.monthly_token_budget ?? profile.monthlyTokenBudget);
  if (monthlyCostEur === null && monthlyTokens === null) return null;
  return {
    monthlyCostEur,
    remainingCostEur: monthlyCostEur === null ? null : round(Math.max(0, monthlyCostEur - cost)),
    monthlyTokens,
    remainingTokens: monthlyTokens === null ? null : Math.max(0, Math.floor(monthlyTokens - tokens)),
    period: "monthly",
    resetsAt: nextMonthlyReset(generatedAt, profile.budget_reset_day ?? profile.budgetResetDay),
    source: "model_providers.cost_profile",
  };
}

function eventNumbers(event: UsageLedgerEvent) {
  const inputTokens = Math.max(0, Number(event.input_tokens) || 0);
  const outputTokens = Math.max(0, Number(event.output_tokens) || 0);
  return {
    inputTokens,
    outputTokens,
    tokens: inputTokens + outputTokens,
    cost: Math.max(0, Number(event.cost_estimate) || 0),
    latency: Math.max(0, Number(event.latency_ms) || 0),
    failed: event.status === "error" ? 1 : 0,
  };
}

export function buildUsageSummary({
  events,
  budgetEvents = events,
  providers,
  projects,
  periodDays,
  generatedAt,
  currency,
  truncated = false,
}: {
  events: UsageLedgerEvent[];
  budgetEvents?: UsageLedgerEvent[];
  providers: UsageProvider[];
  projects: UsageProject[];
  periodDays: number;
  generatedAt: string;
  currency: { code: "EUR"; sourceCurrency: "USD"; usdToEurRate: number; source: "ECB"; asOf: string };
  truncated?: boolean;
}) {
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const modelProviders = new Map(
    providers.map((provider) => [`${provider.provider.toLowerCase()}::${provider.model.toLowerCase()}`, provider]),
  );
  const modelBuckets = new Map<string, UsageLedgerEvent[]>();
  const budgetModelBuckets = new Map<string, UsageLedgerEvent[]>();
  const projectBuckets = new Map<string, UsageLedgerEvent[]>();
  const trendBuckets = new Map<string, UsageLedgerEvent[]>();

  for (const event of events) {
    const modelKey = `${event.provider.toLowerCase()}::${event.model.toLowerCase()}`;
    modelBuckets.set(modelKey, [...(modelBuckets.get(modelKey) ?? []), event]);
    const projectKey = event.project_id ?? "unassigned";
    projectBuckets.set(projectKey, [...(projectBuckets.get(projectKey) ?? []), event]);
    const day = event.created_at.slice(0, 10);
    trendBuckets.set(day, [...(trendBuckets.get(day) ?? []), event]);
  }

  for (const event of budgetEvents) {
    const modelKey = `${event.provider.toLowerCase()}::${event.model.toLowerCase()}`;
    budgetModelBuckets.set(modelKey, [...(budgetModelBuckets.get(modelKey) ?? []), event]);
  }

  for (const provider of providers) {
    const modelKey = `${provider.provider.toLowerCase()}::${provider.model.toLowerCase()}`;
    if (!modelBuckets.has(modelKey)) modelBuckets.set(modelKey, []);
  }

  const summarize = (items: UsageLedgerEvent[]) => {
    const values = items.map(eventNumbers);
    const inputTokens = values.reduce((sum, item) => sum + item.inputTokens, 0);
    const outputTokens = values.reduce((sum, item) => sum + item.outputTokens, 0);
    const tokens = inputTokens + outputTokens;
    const costEstimate = round(values.reduce((sum, item) => sum + item.cost, 0));
    const failedRequests = values.reduce((sum, item) => sum + item.failed, 0);
    const requests = items.length;
    return {
      requests,
      inputTokens,
      outputTokens,
      tokens,
      costEstimate,
      failedRequests,
      successRate: requests === 0 ? null : round(((requests - failedRequests) / requests) * 100, 1),
      averageLatencyMs: requests === 0 ? null : Math.round(values.reduce((sum, item) => sum + item.latency, 0) / requests),
      costPerMillionTokens: tokens === 0 ? null : round((costEstimate / tokens) * 1_000_000),
      costPerRequest: requests === 0 ? null : round(costEstimate / requests),
    };
  };

  const totalsBase = summarize(events);
  const models = [...modelBuckets.entries()].map(([key, items]) => {
    const metrics = summarize(items);
    const budgetMetrics = summarize(budgetModelBuckets.get(key) ?? []);
    const first = items[0];
    const configured = modelProviders.get(key);
    return {
      provider: first?.provider ?? configured?.provider ?? "unknown",
      model: first?.model ?? configured?.model ?? "unknown",
      providerStatus: configured?.status ?? "unregistered",
      healthStatus: configured?.health_status ?? "unknown",
      lastSeenAt: configured?.last_seen_at ?? first?.created_at ?? null,
      observationStatus: items.length > 0 ? "observed" as const : "configured-unobserved" as const,
      ...metrics,
      budget: configuredBudget(
        configured?.cost_profile,
        budgetMetrics.costEstimate,
        budgetMetrics.tokens,
        generatedAt,
      ),
    };
  }).sort((left, right) => right.costEstimate - left.costEstimate || right.tokens - left.tokens);

  const providerMap = new Map<string, typeof models>();
  for (const model of models) {
    const key = model.provider.toLowerCase();
    providerMap.set(key, [...(providerMap.get(key) ?? []), model]);
  }
  const providerRows = [...providerMap.entries()].map(([key, rows]) => ({
    provider: rows[0].provider,
    requests: rows.reduce((sum, row) => sum + row.requests, 0),
    tokens: rows.reduce((sum, row) => sum + row.tokens, 0),
    costEstimate: round(rows.reduce((sum, row) => sum + row.costEstimate, 0)),
    modelCount: rows.length,
    configured: providers.some((provider) => provider.provider.toLowerCase() === key),
  })).sort((left, right) => right.costEstimate - left.costEstimate || right.tokens - left.tokens);

  const projectRows = [...projectBuckets.entries()].map(([id, items]) => {
    const metrics = summarize(items);
    return {
      id: id === "unassigned" ? null : id,
      name: id === "unassigned" ? "Unassigned" : projectNames.get(id) ?? "Unknown project",
      requests: metrics.requests,
      tokens: metrics.tokens,
      costEstimate: metrics.costEstimate,
    };
  }).sort((left, right) => right.costEstimate - left.costEstimate || right.tokens - left.tokens);

  const trend = [...trendBuckets.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([day, items]) => {
    const metrics = summarize(items);
    return { day, requests: metrics.requests, tokens: metrics.tokens, costEstimate: metrics.costEstimate };
  });

  const budgetedModels = models.filter((model) => model.budget !== null);
  const costBudgetedModels = budgetedModels.filter((model) => model.budget?.monthlyCostEur !== null);
  const tokenBudgetedModels = budgetedModels.filter((model) => model.budget?.monthlyTokens !== null);
  const internalBudget = {
    configuredModels: budgetedModels.length,
    monthlyCostEur: costBudgetedModels.length === 0
      ? null
      : round(costBudgetedModels.reduce((sum, model) => sum + (model.budget?.monthlyCostEur ?? 0), 0)),
    remainingCostEur: costBudgetedModels.length === 0
      ? null
      : round(costBudgetedModels.reduce((sum, model) => sum + (model.budget?.remainingCostEur ?? 0), 0)),
    monthlyTokens: tokenBudgetedModels.length === 0
      ? null
      : tokenBudgetedModels.reduce((sum, model) => sum + (model.budget?.monthlyTokens ?? 0), 0),
    remainingTokens: tokenBudgetedModels.length === 0
      ? null
      : tokenBudgetedModels.reduce((sum, model) => sum + (model.budget?.remainingTokens ?? 0), 0),
    resetsAt: budgetedModels.map((model) => model.budget?.resetsAt).filter((value): value is string => Boolean(value)).sort()[0] ?? null,
    source: "model_providers.cost_profile" as const,
  };
  const configuredModels = models.filter((model) => model.providerStatus !== "unregistered");
  const observedModels = models.filter((model) => model.observationStatus === "observed");
  const isClaude = (provider: string) => {
    const normalized = provider.toLowerCase();
    return normalized === "anthropic" || normalized === "claude";
  };
  const catalog = {
    configuredModels: configuredModels.length,
    observedModels: observedModels.length,
    configuredUnobservedModels: configuredModels.filter((model) => model.observationStatus === "configured-unobserved").length,
    claudeConfiguredModels: configuredModels.filter((model) => isClaude(model.provider)).length,
    claudeObservedModels: observedModels.filter((model) => isClaude(model.provider)).length,
    claudeCatalog: { state: "unavailable" as const, source: null },
  };

  return {
    generatedAt,
    periodDays,
    source: "supabase:usage_events",
    currency,
    truncated,
    truth: {
      recordedLedger: "available" as const,
      providerBilling: "unavailable" as const,
      providerCredits: "unavailable" as const,
      cachedTokens: "unavailable" as const,
      contextRemaining: "unavailable" as const,
      tokenSemantics: "Recorded provider usage where available; legacy fallbacks may be estimated.",
      costSemantics: "Recorded USD estimates converted to EUR using the stated ECB reference rate; not reconciled provider invoices.",
    },
    totals: { ...totalsBase, remainingProviderCredits: null, cachedTokens: null, contextRemaining: null },
    internalBudget,
    catalog,
    quality: {
      recordedTokens: { state: "recorded" as const, source: "supabase:usage_events" },
      internalBudget: { state: "calculated" as const, source: "model_providers.cost_profile" },
      providerQuota: { state: "unavailable" as const, source: null },
    },
    models,
    providers: providerRows,
    projects: projectRows,
    trend,
    recent: events.slice(0, 8),
  };
}

export type UsageSummary = ReturnType<typeof buildUsageSummary>;

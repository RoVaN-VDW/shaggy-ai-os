export type UsageLedgerEvent = {
  id: string;
  provider: string;
  model: string;
  project_id: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_estimate: number | null;
  estimated_cost_usd?: number | null;
  actual_cost_usd?: number | null;
  cost_status?: "unknown" | "estimated" | "actual" | "included";
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  reasoning_tokens?: number;
  api_call_count?: number;
  latency_ms: number | null;
  status: string;
  created_at: string;
  metadata?: { trust_level?: "native-aggregate" | "client-reported" };
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

export type WorkflowLedgerEvent = {
  event_id: string;
  event_kind: string;
  occurred_at: string;
  project: string | null;
  task_id: string | null;
  task_type: string | null;
  route_key: string | null;
  retries: number;
  duplicate_context_tokens: number;
  projected_cost_usd: number | null;
  recorded_cost_usd: number | null;
  payload?: Record<string, unknown>;
};

export type UsageAlert = {
  kind: "budget" | "anomaly" | "retry" | "context_waste";
  severity: "info" | "warning" | "critical";
  message: string;
  event_id?: string;
  provider?: string;
  model?: string;
};

type Budget = {
  monthlyCostEur: number | null;
  remainingCostEur: number | null;
  monthlyTokens: number | null;
  remainingTokens: number | null;
  period: "monthly";
  startsAt: string;
  resetsAt: string;
  source: "local-sqlite:model_budgets";
};

type MetricAvailability = "available" | "partial" | "unavailable" | "stale" | "error";
type MetricConfidence = "provider-reported" | "server-measured" | "recorded-estimate" | "manual-configuration" | "unknown";
type MetricWindow = {
  type: "selected-period" | "calendar-month" | "unknown";
  startAt: string | null;
  endAt: string | null;
  resetAt: string | null;
};

type TokenMetric = {
  value: number | null;
  unit: "tokens";
  availability: MetricAvailability;
  source: string | null;
  observedAt: string | null;
  confidence: MetricConfidence;
  window: MetricWindow;
  reason: string | null;
};

function finiteNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function round(value: number, precision = 6): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function monthlyBudgetCycle(generatedAt: string, configuredDay: unknown) {
  const now = new Date(generatedAt);
  const parsedDay = finiteNumber(configuredDay);
  const resetDay = Math.min(28, Math.max(1, Math.floor(parsedDay ?? 1)));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), resetDay));
  if (start.getTime() > now.getTime()) start.setUTCMonth(start.getUTCMonth() - 1);
  const reset = new Date(start);
  reset.setUTCMonth(reset.getUTCMonth() + 1);
  return { startsAt: start.toISOString(), resetsAt: reset.toISOString() };
}

function configuredBudget(
  profile: Record<string, unknown> | undefined,
  cost: number | null,
  tokens: number,
  generatedAt: string,
  costComplete: boolean,
  tokenComplete: boolean,
): Budget | null {
  if (!profile) return null;
  const monthlyCostEur = finiteNumber(profile.monthly_budget_eur ?? profile.monthlyBudgetEur);
  const monthlyTokens = finiteNumber(profile.monthly_token_budget ?? profile.monthlyTokenBudget);
  if (monthlyCostEur === null && monthlyTokens === null) return null;
  const cycle = monthlyBudgetCycle(generatedAt, profile.budget_reset_day ?? profile.budgetResetDay);
  return {
    monthlyCostEur,
    remainingCostEur: monthlyCostEur === null || !costComplete || cost === null ? null : round(Math.max(0, monthlyCostEur - cost)),
    monthlyTokens,
    remainingTokens: monthlyTokens === null || !tokenComplete ? null : Math.max(0, Math.floor(monthlyTokens - tokens)),
    period: "monthly",
    ...cycle,
    source: "local-sqlite:model_budgets",
  };
}

function eventNumbers(event: UsageLedgerEvent) {
  const inputTokens = Math.max(0, Number(event.input_tokens) || 0);
  const outputTokens = Math.max(0, Number(event.output_tokens) || 0);
  return {
    inputTokens,
    outputTokens,
    tokens: inputTokens + outputTokens,
    cost: event.cost_estimate == null ? null : Math.max(0, Number(event.cost_estimate) || 0),
    cacheReadTokens: Math.max(0, Number(event.cache_read_tokens) || 0),
    cacheWriteTokens: Math.max(0, Number(event.cache_write_tokens) || 0),
    reasoningTokens: Math.max(0, Number(event.reasoning_tokens) || 0),
    latency: Math.max(0, Number(event.latency_ms) || 0),
    failed: event.status === "error" ? Math.max(1, Number(event.api_call_count) || 1) : 0,
  };
}

function latestObservedAt(events: UsageLedgerEvent[]): string | null {
  return events.reduce<string | null>((latest, event) => {
    if (!latest || event.created_at > latest) return event.created_at;
    return latest;
  }, null);
}

function unavailableProviderRemaining(): TokenMetric {
  return {
    value: null,
    unit: "tokens",
    availability: "unavailable",
    source: null,
    observedAt: null,
    confidence: "unknown",
    window: { type: "unknown", startAt: null, endAt: null, resetAt: null },
    reason: "No provider-reported remaining-token source is connected.",
  };
}

function ownerBudgetMetric(budget: Budget | null, generatedAt: string): TokenMetric {
  if (!budget || budget.remainingTokens === null) {
    return {
      value: null,
      unit: "tokens",
      availability: "unavailable",
      source: budget?.source ?? null,
      observedAt: budget ? generatedAt : null,
      confidence: budget ? "manual-configuration" : "unknown",
      window: budget
        ? { type: "calendar-month", startAt: budget.startsAt, endAt: budget.resetsAt, resetAt: budget.resetsAt }
        : { type: "unknown", startAt: null, endAt: null, resetAt: null },
      reason: "No owner-configured token budget is available.",
    };
  }
  return {
    value: budget.remainingTokens,
    unit: "tokens",
    availability: "available",
    source: budget.source,
    observedAt: generatedAt,
    confidence: "manual-configuration",
    window: { type: "calendar-month", startAt: budget.startsAt, endAt: budget.resetsAt, resetAt: budget.resetsAt },
    reason: null,
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
  alerts = [],
  workflowEvents = [],
  providerQuota = { status: "unknown" as const, remaining: null, source: null },
  source = "local-sqlite:provider_usage",
}: {
  events: UsageLedgerEvent[];
  budgetEvents?: UsageLedgerEvent[];
  providers: UsageProvider[];
  projects: UsageProject[];
  periodDays: number;
  generatedAt: string;
  currency: { code: "EUR"; sourceCurrency: "USD"; usdToEurRate: number; source: "ECB"; asOf: string };
  truncated?: boolean;
  alerts?: UsageAlert[];
  workflowEvents?: WorkflowLedgerEvent[];
  providerQuota?: { status: "unknown"; remaining: null; source: null };
  source?: string;
}) {
  const selectedPeriodWindow: MetricWindow = {
    type: "selected-period",
    startAt: new Date(new Date(generatedAt).getTime() - periodDays * 86_400_000).toISOString(),
    endAt: generatedAt,
    resetAt: null,
  };
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
    const knownCosts = values.filter((item) => item.cost !== null).map((item) => item.cost as number);
    const costEstimate = items.length === 0 ? 0 : knownCosts.length === 0 ? null : round(knownCosts.reduce((sum, cost) => sum + cost, 0));
    const failedRequests = values.reduce((sum, item) => sum + item.failed, 0);
    const requests = items.reduce((sum, item) => sum + Math.max(1, Number(item.api_call_count) || 1), 0);
    const unknownOutcomeRequests = items.reduce((sum, item) =>
      sum + (item.status === "unknown" ? Math.max(1, Number(item.api_call_count) || 1) : 0), 0);
    const knownCostRequests = items.reduce((sum, item) => sum + (item.cost_estimate == null ? 0 : Math.max(1, Number(item.api_call_count) || 1)), 0);
    const measuredLatencies = values.map((item) => item.latency).filter((_, index) => items[index]?.latency_ms != null);
    const cacheReadTokens = values.reduce((sum, item) => sum + item.cacheReadTokens, 0);
    const cacheWriteTokens = values.reduce((sum, item) => sum + item.cacheWriteTokens, 0);
    const reasoningTokens = values.reduce((sum, item) => sum + item.reasoningTokens, 0);
    return {
      requests,
      inputTokens,
      outputTokens,
      tokens,
      costEstimate,
      knownCostRequests,
      unknownCostRequests: Math.max(0, requests - knownCostRequests),
      costCoverage: requests === 0 ? null : round((knownCostRequests / requests) * 100, 1),
      cacheReadTokens,
      cacheWriteTokens,
      reasoningTokens,
      failedRequests,
      unknownOutcomeRequests,
      successRate: requests === 0 || unknownOutcomeRequests > 0 ? null : round(((requests - failedRequests) / requests) * 100, 1),
      averageLatencyMs: measuredLatencies.length === 0 ? null : Math.round(measuredLatencies.reduce((sum, latency) => sum + latency, 0) / measuredLatencies.length),
      costPerMillionTokens: tokens === 0 || costEstimate === null ? null : round((costEstimate / tokens) * 1_000_000),
      costPerRequest: knownCostRequests === 0 || costEstimate === null ? null : round(costEstimate / knownCostRequests),
    };
  };

  const totalsBase = summarize(events);
  const models = [...modelBuckets.entries()].map(([key, items]) => {
    const metrics = summarize(items);
    const first = items[0];
    const configured = modelProviders.get(key);
    const cycle = monthlyBudgetCycle(generatedAt, configured?.cost_profile?.budget_reset_day ?? configured?.cost_profile?.budgetResetDay);
    const modelBudgetEvents = (budgetModelBuckets.get(key) ?? []).filter((event) =>
      event.created_at >= cycle.startsAt && event.created_at <= generatedAt,
    );
    const budgetMetrics = summarize(modelBudgetEvents);
    const trustLevels = new Set(items.map((event) => event.metadata?.trust_level).filter(Boolean));
    const trustLevel = trustLevels.size > 1 ? "mixed" : trustLevels.values().next().value ?? "unknown";
    const budget = configuredBudget(
      configured?.cost_profile,
      budgetMetrics.costEstimate,
      budgetMetrics.tokens,
      generatedAt,
      !truncated && budgetMetrics.unknownCostRequests === 0,
      !truncated,
    );
    return {
      provider: first?.provider ?? configured?.provider ?? "unknown",
      model: first?.model ?? configured?.model ?? "unknown",
      providerStatus: configured?.status ?? "unregistered",
      healthStatus: configured?.health_status ?? "unknown",
      lastSeenAt: configured?.last_seen_at ?? first?.created_at ?? null,
      observationStatus: items.length > 0 ? "observed" as const : "configured-unobserved" as const,
      trustLevel,
      ...metrics,
      budget,
      intelligence: {
        recorded: {
          value: metrics.tokens,
          unit: "tokens" as const,
          availability: "available" as const,
          source: items.length > 0 && trustLevel !== "unknown" ? `${source}:${trustLevel}` : source,
          observedAt: latestObservedAt(items),
          confidence: "recorded-estimate" as const,
          window: selectedPeriodWindow,
          reason: items.length === 0 ? "No recorded events in the selected period." : null,
        },
        providerRemaining: unavailableProviderRemaining(),
        ownerBudget: ownerBudgetMetric(budget, generatedAt),
      },
    };
  }).sort((left, right) => (right.costEstimate ?? -1) - (left.costEstimate ?? -1) || right.tokens - left.tokens);

  const providerMap = new Map<string, typeof models>();
  for (const model of models) {
    const key = model.provider.toLowerCase();
    providerMap.set(key, [...(providerMap.get(key) ?? []), model]);
  }
  const providerRows = [...providerMap.entries()].map(([key, rows]) => ({
    provider: rows[0].provider,
    requests: rows.reduce((sum, row) => sum + row.requests, 0),
    tokens: rows.reduce((sum, row) => sum + row.tokens, 0),
    costEstimate: rows.some((row) => row.costEstimate !== null)
      ? round(rows.reduce((sum, row) => sum + (row.costEstimate ?? 0), 0))
      : null,
    modelCount: rows.length,
    configured: providers.some((provider) => provider.provider.toLowerCase() === key),
  })).sort((left, right) => (right.costEstimate ?? -1) - (left.costEstimate ?? -1) || right.tokens - left.tokens);

  const projectRows = [...projectBuckets.entries()].map(([id, items]) => {
    const metrics = summarize(items);
    return {
      id: id === "unassigned" ? null : id,
      name: id === "unassigned" ? "Unassigned" : projectNames.get(id) ?? "Unknown project",
      requests: metrics.requests,
      tokens: metrics.tokens,
      costEstimate: metrics.costEstimate,
    };
  }).sort((left, right) => (right.costEstimate ?? -1) - (left.costEstimate ?? -1) || right.tokens - left.tokens);

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
    remainingCostEur: costBudgetedModels.length === 0 || costBudgetedModels.some((model) => model.budget?.remainingCostEur === null)
      ? null
      : round(costBudgetedModels.reduce((sum, model) => sum + (model.budget?.remainingCostEur ?? 0), 0)),
    monthlyTokens: tokenBudgetedModels.length === 0
      ? null
      : tokenBudgetedModels.reduce((sum, model) => sum + (model.budget?.monthlyTokens ?? 0), 0),
    remainingTokens: tokenBudgetedModels.length === 0 || tokenBudgetedModels.some((model) => model.budget?.remainingTokens === null)
      ? null
      : tokenBudgetedModels.reduce((sum, model) => sum + (model.budget?.remainingTokens ?? 0), 0),
    startsAt: budgetedModels.map((model) => model.budget?.startsAt).filter((value): value is string => Boolean(value)).sort()[0] ?? null,
    resetsAt: budgetedModels.map((model) => model.budget?.resetsAt).filter((value): value is string => Boolean(value)).sort()[0] ?? null,
    source: "local-sqlite:model_budgets" as const,
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
  const configuredProviderNames = [...new Set(providers.map((provider) => provider.provider.toLowerCase()))];
  const measuredProviderNames = [...new Set(
    models.filter((model) => model.requests > 0).map((model) => model.provider.toLowerCase()),
  )];
  const portfolioProviderNames = [...new Set([...configuredProviderNames, ...measuredProviderNames])];
  const unavailableProviders = portfolioProviderNames.filter((provider) => !measuredProviderNames.includes(provider));
  const portfolioBudget = internalBudget.remainingTokens !== null && internalBudget.resetsAt
    ? ownerBudgetMetric({
        monthlyCostEur: internalBudget.monthlyCostEur,
        remainingCostEur: internalBudget.remainingCostEur,
        monthlyTokens: internalBudget.monthlyTokens,
        remainingTokens: internalBudget.remainingTokens,
        period: "monthly",
        startsAt: internalBudget.startsAt ?? generatedAt,
        resetsAt: internalBudget.resetsAt,
        source: internalBudget.source,
      }, generatedAt)
    : ownerBudgetMetric(null, generatedAt);
  const intelligence = {
    recorded: {
      value: totalsBase.tokens,
      unit: "tokens" as const,
      availability: "available" as const,
      source,
      observedAt: latestObservedAt(events),
      confidence: "recorded-estimate" as const,
      window: selectedPeriodWindow,
      reason: events.length === 0 ? "No recorded events in the selected period." : null,
    },
    ownerBudgetRemaining: portfolioBudget,
    providerRemaining: unavailableProviderRemaining(),
    providerRemainingComparable: false,
    coverage: {
      measuredProviders: measuredProviderNames.length,
      configuredProviders: portfolioProviderNames.length,
      unavailableProviders,
      ratio: portfolioProviderNames.length === 0 ? 0 : measuredProviderNames.length / portfolioProviderNames.length,
    },
  };

  return {
    generatedAt,
    periodDays,
    source,
    currency,
    truncated,
    truth: {
      recordedLedger: "available" as const,
      providerBilling: "unavailable" as const,
      providerCredits: "unavailable" as const,
      cachedTokens: "available" as const,
      reasoningTokens: "available" as const,
      contextRemaining: "unavailable" as const,
      tokenSemantics: "Recorded provider usage where available; legacy fallbacks may be estimated.",
      costSemantics: "Recorded USD estimates converted to EUR using the stated ECB reference rate; not reconciled provider invoices.",
    },
    totals: { ...totalsBase, remainingProviderCredits: null, cachedTokens: totalsBase.cacheReadTokens, contextRemaining: null },
    internalBudget,
    intelligence,
    catalog,
    quality: {
      recordedTokens: { state: "recorded" as const, source },
      internalBudget: { state: "calculated" as const, source: "local-sqlite:model_budgets" },
      providerQuota: { state: "unavailable" as const, source: null },
    },
    models,
    providers: providerRows,
    projects: projectRows,
    trend,
    recent: events.slice(0, 36),
    alerts,
    workflow: {
      events: workflowEvents.length,
      retries: workflowEvents.reduce((sum, event) => sum + event.retries, 0),
      projectedCostUsd: round(workflowEvents.reduce((sum, event) => sum + (event.projected_cost_usd ?? 0), 0)),
      recordedCostUsd: round(workflowEvents.reduce((sum, event) => sum + (event.recorded_cost_usd ?? 0), 0)),
    },
    providerQuota,
  };
}

export type UsageSummary = ReturnType<typeof buildUsageSummary>;

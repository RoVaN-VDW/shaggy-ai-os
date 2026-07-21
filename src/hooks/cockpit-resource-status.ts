export const COCKPIT_RESOURCE_SOURCES = {
  projects: "local-api:projects",
  providers: "supabase:model_providers",
  reviews: "supabase:review_items",
  usage: "supabase:usage_events",
  dailyUsage: "supabase:get_daily_usage",
  notifications: "supabase:notifications",
  knowledgeDocs: "supabase:knowledge_docs",
  agentActivity: "supabase:agent_activity",
} as const;

export type CockpitResourceKey = keyof typeof COCKPIT_RESOURCE_SOURCES;
export type CockpitResourceStatus = "loading" | "live" | "stale" | "error" | "unavailable";

export type CockpitResourceState = {
  status: CockpitResourceStatus;
  source: (typeof COCKPIT_RESOURCE_SOURCES)[CockpitResourceKey];
  fetchedAt: string | null;
  error: string | null;
};

export type CockpitResourceStates = Record<CockpitResourceKey, CockpitResourceState>;

export function createInitialResourceStates(): CockpitResourceStates {
  return Object.fromEntries(
    Object.entries(COCKPIT_RESOURCE_SOURCES).map(([key, source]) => [
      key,
      { status: "loading", source, fetchedAt: null, error: null },
    ]),
  ) as CockpitResourceStates;
}

export function markResourcesRefreshing(resources: CockpitResourceStates): CockpitResourceStates {
  return Object.fromEntries(
    Object.entries(resources).map(([key, resource]) => [
      key,
      {
        ...resource,
        status: resource.fetchedAt ? "stale" : "loading",
        error: null,
      },
    ]),
  ) as CockpitResourceStates;
}

export function resolveResourceState(
  previous: CockpitResourceState,
  error: string | null,
  fetchedAt: string,
): CockpitResourceState {
  if (error) {
    return {
      ...previous,
      status: previous.fetchedAt ? "stale" : "error",
      error,
    };
  }

  return {
    ...previous,
    status: "live",
    fetchedAt,
    error: null,
  };
}

export function resolveCockpitResourceStates(
  previous: CockpitResourceStates,
  errors: Record<CockpitResourceKey, string | null>,
  fetchedAt: string,
): CockpitResourceStates {
  return Object.fromEntries(
    (Object.keys(COCKPIT_RESOURCE_SOURCES) as CockpitResourceKey[]).map((key) => [
      key,
      resolveResourceState(previous[key], errors[key], fetchedAt),
    ]),
  ) as CockpitResourceStates;
}

export function resolveResourceData<T>(
  previous: T[],
  next: T[] | null,
  error: string | null,
): T[] {
  return error ? previous : (next ?? []);
}

export function setNotificationReadValue<T extends { id: string; read: boolean }>(
  notifications: T[],
  id: string,
  read: boolean,
): T[] {
  return notifications.map((notification) => (
    notification.id === id ? { ...notification, read } : notification
  ));
}

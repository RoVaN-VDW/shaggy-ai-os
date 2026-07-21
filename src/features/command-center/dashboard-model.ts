import type {
  AgentActivity, DailyUsage, KnowledgeDoc, ModelProvider, Notification, Project, ReviewItem, UsageEvent,
} from "@/hooks/useCockpitData";
import {
  buildActivityTrace,
  buildDailyUsageSeries,
  buildKnowledgeGraph,
  buildMissionHealth,
  buildProjectHealthBars,
} from "./visualization/chart-model.ts";

export const COGNITIVE_SPACES = [
  { label: "Command", href: "/", tone: "gold" },
  { label: "Knowledge", href: "/knowledge", tone: "cyan" },
  { label: "Create", href: "/creative", tone: "cyan" },
  { label: "Automate", href: "/review", tone: "cyan" },
  { label: "Analyze", href: "/artifacts", tone: "cyan" },
  { label: "Evolve", href: "/twin", tone: "cyan" },
] as const;

type CockpitRecords = {
  projects: Project[];
  providers: ModelProvider[];
  reviews: ReviewItem[];
  usage: UsageEvent[];
  dailyUsage: DailyUsage[];
  notifications: Notification[];
  knowledgeDocs: KnowledgeDoc[];
  agentActivity: AgentActivity[];
  resources?: Partial<Record<ResourceKey, DashboardResourceState>>;
};

type ResourceKey = "projects" | "providers" | "reviews" | "usage" | "dailyUsage" | "notifications" | "knowledgeDocs" | "agentActivity";

type DashboardResourceState = {
  status: "loading" | "live" | "stale" | "error" | "unavailable";
  source: string;
  fetchedAt: string | null;
  error: string | null;
};

export function formatCurrencyMetric(value: number | null) {
  return value === null ? "Unavailable" : `$${value.toFixed(2)}`;
}

export function formatCountMetric(value: number | null) {
  return value === null ? "Unavailable" : String(value);
}

export function formatIndexedSourceCount(value: number | null) {
  if (value === null) return "Knowledge source unavailable";
  if (value === 0) return "No indexed sources";
  return `${value} indexed ${value === 1 ? "source" : "sources"}`;
}

function formatLabeledCount(value: number | null, singular: string, plural: string) {
  return value === null ? "Unavailable" : `${value} ${value === 1 ? singular : plural}`;
}

function resourceState(data: CockpitRecords, key: ResourceKey): DashboardResourceState {
  return data.resources?.[key] ?? {
    status: "unavailable",
    source: "supabase",
    fetchedAt: null,
    error: null,
  };
}

function isReadable(resource: DashboardResourceState) {
  return resource.status === "live" || resource.status === "stale";
}

export function buildDreamDashboardModel(data: CockpitRecords) {
  const projectResource = resourceState(data, "projects");
  const providerResource = resourceState(data, "providers");
  const reviewResource = resourceState(data, "reviews");
  const usageResource = resourceState(data, "usage");
  const dailyUsageResource = resourceState(data, "dailyUsage");
  const notificationResource = resourceState(data, "notifications");
  const knowledgeResource = resourceState(data, "knowledgeDocs");
  const activityResource = resourceState(data, "agentActivity");
  const projectsReadable = isReadable(projectResource);
  const providersReadable = isReadable(providerResource);
  const notificationsReadable = isReadable(notificationResource);
  const missionProject = projectsReadable
    ? data.projects.find((project) => project.status === "active") ?? data.projects[0]
    : undefined;
  const healthy = providersReadable ? data.providers.filter(
    (provider) => provider.status === "active" && provider.health_status === "healthy",
  ).length : null;
  const usageReadable = isReadable(usageResource);
  const dailyUsageReadable = isReadable(dailyUsageResource);
  const missionHealth = buildMissionHealth(missionProject?.health_score ?? null);
  const projectCount = projectsReadable ? data.projects.length : null;
  const reviewCount = isReadable(reviewResource) ? data.reviews.length : null;
  const knowledgeCount = isReadable(knowledgeResource) ? data.knowledgeDocs.length : null;
  const usageEventCount = usageReadable ? data.usage.length : null;
  const cognitiveSpaceMeta = [
    formatLabeledCount(projectCount, "project", "projects"),
    formatLabeledCount(knowledgeCount, "source", "sources"),
    "Workspace",
    formatLabeledCount(reviewCount, "approval", "approvals"),
    formatLabeledCount(usageEventCount, "event", "events"),
    "Twin",
  ] as const;

  return {
    mission: missionProject ? {
      available: true,
      id: missionProject.id,
      title: missionProject.name,
      description: missionProject.description || "No mission description supplied.",
      status: missionProject.status,
      health: missionHealth.health,
      sourceStatus: projectResource.status,
      fetchedAt: projectResource.fetchedAt,
    } : !projectsReadable ? {
      available: false,
      id: null,
      title: "Mission data unavailable",
      description: "The projects source is not currently readable.",
      status: projectResource.status,
      health: null,
      sourceStatus: projectResource.status,
      fetchedAt: projectResource.fetchedAt,
    } : {
      available: false,
      id: null,
      title: "No active mission selected",
      description: "Create or activate a project to establish today’s mission.",
      status: "unavailable",
      health: null,
      sourceStatus: projectResource.status,
      fetchedAt: projectResource.fetchedAt,
    },
    projectCount,
    reviewCount,
    knowledgeCount,
    cognitiveSpaces: COGNITIVE_SPACES.map((space, index) => ({ ...space, meta: cognitiveSpaceMeta[index] })),
    health: {
      score: providersReadable && data.providers.length > 0 && healthy !== null
        ? Math.round((healthy / data.providers.length) * 100)
        : null,
      healthy,
      total: providersReadable ? data.providers.length : null,
      sourceStatus: providerResource.status,
      fetchedAt: providerResource.fetchedAt,
    },
    briefing: notificationsReadable ? data.notifications.slice(0, 3) : [],
    briefingSourceStatus: notificationResource.status,
    activity: isReadable(activityResource) ? data.agentActivity.slice(0, 4) : [],
    activitySourceStatus: activityResource.status,
    knowledge: isReadable(knowledgeResource) ? data.knowledgeDocs.slice(0, 4) : [],
    knowledgeSourceStatus: knowledgeResource.status,
    projects: projectsReadable ? data.projects.slice(0, 3) : [],
    projectHealthBars: projectsReadable ? buildProjectHealthBars(data.projects).slice(0, 4) : [],
    portfolioSourceStatus: projectResource.status,
    providers: providersReadable ? data.providers.slice(0, 4) : [],
    reviews: isReadable(reviewResource) ? data.reviews.slice(0, 3) : [],
    usageTrend: dailyUsageReadable ? buildDailyUsageSeries(data.dailyUsage ?? []) : [],
    usageTrendSourceStatus: dailyUsageResource.status,
    usageTrendFetchedAt: dailyUsageResource.fetchedAt,
    activityTrace: isReadable(activityResource) ? buildActivityTrace(data.agentActivity).slice(0, 4) : [],
    knowledgeGraph: projectsReadable && isReadable(knowledgeResource)
      ? buildKnowledgeGraph(data.projects, data.knowledgeDocs)
      : { nodes: [], edges: [] },
    insights: {
      spend: usageReadable ? data.usage.reduce((total, event) => total + (event.cost_estimate || 0), 0) : null,
      events: usageEventCount,
      failed: usageReadable ? data.usage.filter((event) => event.status === "error").length : null,
      unread: notificationsReadable
        ? data.notifications.filter((notification) => !notification.read).length
        : null,
      sourceStatus: usageResource.status,
      fetchedAt: usageResource.fetchedAt,
      notificationStatus: notificationResource.status,
    },
  };
}

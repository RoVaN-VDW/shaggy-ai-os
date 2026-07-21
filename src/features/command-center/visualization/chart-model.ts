export type MissionHealthModel = {
  health: number | null;
  label: "Mission health";
};

export function buildMissionHealth(value: number | null): MissionHealthModel {
  return {
    health: value !== null && Number.isFinite(value)
      ? Math.max(0, Math.min(100, value))
      : null,
    label: "Mission health",
  };
}

type DailyUsageRecord = {
  day: string;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  event_count: number;
};

export type DailyUsagePoint = {
  day: string;
  cost: number;
  tokens: number;
  events: number;
};

export function buildDailyUsageSeries(records: DailyUsageRecord[]): DailyUsagePoint[] {
  const points = new Map<string, DailyUsagePoint>();
  for (const record of records) {
    const point = points.get(record.day) ?? { day: record.day, cost: 0, tokens: 0, events: 0 };
    point.cost += Number.isFinite(record.total_cost) ? record.total_cost : 0;
    point.tokens += (Number.isFinite(record.total_input_tokens) ? record.total_input_tokens : 0)
      + (Number.isFinite(record.total_output_tokens) ? record.total_output_tokens : 0);
    point.events += Number.isFinite(record.event_count) ? record.event_count : 0;
    points.set(record.day, point);
  }
  return [...points.values()].sort((a, b) => a.day.localeCompare(b.day));
}

type ProjectHealthRecord = {
  id: string;
  name: string;
  status: string;
  health_score: number;
};

export type ProjectHealthBar = {
  id: string;
  name: string;
  status: string;
  health: number | null;
  label: "Project health";
  tone: HealthTone;
};

export type HealthTone = "critical" | "attention" | "healthy" | "unavailable";

export function classifyHealthTone(value: number | null): HealthTone {
  if (value === null || !Number.isFinite(value)) return "unavailable";
  if (value < 40) return "critical";
  if (value < 70) return "attention";
  return "healthy";
}

export function buildProjectHealthBars(records: ProjectHealthRecord[]): ProjectHealthBar[] {
  return records
    .map((record) => ({
      id: record.id,
      name: record.name,
      status: record.status,
      health: Number.isFinite(record.health_score)
        ? Math.max(0, Math.min(100, record.health_score))
        : null,
      label: "Project health" as const,
      tone: classifyHealthTone(Number.isFinite(record.health_score) ? record.health_score : null),
    }))
    .sort((a, b) => (a.health ?? Number.POSITIVE_INFINITY) - (b.health ?? Number.POSITIVE_INFINITY));
}

type ActivityRecord = {
  id: string;
  agent: string;
  action: string;
  status: string;
  created_at: string;
};

export type ActivityTracePoint = ActivityRecord & {
  order: number;
  tone: "success" | "error" | "active";
};

export function buildActivityTrace(records: ActivityRecord[]): ActivityTracePoint[] {
  return [...records]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .map((record, order) => ({
      ...record,
      order,
      tone: record.status === "error"
        ? "error" as const
        : record.status === "success"
          ? "success" as const
          : "active" as const,
    }));
}

type KnowledgeProject = { id: string; name: string };
type KnowledgeDocument = { id: string; name: string; project_id?: string; embedding_status: string };

export type KnowledgeGraphNode = {
  id: string;
  label: string;
  kind: "project" | "document";
  group: string;
  x: number;
  y: number;
  status: string;
};

export type KnowledgeGraph = {
  nodes: KnowledgeGraphNode[];
  edges: Array<{ source: string; target: string }>;
};

export type KnowledgeGraphLabelPlacement = {
  x: number;
  y: number;
  textAnchor: "start" | "middle" | "end";
};

export function getKnowledgeGraphLabelPlacement(node: KnowledgeGraphNode): KnowledgeGraphLabelPlacement {
  if (node.kind === "document") {
    if (node.y <= 50) return { x: node.x, y: Math.max(10, node.y - 4), textAnchor: "middle" };
    if (node.x < 30) return { x: 4, y: Math.min(96, node.y + 8), textAnchor: "start" };
    if (node.x > 70) return { x: 96, y: Math.min(96, node.y + 8), textAnchor: "end" };
    return { x: node.x, y: Math.min(96, node.y + 8), textAnchor: "middle" };
  }
  if (node.y <= 30) return { x: node.x, y: node.y + 10, textAnchor: "middle" };
  if (node.x >= 50) return { x: 96, y: node.y - 7, textAnchor: "end" };
  return { x: 4, y: Math.min(96, node.y + 10), textAnchor: "start" };
}

export function formatKnowledgeGraphLabel(label: string): string {
  return label.length > 16 ? `${label.slice(0, 15)}…` : label;
}

export function buildKnowledgeGraph(
  projects: KnowledgeProject[],
  documents: KnowledgeDocument[],
): KnowledgeGraph {
  const projectNodes = projects.map((project, index) => {
    const angle = ((Math.PI * 2) / Math.max(projects.length, 1)) * index - (Math.PI / 2);
    return {
      id: `project:${project.id}`,
      label: project.name,
      kind: "project" as const,
      group: project.id,
      x: Math.round(50 + (Math.cos(angle) * 28)),
      y: Math.round(48 + (Math.sin(angle) * 28)),
      status: "project",
    };
  });
  const projectIndex = new Map(projects.map((project, index) => [project.id, index]));
  const documentsByProject = new Map<string, number>();
  let orphanIndex = 0;
  const documentNodes = documents.map((document) => {
    const ownerIndex = document.project_id ? projectIndex.get(document.project_id) : undefined;
    if (ownerIndex === undefined) {
      const index = orphanIndex++;
      return {
        id: `doc:${document.id}`,
        label: document.name,
        kind: "document" as const,
        group: "unassigned",
        x: 14 + ((index % 4) * 16),
        y: 88 - (Math.floor(index / 4) * 10),
        status: document.embedding_status,
      };
    }
    const projectNode = projectNodes[ownerIndex];
    const siblingIndex = documentsByProject.get(document.project_id!) ?? 0;
    documentsByProject.set(document.project_id!, siblingIndex + 1);
    const angle = ((Math.PI * 2) / 5) * siblingIndex;
    return {
      id: `doc:${document.id}`,
      label: document.name,
      kind: "document" as const,
      group: document.project_id!,
      x: Math.round(projectNode.x + (Math.cos(angle) * 11)),
      y: Math.round(projectNode.y + (Math.sin(angle) * 11)),
      status: document.embedding_status,
    };
  });
  const edges = documents
    .filter((document) => document.project_id && projectIndex.has(document.project_id))
    .map((document) => ({ source: `project:${document.project_id}`, target: `doc:${document.id}` }));
  return { nodes: [...projectNodes, ...documentNodes], edges };
}

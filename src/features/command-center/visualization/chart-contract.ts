export type SourceState = {
  status: "loading" | "live" | "stale" | "error" | "unavailable";
  source: string;
  fetchedAt: string | null;
  error: string | null;
};

export type SemanticChartStatus = SourceState["status"] | "insufficient";

export type SemanticChartState = {
  status: SemanticChartStatus;
  source: string;
  fetchedAt: string | null;
  error: string | null;
  pointCount: number;
  minimumPoints: number;
};

export function resolveChartState(
  source: SourceState,
  pointCount: number,
  minimumPoints = 1,
): SemanticChartState {
  const status = (source.status === "live" || source.status === "stale") && pointCount < minimumPoints
    ? "insufficient"
    : source.status;
  return {
    status,
    source: source.source,
    fetchedAt: source.fetchedAt,
    error: source.error,
    pointCount,
    minimumPoints,
  };
}

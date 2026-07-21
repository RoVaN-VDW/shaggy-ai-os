export type SecondBrainBackupState = "verified" | "pending" | "stale" | "unavailable";

export type SecondBrainRecentChange = {
  project: string;
  kind: "decision" | "state" | "action" | "index" | "backup";
  at: string;
};

export type SecondBrainSnapshot = {
  version: 1;
  observedAt: string;
  indexedProjects: number;
  continuityFilesPresent: number;
  continuityFilesExpected: number;
  openActions: number | null;
  unresolvedDecisions: number | null;
  staleProjects: number;
  backupState: SecondBrainBackupState;
  recentChanges: SecondBrainRecentChange[];
};

export type SecondBrainContinuitySummary = {
  coverage: number | null;
  label: "file continuity";
  state: "healthy" | "attention" | "unavailable";
  detail: string;
};

const SNAPSHOT_FIELDS = new Set([
  "version", "observedAt", "indexedProjects", "continuityFilesPresent",
  "continuityFilesExpected", "openActions", "unresolvedDecisions",
  "staleProjects", "backupState", "recentChanges",
]);
const CHANGE_FIELDS = new Set(["project", "kind", "at"]);
const BACKUP_STATES = new Set<SecondBrainBackupState>(["verified", "pending", "stale", "unavailable"]);
const CHANGE_KINDS = new Set<SecondBrainRecentChange["kind"]>(["decision", "state", "action", "index", "backup"]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function count(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`${label} must be a non-negative integer`);
  return value as number;
}

function nullableCount(value: unknown, label: string): number | null {
  return value === null ? null : count(value, label);
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error(`${label} must be an ISO timestamp`);
  return value;
}

function rejectUnexpected(value: Record<string, unknown>, allowed: Set<string>, label: string) {
  const unexpected = Object.keys(value).find((key) => !allowed.has(key));
  if (unexpected) throw new Error(`${label} contains unexpected field: ${unexpected}`);
}

export function parseSecondBrainSnapshot(input: unknown): SecondBrainSnapshot {
  const value = record(input, "SecondBrainSnapshot");
  rejectUnexpected(value, SNAPSHOT_FIELDS, "SecondBrainSnapshot");
  if (value.version !== 1) throw new Error("version must be 1");
  if (!BACKUP_STATES.has(value.backupState as SecondBrainBackupState)) throw new Error("backupState is invalid");
  if (!Array.isArray(value.recentChanges) || value.recentChanges.length > 20) throw new Error("recentChanges must contain at most 20 items");
  const recentChanges = value.recentChanges.map((entry, index) => {
    const change = record(entry, `recentChanges[${index}]`);
    rejectUnexpected(change, CHANGE_FIELDS, `recentChanges[${index}]`);
    if (typeof change.project !== "string" || change.project.length === 0 || change.project.length > 120) throw new Error(`recentChanges[${index}].project is invalid`);
    if (!CHANGE_KINDS.has(change.kind as SecondBrainRecentChange["kind"])) throw new Error(`recentChanges[${index}].kind is invalid`);
    return {
      project: change.project,
      kind: change.kind as SecondBrainRecentChange["kind"],
      at: timestamp(change.at, `recentChanges[${index}].at`),
    };
  });
  const indexedProjects = count(value.indexedProjects, "indexedProjects");
  const continuityFilesPresent = count(value.continuityFilesPresent, "continuityFilesPresent");
  const continuityFilesExpected = count(value.continuityFilesExpected, "continuityFilesExpected");
  const staleProjects = count(value.staleProjects, "staleProjects");
  if (continuityFilesPresent > continuityFilesExpected) {
    throw new Error("continuityFilesPresent cannot exceed continuityFilesExpected");
  }
  if (staleProjects > indexedProjects) {
    throw new Error("staleProjects cannot exceed indexedProjects");
  }
  return {
    version: 1,
    observedAt: timestamp(value.observedAt, "observedAt"),
    indexedProjects,
    continuityFilesPresent,
    continuityFilesExpected,
    openActions: nullableCount(value.openActions, "openActions"),
    unresolvedDecisions: nullableCount(value.unresolvedDecisions, "unresolvedDecisions"),
    staleProjects,
    backupState: value.backupState as SecondBrainBackupState,
    recentChanges,
  };
}

export function buildSecondBrainContinuitySummary(
  snapshot: SecondBrainSnapshot,
): SecondBrainContinuitySummary {
  if (snapshot.continuityFilesExpected === 0) {
    return {
      coverage: null,
      label: "file continuity",
      state: "unavailable",
      detail: "Continuity baseline unavailable",
    };
  }

  const coverage = Math.round(
    (snapshot.continuityFilesPresent / snapshot.continuityFilesExpected) * 100,
  );
  const details: string[] = [];
  if (snapshot.staleProjects > 0) {
    details.push(`${snapshot.staleProjects} stale ${snapshot.staleProjects === 1 ? "project" : "projects"}`);
  }
  if (snapshot.backupState !== "verified") details.push(`backup ${snapshot.backupState}`);

  return {
    coverage,
    label: "file continuity",
    state: coverage === 100 && details.length === 0 ? "healthy" : "attention",
    detail: details.length > 0 ? details.join(" · ") : "Backup verified",
  };
}

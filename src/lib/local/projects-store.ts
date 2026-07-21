import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

export type LocalProject = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  type: string | null;
  health_score: number;
  created_at: string;
  updated_at: string;
};

export type CreateProjectInput = {
  name: string;
  description: string | null;
  type: string | null;
};

export type ProjectMutationReceipt = {
  mutationId: string;
  idempotencyKey: string;
  operation: "create";
  projectId: string;
  requestHash: string;
  committedAt: string;
};

type ProjectsDocumentV1 = {
  schemaVersion: 1;
  projects: LocalProject[];
};

type ProjectsDocumentV2 = {
  schemaVersion: 2;
  projects: LocalProject[];
  receipts: ProjectMutationReceipt[];
};

type ProjectsStoreOptions = {
  dataRoot: string;
};

const INITIAL_DOCUMENT: ProjectsDocumentV1 = { schemaVersion: 1, projects: [] };
const DOCUMENT_V1_KEYS = ["schemaVersion", "projects"] as const;
const DOCUMENT_V2_KEYS = ["schemaVersion", "projects", "receipts"] as const;
const PROJECT_KEYS = [
  "id", "name", "description", "status", "type", "health_score", "created_at", "updated_at",
] as const;
const CREATE_INPUT_KEYS = ["name", "description", "type"] as const;
const RECEIPT_KEYS = [
  "mutationId", "idempotencyKey", "operation", "projectId", "requestHash", "committedAt",
] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const MAX_PROJECTS = 10_000;
const MAX_RECEIPTS = 20_000;

export class ProjectsMutationConflictError extends Error {
  constructor() {
    super("Idempotency key was already used for a different project mutation");
    this.name = "ProjectsMutationConflictError";
  }
}

function malformed(reason: string): Error {
  return new Error(`Local projects data is malformed: ${reason}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isBoundedString(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.length >= min && value.length <= max && value.trim() === value;
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function parseProjects(value: unknown): LocalProject[] {
  if (!Array.isArray(value) || value.length > MAX_PROJECTS) throw malformed("invalid projects collection");
  const ids = new Set<string>();
  return value.map((candidate, index) => {
    if (!isRecord(candidate) || !hasExactKeys(candidate, PROJECT_KEYS)) throw malformed(`invalid project fields at index ${index}`);
    if (typeof candidate.id !== "string" || !UUID_PATTERN.test(candidate.id) || ids.has(candidate.id)) {
      throw malformed(`invalid or duplicate project id at index ${index}`);
    }
    if (!isBoundedString(candidate.name, 1, 100)) throw malformed(`invalid project name at index ${index}`);
    if (candidate.description !== null && !isBoundedString(candidate.description, 1, 600)) throw malformed(`invalid project description at index ${index}`);
    if (!isBoundedString(candidate.status, 1, 40)) throw malformed(`invalid project status at index ${index}`);
    if (candidate.type !== null && !isBoundedString(candidate.type, 1, 40)) throw malformed(`invalid project type at index ${index}`);
    if (!Number.isInteger(candidate.health_score) || (candidate.health_score as number) < 0 || (candidate.health_score as number) > 100) {
      throw malformed(`invalid project health at index ${index}`);
    }
    if (!isIsoTimestamp(candidate.created_at) || !isIsoTimestamp(candidate.updated_at)) throw malformed(`invalid project timestamp at index ${index}`);
    ids.add(candidate.id);
    return candidate as LocalProject;
  });
}

export function parseProjectsDocument(value: unknown): ProjectsDocumentV1 {
  if (!isRecord(value) || !hasExactKeys(value, DOCUMENT_V1_KEYS)) throw malformed("invalid document fields");
  if (value.schemaVersion !== 1) throw malformed("unsupported schema version");
  return { schemaVersion: 1, projects: parseProjects(value.projects) };
}

function parseMutationReceipts(value: unknown, projectIds: Set<string>): ProjectMutationReceipt[] {
  if (!Array.isArray(value) || value.length > MAX_RECEIPTS) throw malformed("invalid mutation receipts collection");
  const mutationIds = new Set<string>();
  const idempotencyKeys = new Set<string>();
  return value.map((candidate, index) => {
    if (!isRecord(candidate) || !hasExactKeys(candidate, RECEIPT_KEYS)) throw malformed(`invalid mutation receipt fields at index ${index}`);
    if (typeof candidate.mutationId !== "string" || !UUID_PATTERN.test(candidate.mutationId) || mutationIds.has(candidate.mutationId)) {
      throw malformed(`invalid or duplicate mutation id at index ${index}`);
    }
    if (typeof candidate.idempotencyKey !== "string" || !UUID_PATTERN.test(candidate.idempotencyKey) || idempotencyKeys.has(candidate.idempotencyKey)) {
      throw malformed(`invalid or duplicate idempotency key at index ${index}`);
    }
    if (candidate.operation !== "create") throw malformed(`invalid mutation operation at index ${index}`);
    if (typeof candidate.projectId !== "string" || !projectIds.has(candidate.projectId)) throw malformed(`invalid mutation project at index ${index}`);
    if (typeof candidate.requestHash !== "string" || !SHA256_PATTERN.test(candidate.requestHash)) throw malformed(`invalid mutation request hash at index ${index}`);
    if (!isIsoTimestamp(candidate.committedAt)) throw malformed(`invalid mutation timestamp at index ${index}`);
    mutationIds.add(candidate.mutationId);
    idempotencyKeys.add(candidate.idempotencyKey);
    return candidate as ProjectMutationReceipt;
  });
}

function parseProjectsDocumentV2(value: unknown): ProjectsDocumentV2 {
  if (!isRecord(value) || !hasExactKeys(value, DOCUMENT_V2_KEYS)) throw malformed("invalid v2 document fields");
  if (value.schemaVersion !== 2) throw malformed("unsupported schema version");
  const projects = parseProjects(value.projects);
  const receipts = parseMutationReceipts(value.receipts, new Set(projects.map(({ id }) => id)));
  return { schemaVersion: 2, projects, receipts };
}

export function parseCreateProjectInput(value: unknown): CreateProjectInput {
  if (!isRecord(value) || !hasExactKeys(value, CREATE_INPUT_KEYS)) throw new Error("Local project mutation is malformed");
  if (!isBoundedString(value.name, 1, 100)) throw new Error("Local project mutation is malformed");
  if (value.description !== null && !isBoundedString(value.description, 1, 600)) throw new Error("Local project mutation is malformed");
  if (value.type !== null && !isBoundedString(value.type, 1, 40)) throw new Error("Local project mutation is malformed");
  return value as CreateProjectInput;
}

export function resolveProjectsDataRoot(): string {
  return resolve(process.env.SHAGGY_LOCAL_DATA_ROOT ?? resolve(homedir(), ".shaggy-ai-os", "data"));
}

export function createProjectsStore({ dataRoot }: ProjectsStoreOptions) {
  const root = resolve(dataRoot);
  const v1FilePath = resolve(root, "projects.v1.json");
  const v2FilePath = resolve(root, "projects.v2.json");
  let mutationQueue: Promise<void> = Promise.resolve();

  async function ensureDataRoot(): Promise<void> {
    await mkdir(root, { recursive: true, mode: 0o700 });
    const metadata = await lstat(root);
    if (metadata.isSymbolicLink()) throw new Error("Local projects data root must not be a symbolic link");
    if (!metadata.isDirectory()) throw new Error("Local projects data root must be a directory");
  }

  async function writeAtomic(filePath: string, prefix: string, document: ProjectsDocumentV1 | ProjectsDocumentV2): Promise<void> {
    await ensureDataRoot();
    const temporaryPath = resolve(root, `.${prefix}-${randomUUID()}.tmp`);
    try {
      await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      await rename(temporaryPath, filePath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }

  async function writeV1(document: ProjectsDocumentV1): Promise<void> {
    await writeAtomic(v1FilePath, "projects-v1", parseProjectsDocument(document));
  }

  async function writeV2(document: ProjectsDocumentV2): Promise<void> {
    await writeAtomic(v2FilePath, "projects-v2", parseProjectsDocumentV2(document));
  }

  async function readJson(filePath: string): Promise<unknown> {
    try {
      return JSON.parse(await readFile(filePath, "utf8"));
    } catch (error) {
      if (error instanceof SyntaxError) throw malformed("invalid JSON");
      throw error;
    }
  }

  function isMissing(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
  }

  async function readV1(): Promise<ProjectsDocumentV1> {
    await ensureDataRoot();
    try {
      return parseProjectsDocument(await readJson(v1FilePath));
    } catch (error) {
      if (!isMissing(error)) throw error;
      await writeV1(INITIAL_DOCUMENT);
      return INITIAL_DOCUMENT;
    }
  }

  async function readActiveDocument(): Promise<ProjectsDocumentV2> {
    await ensureDataRoot();
    try {
      return parseProjectsDocumentV2(await readJson(v2FilePath));
    } catch (error) {
      if (!isMissing(error)) throw error;
      const legacy = await readV1();
      return { schemaVersion: 2, projects: legacy.projects, receipts: [] };
    }
  }

  async function runMutation<T>(operation: () => Promise<T>): Promise<T> {
    const previous = mutationQueue;
    let release: () => void = () => {};
    mutationQueue = new Promise<void>((resolveQueue) => { release = resolveQueue; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  return {
    filePath: v1FilePath,
    v2FilePath,
    async readAll(): Promise<LocalProject[]> {
      return (await readActiveDocument()).projects;
    },
    async replaceAll(projects: LocalProject[]): Promise<void> {
      await writeV1({ schemaVersion: 1, projects });
    },
    async create(inputValue: unknown, { idempotencyKey }: { idempotencyKey: string }) {
      const input = parseCreateProjectInput(inputValue);
      if (!UUID_PATTERN.test(idempotencyKey)) throw new Error("Invalid projects idempotency key");
      const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      return runMutation(async () => {
        const document = await readActiveDocument();
        const previousReceipt = document.receipts.find((receipt) => receipt.idempotencyKey === idempotencyKey);
        if (previousReceipt) {
          if (previousReceipt.requestHash !== requestHash) throw new ProjectsMutationConflictError();
          const project = document.projects.find(({ id }) => id === previousReceipt.projectId);
          if (!project) throw malformed("mutation receipt references a missing project");
          return { project, receipt: previousReceipt, replayed: true };
        }

        const timestamp = new Date().toISOString();
        const project: LocalProject = {
          id: randomUUID(),
          name: input.name,
          description: input.description,
          status: "active",
          type: input.type,
          health_score: 0,
          created_at: timestamp,
          updated_at: timestamp,
        };
        const receipt: ProjectMutationReceipt = {
          mutationId: randomUUID(),
          idempotencyKey,
          operation: "create",
          projectId: project.id,
          requestHash,
          committedAt: timestamp,
        };
        await writeV2({
          schemaVersion: 2,
          projects: [...document.projects, project],
          receipts: [...document.receipts, receipt],
        });
        return { project, receipt, replayed: false };
      });
    },
  };
}

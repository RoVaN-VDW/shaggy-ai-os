import { request as httpRequest } from "node:http";
import { lstat } from "node:fs/promises";
import path from "node:path";

import type {
  UsageAlert,
  UsageLedgerEvent,
  UsageProject,
  UsageProvider,
  WorkflowLedgerEvent,
} from "@/features/models-costs/usage-summary";

const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const COLLECTOR_TIMEOUT_MS = 5_000;
const COLLECTOR_SOCKET_PATH = path.join(
  process.env.HOME || process.cwd(),
  "Library", "Application Support", "SHAGGY", "usage", "collector.sock",
);

export type LocalLedgerExport = {
  schema: number;
  generated_at: string;
  source: "local-sqlite:provider_usage";
  provider_usage: UsageLedgerEvent[];
  workflow_events: WorkflowLedgerEvent[];
  providers: UsageProvider[];
  projects: UsageProject[];
  alerts: UsageAlert[];
  provider_quota: { status: "unknown"; remaining: null; source: null };
  truncated: boolean;
};

async function assertPrivateCollectorSocket(): Promise<void> {
  const metadata = await lstat(COLLECTOR_SOCKET_PATH);
  const currentUid = process.getuid?.();
  if (!metadata.isSocket() || currentUid == null || metadata.uid !== currentUid || (metadata.mode & 0o077) !== 0) {
    throw new Error("Local usage collector socket is not a private owner socket");
  }
}

async function collectorJson<T>(requestPath: string, init?: RequestInit): Promise<T> {
  await assertPrivateCollectorSocket();
  const body = typeof init?.body === "string" ? init.body : init?.body == null ? null : String(init.body);
  const headers = Object.fromEntries(new Headers(init?.headers).entries());
  headers.Host = "localhost";
  if (body !== null) headers["Content-Length"] = String(Buffer.byteLength(body));

  const raw = await new Promise<string>((resolve, reject) => {
    const request = httpRequest({
      socketPath: COLLECTOR_SOCKET_PATH,
      path: requestPath,
      method: init?.method ?? "GET",
      headers,
      timeout: COLLECTOR_TIMEOUT_MS,
    }, (response) => {
      const declaredLength = Number(response.headers["content-length"]);
      if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
        response.destroy();
        reject(new Error("Local usage collector response exceeds the allowed size"));
        return;
      }
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buffer.byteLength;
        if (totalBytes > MAX_RESPONSE_BYTES) {
          response.destroy(new Error("Local usage collector response exceeds the allowed size"));
          return;
        }
        chunks.push(buffer);
      });
      response.on("error", reject);
      response.on("end", () => {
        if (response.statusCode == null || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Local usage collector returned HTTP ${response.statusCode ?? "unknown"}`));
          return;
        }
        resolve(Buffer.concat(chunks, totalBytes).toString("utf8"));
      });
    });
    request.on("timeout", () => request.destroy(new Error("Local usage collector timed out")));
    request.on("error", reject);
    if (body !== null) request.write(body);
    request.end();
  });

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("Local usage collector returned malformed JSON");
  }
}

export async function readLocalUsageLedger(days: number): Promise<LocalLedgerExport> {
  const boundedDays = Number.isInteger(days) && days >= 1 && days <= 400 ? days : 30;
  return collectorJson<LocalLedgerExport>(`/api/v1/summary?days=${boundedDays}`);
}

export async function insertLocalProviderUsage(payload: Record<string, unknown>) {
  return collectorJson<{ accepted: boolean; duplicate: boolean }>("/api/v1/usage-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

import {
  parseLocalProvidersSnapshot,
  type LocalProvider,
} from "../local/providers-readplane.ts";

export type LocalProvidersResult = {
  data: LocalProvider[] | null;
  observedAt: string | null;
  error: { message: string } | null;
};

const ENDPOINT = "/api/providers";
const MAX_PUBLIC_ERROR_LENGTH = 240;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message: string): LocalProvidersResult {
  return { data: null, observedAt: null, error: { message } };
}

function publicError(payload: unknown, status: number): string {
  if (isRecord(payload) && typeof payload.error === "string") {
    const message = payload.error.trim();
    if (message.length > 0) return message.slice(0, MAX_PUBLIC_ERROR_LENGTH);
  }
  return `Provider inventory request failed with status ${status}.`;
}

export async function fetchLocalProviders(): Promise<LocalProvidersResult> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch {
    return fail("Provider inventory is unavailable.");
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) return fail(publicError(payload, response.status));
  if (!isRecord(payload) || payload.ok !== true) {
    return fail("Provider inventory response was malformed.");
  }

  try {
    const snapshot = parseLocalProvidersSnapshot({
      schema: 1,
      source: payload.source,
      generated_at: payload.observedAt,
      truncated: payload.truncated,
      providers: payload.providers,
    });
    return { data: snapshot.providers, observedAt: snapshot.observedAt, error: null };
  } catch {
    return fail("Provider inventory response was malformed.");
  }
}

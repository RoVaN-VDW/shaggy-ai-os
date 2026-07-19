import { createHmac } from "node:crypto";

const MAX_SDP_BYTES = 32_768;

export type RealtimeSdpValidationError = {
  status: 400 | 413 | 415;
  error: string;
};

export function validateRealtimeSdp({
  contentType,
  contentLength,
  body,
}: {
  contentType: string | null;
  contentLength: number;
  body: string;
}): RealtimeSdpValidationError | null {
  if (contentType?.split(";", 1)[0]?.trim().toLowerCase() !== "application/sdp") {
    return { status: 415, error: "Expected application/sdp." };
  }

  const actualBytes = new TextEncoder().encode(body).byteLength;
  if (contentLength > MAX_SDP_BYTES || actualBytes > MAX_SDP_BYTES) {
    return { status: 413, error: "SDP offer is too large." };
  }

  if (!body.startsWith("v=0") || !/(?:^|\r?\n)m=audio\s/m.test(body)) {
    return { status: 400, error: "Invalid SDP audio offer." };
  }

  return null;
}

export function buildRealtimeSafetyIdentifier(userId: string, secret: string) {
  return createHmac("sha256", secret).update(userId).digest("hex");
}

export function classifyRealtimeUpstreamError(status: number, payloadText: string) {
  let code = "";
  let type = "";
  try {
    const parsed = JSON.parse(payloadText) as { error?: { code?: unknown; type?: unknown } };
    code = typeof parsed.error?.code === "string" ? parsed.error.code : "";
    type = typeof parsed.error?.type === "string" ? parsed.error.type : "";
  } catch {
    // Provider payloads are never returned verbatim.
  }

  if (status === 429 && (code === "insufficient_quota" || type === "insufficient_quota")) {
    return {
      status: 429 as const,
      category: "quota_or_billing" as const,
      error: "OpenAI API billing or quota is unavailable.",
    };
  }
  if (status === 429) {
    return {
      status: 429 as const,
      category: "rate_limit" as const,
      error: "OpenAI Realtime rate limit reached. Try again shortly.",
    };
  }
  return {
    status: 502 as const,
    category: "provider_error" as const,
    error: "GPT Live session could not be started.",
  };
}

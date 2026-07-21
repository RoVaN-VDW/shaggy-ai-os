import { NextRequest, NextResponse } from "next/server";

import {
  buildRealtimeSessionConfig,
  getRealtimeAvailability,
} from "@/features/voice/realtime-contract";
import {
  buildRealtimeSafetyIdentifier,
  classifyRealtimeUpstreamError,
  validateRealtimeSdp,
} from "@/features/voice/realtime-server-contract";
import { rateLimit } from "@/lib/api/security";
import { requireAuth } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "realtime-session", 5);
  if (limited) return limited;

  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const apiKey = process.env.OPENAI_API_KEY;
  const availability = getRealtimeAvailability({
    enabled: process.env.SHAGGY_REALTIME_ENABLED === "true",
    hasApiKey: Boolean(apiKey),
  });
  if (!availability.available || !apiKey) {
    return NextResponse.json(
      { error: availability.reason === "disabled" ? "GPT Live is disabled." : "GPT Live is not configured." },
      { status: 503 },
    );
  }

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > 32_768) {
    return NextResponse.json({ error: "SDP offer is too large." }, { status: 413 });
  }

  const body = await req.text();
  const sdpError = validateRealtimeSdp({
    contentType: req.headers.get("content-type"),
    contentLength,
    body,
  });
  if (sdpError) {
    return NextResponse.json({ error: sdpError.error }, { status: sdpError.status });
  }

  const url = new URL(req.url);
  const sessionConfig = buildRealtimeSessionConfig({
    voice: url.searchParams.get("voice"),
    language: url.searchParams.get("language"),
  });
  const safetySecret = process.env.SUPABASE_SERVICE_ROLE_KEY || apiKey;
  const safetyIdentifier = buildRealtimeSafetyIdentifier(auth.user.id, safetySecret);
  const form = new FormData();
  form.set("sdp", body);
  form.set("session", JSON.stringify(sessionConfig));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Safety-Identifier": safetyIdentifier,
      },
      body: form,
      signal: controller.signal,
      cache: "no-store",
    });
    const answer = await response.text();
    if (!response.ok) {
      const classified = classifyRealtimeUpstreamError(response.status, answer);
      console.error("Realtime session initialization failed", {
        status: response.status,
        category: classified.category,
      });
      return NextResponse.json({ error: classified.error }, { status: classified.status });
    }
    if (!answer.startsWith("v=0")) {
      console.error("Realtime session initialization returned invalid SDP", { status: response.status });
      return NextResponse.json({ error: "GPT Live session could not be started." }, { status: 502 });
    }

    return new NextResponse(answer, {
      status: 200,
      headers: {
        "Content-Type": "application/sdp",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return NextResponse.json(
      { error: timedOut ? "GPT Live session timed out." : "GPT Live session could not be started." },
      { status: timedOut ? 504 : 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

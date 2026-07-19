import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, requireAuth } from "@/lib/supabase/server";
import {
  getProviderKey,
  getProviderLabel,
  getRuntimeModel,
  normalizeProvider,
} from "@/lib/api/providers";
import { publicError, rateLimit, withTimeout } from "@/lib/api/security";

type HealthCheck = (model: string, key: string, signal: AbortSignal) => Promise<Response>;

const HEALTH_ENDPOINTS: Record<string, HealthCheck> = {
  openai: (_model, key, signal) =>
    fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal,
    }),
  kimi: (_model, key, signal) =>
    fetch("https://api.moonshot.ai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal,
    }),
  gemini: (model, key, signal) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}`, {
      headers: { "x-goog-api-key": key },
      signal,
    }),
  anthropic: (_model, key, signal) =>
    fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      signal,
    }),
};

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "health", 20);
  if (limited) return limited;

  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: providers, error } = await supabaseAdmin
      .from("model_providers")
      .select("id, provider, model, status");

    if (error || !providers) {
      return NextResponse.json({ error: "Provider health data is unavailable." }, { status: 500 });
    }

    const results = await Promise.all(
      providers.map(async (provider) => {
        const providerKey = normalizeProvider(provider.provider);
        const runtimeModel = getRuntimeModel(provider.provider, provider.model);
        const key = getProviderKey(provider.provider);
        const healthFn = providerKey ? HEALTH_ENDPOINTS[providerKey] : undefined;

        let health = "unsupported";
        let latency = 0;
        let checked = false;

        if (healthFn && !key) {
          health = "missing_key";
        } else if (healthFn && key) {
          checked = true;
          const startedAt = Date.now();
          const timeout = withTimeout(15_000);
          try {
            const response = await healthFn(runtimeModel, key, timeout.signal);
            latency = Date.now() - startedAt;
            health = response.ok ? "healthy" : `unhealthy (${response.status})`;
          } catch {
            latency = Date.now() - startedAt;
            health = "error";
          } finally {
            timeout.done();
          }
        }

        const update: { health_status: string; last_seen_at?: string } = {
          health_status: health,
        };
        if (checked) update.last_seen_at = new Date().toISOString();

        const { error: updateError } = await supabaseAdmin
          .from("model_providers")
          .update(update)
          .eq("id", provider.id);

        if (updateError) {
          console.error("Provider health update failed", {
            providerId: provider.id,
            message: updateError.message,
          });
        }

        return {
          id: provider.id,
          provider: getProviderLabel(provider.provider),
          model: runtimeModel,
          health,
          latency,
          status: health === "healthy" ? "active" : "error",
        };
      })
    );

    return NextResponse.json({ ok: true, providers: results });
  } catch (error) {
    console.error("Health check failed", error);
    return NextResponse.json(
      { error: publicError(error, "Health check failed.") },
      { status: 500 }
    );
  }
}

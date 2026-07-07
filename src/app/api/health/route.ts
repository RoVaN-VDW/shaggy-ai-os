import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, requireAuth } from "@/lib/supabase/server";

const HEALTH_ENDPOINTS: Record<string, (model: string, key: string) => Promise<Response>> = {
  openai: async (_model, key) =>
    fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      method: "GET",
    }),
  kimi: async (_model, key) =>
    fetch("https://api.moonshot.cn/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      method: "GET",
    }),
  gemini: async (model, key) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${key}`),
  claude: async (_model, key) =>
    fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    }),
  anthropic: async (_model, key) =>
    fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    }),
  antigravity: async (_model, key) =>
    fetch("https://api.antigravity.co/v1/health", {
      headers: { Authorization: `Bearer ${key}` },
    }),
};

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: providers, error } = await supabaseAdmin
      .from("model_providers")
      .select("id, provider, model, status");

    if (error || !providers) {
      return NextResponse.json({ error: error?.message || "No providers" }, { status: 500 });
    }

    const results = await Promise.all(
      providers.map(async (p) => {
        const providerKey = p.provider.toLowerCase() as keyof typeof HEALTH_ENDPOINTS;
        const key =
          {
            openai: process.env.OPENAI_API_KEY,
            kimi: process.env.KIMI_API_KEY,
            gemini: process.env.GEMINI_API_KEY,
            antigravity: process.env.ANTIGRAVITY_API_KEY,
            claude: process.env.ANTHROPIC_API_KEY,
            anthropic: process.env.ANTHROPIC_API_KEY,
          }[providerKey] ?? undefined;

        const healthFn = HEALTH_ENDPOINTS[providerKey];
        let health = "unknown";
        let latency = 0;

        if (!key) {
          health = "missing_key";
        } else if (healthFn) {
          const start = Date.now();
          try {
            const res = await healthFn(p.model, key);
            latency = Date.now() - start;
            health = res.ok ? "healthy" : `unhealthy (${res.status})`;
          } catch (err) {
            health = `error: ${err instanceof Error ? err.message : "failed"}`;
          }
        } else {
          health = "unsupported";
        }

        const status = health === "healthy" ? "active" : "error";

        await supabaseAdmin
          .from("model_providers")
          .update({ health_status: health, last_seen_at: new Date().toISOString() })
          .eq("id", p.id);

        return {
          id: p.id,
          provider: p.provider,
          model: p.model,
          health,
          latency,
          status,
        };
      })
    );

    return NextResponse.json({ ok: true, providers: results });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

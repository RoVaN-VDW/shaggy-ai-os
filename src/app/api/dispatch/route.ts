import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service role configuration");
  return createClient(url, key);
}

function getProviderKey(provider: string): string | undefined {
  const key =
    {
      openai: process.env.OPENAI_API_KEY,
      kimi: process.env.KIMI_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
      antigravity: process.env.ANTIGRAVITY_API_KEY,
      claude: process.env.ANTHROPIC_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
    }[provider.toLowerCase()] ?? undefined;
  return key;
}

async function dispatchOpenAI(
  model: string,
  apiKey: string,
  prompt: string
): Promise<{ output: string; inputTokens: number; outputTokens: number; cost: number }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });
  const data = (await res.json()) as {
    error?: { message: string };
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  if (!res.ok) throw new Error(data.error?.message || "OpenAI request failed");
  const output = data.choices?.[0]?.message?.content || "(no response)";
  const inputTokens = data.usage?.prompt_tokens ?? Math.ceil(prompt.length / 4);
  const outputTokens = data.usage?.completion_tokens ?? Math.ceil(output.length / 4);
  const cost = inputTokens * 0.000005 + outputTokens * 0.000015;
  return { output, inputTokens, outputTokens, cost };
}

async function dispatchKimi(
  model: string,
  apiKey: string,
  prompt: string
): Promise<{ output: string; inputTokens: number; outputTokens: number; cost: number }> {
  const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });
  const data = (await res.json()) as {
    error?: { message: string };
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  if (!res.ok) throw new Error(data.error?.message || "Kimi request failed");
  const output = data.choices?.[0]?.message?.content || "(no response)";
  const inputTokens = data.usage?.prompt_tokens ?? Math.ceil(prompt.length / 4);
  const outputTokens = data.usage?.completion_tokens ?? Math.ceil(output.length / 4);
  const cost = inputTokens * 0.000003 + outputTokens * 0.000009;
  return { output, inputTokens, outputTokens, cost };
}

async function dispatchGemini(
  model: string,
  apiKey: string,
  prompt: string
): Promise<{ output: string; inputTokens: number; outputTokens: number; cost: number }> {
  const modelName = model.startsWith("gemini-") ? model : "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });
  const data = (await res.json()) as {
    error?: { message: string };
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  if (!res.ok) throw new Error(data.error?.message || "Gemini request failed");
  const output = data.candidates?.[0]?.content?.parts?.[0]?.text || "(no response)";
  const inputTokens = data.usageMetadata?.promptTokenCount ?? Math.ceil(prompt.length / 4);
  const outputTokens = data.usageMetadata?.candidatesTokenCount ?? Math.ceil(output.length / 4);
  const cost = inputTokens * 0.0000005 + outputTokens * 0.0000015;
  return { output, inputTokens, outputTokens, cost };
}

async function dispatchClaude(
  model: string,
  apiKey: string,
  prompt: string
): Promise<{ output: string; inputTokens: number; outputTokens: number; cost: number }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = (await res.json()) as {
    error?: { message?: string };
    content?: { text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  if (!res.ok) throw new Error(data.error?.message || "Claude request failed");
  const output = data.content?.[0]?.text || "(no response)";
  const inputTokens = data.usage?.input_tokens ?? Math.ceil(prompt.length / 4);
  const outputTokens = data.usage?.output_tokens ?? Math.ceil(output.length / 4);
  const cost = inputTokens * 0.000003 + outputTokens * 0.000015;
  return { output, inputTokens, outputTokens, cost };
}

async function dispatchAntigravity(
  model: string,
  apiKey: string,
  prompt: string
): Promise<{ output: string; inputTokens: number; outputTokens: number; cost: number }> {
  const res = await fetch("https://api.antigravity.co/v1/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, prompt, temperature: 0.7 }),
  });
  const data = (await res.json()) as {
    error?: { message?: string };
    text?: string;
    completion?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  if (!res.ok) throw new Error(data.error?.message || "Antigravity request failed");
  const output = data.text ?? data.completion ?? "(no response)";
  const inputTokens = data.usage?.prompt_tokens ?? Math.ceil(prompt.length / 4);
  const outputTokens = data.usage?.completion_tokens ?? Math.ceil(output.length / 4);
  const cost = inputTokens * 0.000001 + outputTokens * 0.000005;
  return { output, inputTokens, outputTokens, cost };
}

async function dispatchProvider(
  provider: string,
  model: string,
  apiKey: string,
  prompt: string
): Promise<{ output: string; inputTokens: number; outputTokens: number; cost: number }> {
  const p = provider.toLowerCase();
  if (p === "openai") return dispatchOpenAI(model, apiKey, prompt);
  if (p === "kimi") return dispatchKimi(model, apiKey, prompt);
  if (p === "gemini") return dispatchGemini(model, apiKey, prompt);
  if (p === "claude" || p === "anthropic") return dispatchClaude(model, apiKey, prompt);
  if (p === "antigravity") return dispatchAntigravity(model, apiKey, prompt);
  throw new Error(`Unsupported provider: ${provider}`);
}

export async function POST(req: NextRequest) {
  try {
    const { providerId, projectId, prompt } = (await req.json()) as {
      providerId: string;
      projectId?: string | null;
      prompt: string;
    };

    if (!providerId || !prompt.trim()) {
      return NextResponse.json({ error: "Missing provider or prompt" }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();
    const { data: provider, error: providerError } = await supabaseAdmin
      .from("model_providers")
      .select("id, provider, model, status")
      .eq("id", providerId)
      .single();

    if (providerError || !provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const apiKey = getProviderKey(provider.provider);
    if (!apiKey) {
      return NextResponse.json(
        { error: `No API key configured for ${provider.provider}` },
        { status: 400 }
      );
    }

    const start = Date.now();
    const { output, inputTokens, outputTokens, cost } = await dispatchProvider(
      provider.provider,
      provider.model,
      apiKey,
      prompt
    );
    const latency = Date.now() - start;

    await Promise.all([
      supabaseAdmin.from("agent_activity").insert({
        agent: provider.provider,
        action: `Dispatched to ${provider.model}`,
        status: "success",
        project_id: projectId || null,
        metadata: { provider: provider.provider, model: provider.model, prompt_length: prompt.length },
      }),
      supabaseAdmin.from("usage_events").insert({
        provider: provider.provider,
        model: provider.model,
        project_id: projectId || null,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_estimate: cost,
        latency_ms: latency,
        status: "success",
      }),
    ]);

    return NextResponse.json({ ok: true, output });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown dispatch error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service role configuration");
  return createClient(url, key);
}

function getProviderKey(provider: string): string | undefined {
  return {
    openai: process.env.OPENAI_API_KEY,
    kimi: process.env.KIMI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    antigravity: process.env.ANTIGRAVITY_API_KEY,
    claude: process.env.ANTHROPIC_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
  }[provider.toLowerCase()];
}

async function dispatchProvider(
  provider: string,
  model: string,
  apiKey: string,
  prompt: string
): Promise<{ output: string; inputTokens: number; outputTokens: number; cost: number }> {
  const p = provider.toLowerCase();

  if (p === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.7 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "OpenAI request failed");
    const output = data.choices?.[0]?.message?.content || "(no response)";
    const inputTokens = data.usage?.prompt_tokens ?? Math.ceil(prompt.length / 4);
    const outputTokens = data.usage?.completion_tokens ?? Math.ceil(output.length / 4);
    return { output, inputTokens, outputTokens, cost: inputTokens * 5e-6 + outputTokens * 15e-6 };
  }

  if (p === "kimi") {
    const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.7 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Kimi request failed");
    const output = data.choices?.[0]?.message?.content || "(no response)";
    const inputTokens = data.usage?.prompt_tokens ?? Math.ceil(prompt.length / 4);
    const outputTokens = data.usage?.completion_tokens ?? Math.ceil(output.length / 4);
    return { output, inputTokens, outputTokens, cost: inputTokens * 3e-6 + outputTokens * 9e-6 };
  }

  if (p === "gemini") {
    const modelName = model.startsWith("gemini-") ? model : "gemini-1.5-flash";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Gemini request failed");
    const output = data.candidates?.[0]?.content?.parts?.[0]?.text || "(no response)";
    const inputTokens = data.usageMetadata?.promptTokenCount ?? Math.ceil(prompt.length / 4);
    const outputTokens = data.usageMetadata?.candidatesTokenCount ?? Math.ceil(output.length / 4);
    return { output, inputTokens, outputTokens, cost: inputTokens * 5e-7 + outputTokens * 15e-7 };
  }

  if (p === "claude" || p === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Claude request failed");
    const output = data.content?.[0]?.text || "(no response)";
    const inputTokens = data.usage?.input_tokens ?? Math.ceil(prompt.length / 4);
    const outputTokens = data.usage?.output_tokens ?? Math.ceil(output.length / 4);
    return { output, inputTokens, outputTokens, cost: inputTokens * 3e-6 + outputTokens * 15e-6 };
  }

  if (p === "antigravity") {
    const res = await fetch("https://api.antigravity.co/v1/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, prompt, temperature: 0.7 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Antigravity request failed");
    const output = data.text ?? data.completion ?? "(no response)";
    const inputTokens = data.usage?.prompt_tokens ?? Math.ceil(prompt.length / 4);
    const outputTokens = data.usage?.completion_tokens ?? Math.ceil(output.length / 4);
    return { output, inputTokens, outputTokens, cost: inputTokens * 1e-6 + outputTokens * 5e-6 };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

export async function POST(req: NextRequest) {
  try {
    const { providerId, projectId, prompt, useRag } = (await req.json()) as {
      providerId: string;
      projectId?: string | null;
      prompt: string;
      useRag?: boolean;
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

    if (provider.status !== "active") {
      return NextResponse.json({ error: "Provider is not active" }, { status: 400 });
    }

    const apiKey = getProviderKey(provider.provider);
    if (!apiKey) {
      return NextResponse.json({ error: `No API key configured for ${provider.provider}` }, { status: 400 });
    }

    let finalPrompt = prompt;
    let citations: string[] = [];

    if (useRag) {
      const { data: docs } = await supabaseAdmin
        .from("knowledge_docs")
        .select("id, name, content_preview")
        .eq("embedding_status", "indexed")
        .limit(5);

      if (docs && docs.length > 0) {
        const context = docs.map((d) => `Document: ${d.name}\n${d.content_preview || ""}`).join("\n\n---\n\n");
        finalPrompt = `Use the following knowledge base context to answer the question. If the context does not contain the answer, say so.\n\nContext:\n${context}\n\nQuestion: ${prompt}`;
        citations = docs.map((d) => d.name);
      }
    }

    const start = Date.now();
    const { output, inputTokens, outputTokens, cost } = await dispatchProvider(
      provider.provider,
      provider.model,
      apiKey,
      finalPrompt
    );
    const latency = Date.now() - start;

    await Promise.all([
      supabaseAdmin.from("agent_activity").insert({
        agent: provider.provider,
        action: `Chat via ${provider.model}`,
        status: "success",
        project_id: projectId || null,
        metadata: { provider: provider.provider, model: provider.model, prompt_length: prompt.length, rag: !!useRag },
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

    return NextResponse.json({ ok: true, output, citations });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown chat error" }, { status: 500 });
  }
}

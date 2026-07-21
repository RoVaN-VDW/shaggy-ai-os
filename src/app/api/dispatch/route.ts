import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, requireAuth } from "@/lib/supabase/server";
import { getProviderKey, getProviderLabel, getRuntimeModel, normalizeProvider } from "@/lib/api/providers";
import {
  publicError,
  rateLimit,
  validateJsonSize,
  validateOptionalUuid,
  validatePrompt,
  withTimeout,
} from "@/lib/api/security";

export const maxDuration = 300;

async function dispatchOpenAI(
  model: string,
  apiKey: string,
  prompt: string
): Promise<{ output: string; inputTokens: number; outputTokens: number; cost: number }> {
  const timeout = withTimeout();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.7 }),
    signal: timeout.signal,
  });
  timeout.done();
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "OpenAI request failed");
  const output = data.choices?.[0]?.message?.content || "(no response)";
  const inputTokens = data.usage?.prompt_tokens ?? Math.ceil(prompt.length / 4);
  const outputTokens = data.usage?.completion_tokens ?? Math.ceil(output.length / 4);
  return { output, inputTokens, outputTokens, cost: inputTokens * 0.000005 + outputTokens * 0.000015 };
}

async function dispatchKimi(
  model: string,
  apiKey: string,
  prompt: string
): Promise<{ output: string; inputTokens: number; outputTokens: number; cost: number }> {
  const timeout = withTimeout();
  const res = await fetch("https://api.moonshot.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      thinking: { type: "disabled" },
      max_tokens: 4096,
    }),
    signal: timeout.signal,
  });
  timeout.done();
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Kimi request failed");
  const output = data.choices?.[0]?.message?.content || "(no response)";
  const inputTokens = data.usage?.prompt_tokens ?? Math.ceil(prompt.length / 4);
  const outputTokens = data.usage?.completion_tokens ?? Math.ceil(output.length / 4);
  return { output, inputTokens, outputTokens, cost: inputTokens * 0.000003 + outputTokens * 0.000009 };
}

async function dispatchGemini(
  model: string,
  apiKey: string,
  prompt: string
): Promise<{ output: string; inputTokens: number; outputTokens: number; cost: number }> {
  const timeout = withTimeout();
  const modelName = getRuntimeModel("gemini", model);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
    signal: timeout.signal,
  });
  timeout.done();
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Gemini request failed");
  const output = data.candidates?.[0]?.content?.parts?.[0]?.text || "(no response)";
  const inputTokens = data.usageMetadata?.promptTokenCount ?? Math.ceil(prompt.length / 4);
  const outputTokens = data.usageMetadata?.candidatesTokenCount ?? Math.ceil(output.length / 4);
  return { output, inputTokens, outputTokens, cost: inputTokens * 0.0000005 + outputTokens * 0.0000015 };
}

async function dispatchClaude(
  model: string,
  apiKey: string,
  prompt: string
): Promise<{ output: string; inputTokens: number; outputTokens: number; cost: number }> {
  const timeout = withTimeout();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: "user", content: prompt }] }),
    signal: timeout.signal,
  });
  timeout.done();
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Claude request failed");
  const output = data.content?.[0]?.text || "(no response)";
  const inputTokens = data.usage?.input_tokens ?? Math.ceil(prompt.length / 4);
  const outputTokens = data.usage?.output_tokens ?? Math.ceil(output.length / 4);
  return { output, inputTokens, outputTokens, cost: inputTokens * 0.000003 + outputTokens * 0.000015 };
}

async function dispatchAntigravity(
  model: string,
  apiKey: string,
  prompt: string
): Promise<{ output: string; inputTokens: number; outputTokens: number; cost: number }> {
  const timeout = withTimeout(300_000);
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      agent: model,
      input: prompt,
      environment: "remote",
    }),
    signal: timeout.signal,
  });
  timeout.done();
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Antigravity request failed");
  const output = data.output_text ?? data.outputText ?? data.response?.output_text ?? "(no response)";
  const inputTokens = data.usageMetadata?.promptTokenCount ?? Math.ceil(prompt.length / 4);
  const outputTokens = data.usageMetadata?.candidatesTokenCount ?? Math.ceil(output.length / 4);
  return { output, inputTokens, outputTokens, cost: inputTokens * 0.000001 + outputTokens * 0.000005 };
}

async function dispatchProvider(
  provider: string,
  model: string,
  apiKey: string,
  prompt: string
): Promise<{ output: string; inputTokens: number; outputTokens: number; cost: number }> {
  const p = normalizeProvider(provider);
  if (p === "openai") return dispatchOpenAI(model, apiKey, prompt);
  if (p === "kimi") return dispatchKimi(model, apiKey, prompt);
  if (p === "gemini") return dispatchGemini(model, apiKey, prompt);
  if (p === "anthropic") return dispatchClaude(model, apiKey, prompt);
  if (p === "antigravity") return dispatchAntigravity(model, apiKey, prompt);
  throw new Error(`Unsupported provider: ${provider}`);
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "dispatch", 12);
  if (limited) return limited;

  const tooLarge = validateJsonSize(req);
  if (tooLarge) return tooLarge;

  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const { providerId, projectId, prompt } = (await req.json()) as {
      providerId: string;
      projectId?: string | null;
      prompt: string;
    };

    const promptError = validatePrompt(prompt);
    const projectError = validateOptionalUuid(projectId);
    if (!providerId || promptError || projectError) {
      return NextResponse.json({ error: promptError || projectError || "Missing provider" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
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

    const runtimeModel = getRuntimeModel(provider.provider, provider.model);
    const apiKey = getProviderKey(provider.provider);
    if (!apiKey) {
      return NextResponse.json({ error: `No API key configured for ${provider.provider}` }, { status: 400 });
    }

    const start = Date.now();
    const { output, inputTokens, outputTokens, cost } = await dispatchProvider(
      provider.provider,
      runtimeModel,
      apiKey,
      prompt
    );
    const latency = Date.now() - start;

    const [activityResult, usageResult] = await Promise.all([
      supabaseAdmin.from("agent_activity").insert({
        agent: provider.provider,
        action: `Dispatched to ${runtimeModel}`,
        status: "success",
        project_id: projectId || null,
        metadata: { provider: getProviderLabel(provider.provider), model: runtimeModel, prompt_length: prompt.length },
      }),
      supabaseAdmin.from("usage_events").insert({
        provider: getProviderLabel(provider.provider),
        model: runtimeModel,
        project_id: projectId || null,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_estimate: cost,
        latency_ms: latency,
        status: "success",
      }),
    ]);
    const warnings: string[] = [];
    const activityError = activityResult.error;
    const usageError = usageResult.error;
    if (activityError) warnings.push("Agent activity could not be recorded.");
    if (usageError) warnings.push("Usage and cost could not be recorded.");
    if (warnings.length) console.error("Dispatch persistence incomplete", { warnings });

    return NextResponse.json({
      ok: true,
      output,
      persistence: warnings.length ? "partial" : "complete",
      warnings,
    });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "Dispatch failed.") }, { status: 500 });
  }
}

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
import OpenAI from "openai";

export const maxDuration = 300;

async function getEmbedding(text: string): Promise<number[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await openai.embeddings.create({ model: "text-embedding-3-small", input: text });
  return res.data[0].embedding;
}

async function dispatchProvider(
  provider: string,
  model: string,
  apiKey: string,
  prompt: string
): Promise<{ output: string; inputTokens: number; outputTokens: number; cost: number }> {
  const p = normalizeProvider(provider);

  if (p === "openai") {
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
    return { output, inputTokens, outputTokens, cost: inputTokens * 5e-6 + outputTokens * 15e-6 };
  }

  if (p === "kimi") {
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
    return { output, inputTokens, outputTokens, cost: inputTokens * 3e-6 + outputTokens * 9e-6 };
  }

  if (p === "gemini") {
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
    return { output, inputTokens, outputTokens, cost: inputTokens * 5e-7 + outputTokens * 15e-7 };
  }

  if (p === "anthropic") {
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
    return { output, inputTokens, outputTokens, cost: inputTokens * 3e-6 + outputTokens * 15e-6 };
  }

  if (p === "antigravity") {
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
    return { output, inputTokens, outputTokens, cost: inputTokens * 1e-6 + outputTokens * 5e-6 };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "chat", 12);
  if (limited) return limited;

  const tooLarge = validateJsonSize(req);
  if (tooLarge) return tooLarge;

  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const { providerId, projectId, prompt, useRag, sessionId } = (await req.json()) as {
      providerId: string;
      projectId?: string | null;
      prompt: string;
      useRag?: boolean;
      sessionId?: string | null;
    };

    const promptError = validatePrompt(prompt);
    const projectError = validateOptionalUuid(projectId);
    const sessionError = validateOptionalUuid(sessionId, "session id");
    if (!providerId || promptError || projectError || sessionError) {
      return NextResponse.json({ error: promptError || projectError || sessionError || "Missing provider" }, { status: 400 });
    }

    if (sessionId) {
      const { data: ownedSession, error: sessionLookupError } = await auth.client
        .from("chat_sessions")
        .select("id")
        .eq("id", sessionId)
        .maybeSingle();
      if (sessionLookupError || !ownedSession) {
        return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
      }
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

    let finalPrompt = prompt;
    let citations: string[] = [];

    if (useRag) {
      let context = "";
      try {
        const embedding = await getEmbedding(prompt);
        const { data: chunks } = await supabaseAdmin.rpc("match_knowledge_chunks", {
          query_embedding: embedding,
          match_threshold: 0.5,
          match_count: 5,
          p_project_id: projectId || null,
        });

        if (chunks && chunks.length > 0) {
          const { data: docNames } = await supabaseAdmin
            .from("knowledge_docs")
            .select("id, name")
            .in(
              "id",
              chunks.map((c: { doc_id: string }) => c.doc_id)
            );
          const nameMap = new Map(docNames?.map((d) => [d.id, d.name]) || []);
          context = chunks
            .map((c: { doc_id: string; chunk_index: number; content: string; similarity: number }) =>
              `Document: ${nameMap.get(c.doc_id) || c.doc_id}\nChunk ${c.chunk_index}\n${c.content}`
            )
            .join("\n\n---\n\n");
          citations = [...new Set(chunks.map((c: { doc_id: string }) => nameMap.get(c.doc_id) || c.doc_id))] as string[];
        }
      } catch (e) {
        console.error("RAG retrieval failed", e);
      }

      if (context) {
        finalPrompt = `Use the following knowledge base context to answer the question. If the context does not contain the answer, say so. Cite the relevant documents.\n\nContext:\n${context}\n\nQuestion: ${prompt}`;
      }
    }

    const start = Date.now();
    const { output, inputTokens, outputTokens, cost } = await dispatchProvider(
      provider.provider,
      runtimeModel,
      apiKey,
      finalPrompt
    );
    const latency = Date.now() - start;

    const [activityResult, usageResult] = await Promise.all([
      supabaseAdmin.from("agent_activity").insert({
        agent: provider.provider,
        action: `Chat via ${runtimeModel}`,
        status: "success",
        project_id: projectId || null,
        metadata: {
          provider: getProviderLabel(provider.provider),
          model: runtimeModel,
          prompt_length: prompt.length,
          rag: !!useRag,
        },
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

    if (sessionId) {
      const { error: messagesError } = await auth.client.from("chat_messages").insert([
          { session_id: sessionId, role: "user", content: prompt, metadata: { rag: !!useRag } },
          { session_id: sessionId, role: "assistant", content: output, metadata: { provider: provider?.provider, model: runtimeModel, citations } },
      ]);
      if (messagesError) {
        warnings.push("Conversation messages could not be saved.");
      } else {
        const { error: sessionUpdateError } = await auth.client
          .from("chat_sessions")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", sessionId);
        if (sessionUpdateError) warnings.push("Conversation timestamp could not be updated.");
      }
    }

    if (warnings.length) console.error("Chat persistence incomplete", { warnings });
    return NextResponse.json({
      ok: true,
      output,
      citations,
      persistence: warnings.length ? "partial" : "complete",
      warnings,
    });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "Chat failed.") }, { status: 500 });
  }
}
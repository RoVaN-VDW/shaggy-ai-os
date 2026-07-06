import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function POST(req: NextRequest) {
  try {
    const { providerId, projectId, prompt } = (await req.json()) as {
      providerId: string;
      projectId?: string;
      prompt: string;
    };

    if (!providerId || !prompt.trim()) {
      return NextResponse.json({ error: "Missing provider or prompt" }, { status: 400 });
    }

    const { data: provider, error: providerError } = await supabase
      .from("model_providers")
      .select("provider, model")
      .eq("id", providerId)
      .single();

    if (providerError || !provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    // Placeholder: simulate a model dispatch with latency and token estimation
    const latency = Math.floor(Math.random() * 1200) + 200;
    const inputTokens = Math.floor(prompt.length / 4);
    const outputTokens = Math.floor(Math.random() * 500) + 100;
    const costEstimate = (inputTokens + outputTokens) * 0.00001;

    const { error: activityError } = await supabase.from("agent_activity").insert({
      agent: provider.provider,
      action: `Dispatched prompt to ${provider.model}`,
      status: "success",
      project_id: projectId || null,
      metadata: { provider: provider.provider, model: provider.model, prompt_length: prompt.length },
    });

    if (activityError) {
      return NextResponse.json({ error: activityError.message }, { status: 500 });
    }

    const { error: usageError } = await supabase.from("usage_events").insert({
      provider: provider.provider,
      model: provider.model,
      project_id: projectId || null,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_estimate: costEstimate,
      latency_ms: latency,
      status: "success",
    });

    if (usageError) {
      return NextResponse.json({ error: usageError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      output: `[${provider.provider} :: ${provider.model}]\n\nSimulated response to: "${prompt.slice(0, 80)}${prompt.length > 80 ? "..." : ""}"\n\nTokens: ${inputTokens} in / ${outputTokens} out | Cost: $${costEstimate.toFixed(4)} | Latency: ${latency}ms`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown dispatch error" },
      { status: 500 }
    );
  }
}

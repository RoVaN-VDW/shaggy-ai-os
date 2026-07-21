type ProviderKey = "openai" | "kimi" | "gemini" | "anthropic" | "antigravity";

export function normalizeProvider(provider: string): ProviderKey | null {
  const value = provider.toLowerCase();

  if (value.includes("openai") || value.includes("codex")) return "openai";
  if (value.includes("kimi") || value.includes("moonshot")) return "kimi";
  if (value.includes("gemini") || value.includes("google")) return "gemini";
  if (value.includes("claude") || value.includes("anthropic")) return "anthropic";
  if (value.includes("antigravity")) return "antigravity";

  return null;
}

export function getProviderKey(provider: string): string | undefined {
  const normalized = normalizeProvider(provider);
  if (!normalized) return undefined;

  return {
    openai: process.env.OPENAI_API_KEY,
    kimi: process.env.KIMI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    antigravity: process.env.ANTIGRAVITY_API_KEY || process.env.GEMINI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
  }[normalized];
}

export function getRuntimeModel(provider: string, model: string) {
  const normalized = normalizeProvider(provider);

  if (normalized === "kimi") return "kimi-k2.6";
  if (normalized === "gemini") return model.startsWith("gemini-") ? model : "gemini-1.5-flash";
  if (normalized === "openai" && model === "gpt-5-codex") return "gpt-5.5";
  if (normalized === "antigravity") return "antigravity-preview-05-2026";

  return model;
}

export function getProviderLabel(provider: string) {
  return normalizeProvider(provider) ?? provider.toLowerCase();
}

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioLines, Search, Sparkles } from "lucide-react";
import { PRIMARY_NAV_ITEMS } from "../shell-contract";

export function GlobalCommand() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim().toLowerCase();
    if (!normalized) return;
    const destination = PRIMARY_NAV_ITEMS.find(
      (item) => item.enabled && item.label.toLowerCase().includes(normalized),
    );
    if (destination?.href) {
      setFeedback(null);
      router.push(destination.href);
      return;
    }
    setFeedback("Command orchestration is not connected yet. Try a workspace name.");
  }

  return (
    <div className="relative h-full" data-dream-region="global-command">
      <form className="dream-command-surface flex h-full items-center gap-3 px-4" onSubmit={submit} role="search">
        <div className="grid size-8 shrink-0 place-items-center rounded-full border border-[color-mix(in_srgb,var(--dream-cyan)_42%,transparent)] bg-[color-mix(in_srgb,var(--dream-cyan)_10%,transparent)] shadow-[var(--dream-glow-cyan)]">
          <Sparkles className="size-4 text-[var(--dream-cyan-hot)]" aria-hidden="true" />
        </div>
        <Search className="size-4 shrink-0 text-[var(--dream-muted)]" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setFeedback(null); }}
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--dream-text)] outline-none placeholder:text-[var(--dream-muted)]"
          placeholder="Ask S.H.A.G.G.Y. anything or give a command…"
          aria-label="Ask SHAGGY or navigate to a workspace"
        />
        <span id="dream-command-voice-status" className="dream-command-voice-status" role="status">
          <AudioLines className="size-4 shrink-0" aria-hidden="true" />
          Voice input unavailable
        </span>
      </form>
      {feedback && <div role="status" className="absolute left-4 top-[calc(100%+6px)] z-50 rounded-lg border border-[var(--dream-glass-stroke)] bg-[var(--dream-glass-fill-strong)] px-3 py-2 text-xs text-[var(--dream-muted)] shadow-xl">{feedback}</div>}
    </div>
  );
}
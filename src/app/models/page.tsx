"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Boxes, RefreshCcw } from "lucide-react";
import { TokenCurrentCockpit } from "@/features/models-costs/token-current-cockpit";
import type { UsageSummary } from "@/features/models-costs/usage-summary";

const PERIODS = [
  { label: "24H", days: 1 },
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
] as const;

function isErrorPayload(payload: UsageSummary | { error?: string }): payload is { error?: string } {
  return "error" in payload;
}

export default function ModelsCostsPage() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const streamStatus = "polling" as const;

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/llm/usage/summary?days=${days}`, { cache: "no-store" });
      const payload = await response.json() as UsageSummary | { error?: string };
      if (isErrorPayload(payload)) throw new Error(payload.error || "Usage summary unavailable.");
      if (!response.ok) throw new Error("Usage summary unavailable.");
      setSummary(payload);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Usage summary unavailable.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    const initialFetch = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(true), 15_000);
    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(interval);
    };
  }, [load]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden" aria-busy={loading}>
      <header className="flex shrink-0 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl border border-[color-mix(in_srgb,var(--dream-cyan)_35%,transparent)] bg-[color-mix(in_srgb,var(--dream-cyan)_8%,transparent)] shadow-[0_0_24px_rgba(0,212,255,.08)]">
            <Boxes className="size-4 text-[var(--dream-cyan-hot)]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[24px] font-semibold tracking-[-.03em] text-[var(--dream-text)]">Token Intelligence</h1>
              <span className="rounded-full border border-[color-mix(in_srgb,var(--dream-cyan)_25%,transparent)] px-2 py-0.5 text-[13px] font-semibold uppercase tracking-[.12em] text-[var(--dream-cyan-hot)]">Token Current</span>
            </div>
            <p className="truncate text-[15px] text-[var(--dream-subtle)]">Realtime recorded usage · truthful capacity · provenance per model</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex rounded-lg border border-[var(--dream-glass-stroke)] bg-black/20 p-0.5" role="group" aria-label="Usage period">
            {PERIODS.map((period) => (
              <button
                key={period.days}
                type="button"
                onClick={() => setDays(period.days)}
                aria-pressed={days === period.days}
                className={`h-9 rounded-md px-3 text-[15px] font-semibold transition-colors motion-reduce:transition-none ${days === period.days ? "bg-[color-mix(in_srgb,var(--dream-cyan)_16%,transparent)] text-[var(--dream-cyan-hot)]" : "text-[var(--dream-muted)] hover:text-[var(--dream-text)]"}`}
              >
                {period.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void load()} className="grid size-9 place-items-center rounded-lg border border-[var(--dream-glass-stroke)] text-[var(--dream-muted)] hover:text-[var(--dream-cyan-hot)]" title="Refresh ledger">
            <RefreshCcw className={`size-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} />
          </button>
        </div>
      </header>

      {error && <div role="alert" className="flex shrink-0 items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--dream-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--dream-danger)_8%,transparent)] px-3 py-2 text-[14px] text-[var(--dream-danger)]"><AlertTriangle className="size-4" />{error}</div>}
      {summary && summary.alerts.length > 0 && <div role="status" className="flex shrink-0 items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--dream-gold)_35%,transparent)] bg-[color-mix(in_srgb,var(--dream-gold)_7%,transparent)] px-3 py-2 text-[14px] text-[var(--dream-gold-hot)]"><AlertTriangle className="size-4" />{summary.alerts.length} usage-alert{summary.alerts.length === 1 ? "" : "s"} · {summary.alerts[0].message}</div>}
      {summary?.truncated && <div role="status" className="shrink-0 rounded-lg border border-[color-mix(in_srgb,var(--dream-gold)_35%,transparent)] px-3 py-2 text-[14px] text-[var(--dream-gold-hot)]">Gedeeltelijke weergave: deze periode overschreed de 10.000-event safety cap.</div>}

      {summary ? (
        <TokenCurrentCockpit summary={summary} streamStatus={streamStatus} />
      ) : (
        <section className="dream-glass-panel grid min-h-0 flex-1 place-items-center rounded-xl text-[15px] text-[var(--dream-muted)]">
          {loading ? "Token currents laden…" : "Geen usage summary beschikbaar."}
        </section>
      )}
    </div>
  );
}
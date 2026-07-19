"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity, AlertTriangle, Boxes, CircleDollarSign, Clock3, Database,
  Gauge, RefreshCcw, Router, ShieldCheck, Sigma, WalletCards,
} from "lucide-react";
import { fetchWithAuth, supabase } from "@/lib/supabase/client";
import type { UsageSummary } from "@/features/models-costs/usage-summary";

const PERIODS = [
  { label: "24H", days: 1 },
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
] as const;
const PROVIDER_COLORS = ["#00d4ff", "#f0b429", "#a78bfa", "#fb7185", "#46e6a4", "#60a5fa"];

function compact(value: number | null | undefined) {
  return value == null ? "Unavailable" : new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function currency(value: number | null | undefined, digits = 2) {
  return value == null ? "Unavailable" : new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function percent(value: number | null | undefined) {
  return value == null ? "Unavailable" : `${value.toFixed(1)}%`;
}

function age(iso: string | null | undefined) {
  if (!iso) return "Not observed";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function resetDate(iso: string | null | undefined) {
  if (!iso) return "No reset";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso));
}

function Trend({ summary }: { summary: UsageSummary }) {
  const points = summary.trend;
  if (points.length === 0) return <div className="flex h-full items-center justify-center text-sm text-[var(--dream-subtle)]">No recorded events in this period.</div>;
  const width = 760;
  const height = 180;
  const maximum = Math.max(...points.map((point) => point.costEstimate), 0.000001);
  const denominator = Math.max(points.length - 1, 1);
  const coordinates = points.map((point, index) => ({
    ...point,
    x: (index / denominator) * width,
    y: height - 16 - (point.costEstimate / maximum) * (height - 34),
  }));
  const line = coordinates.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `M0,${height} ${line.replace(/^M/, "L")} L${width},${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Recorded cost trend">
      <defs><linearGradient id="models-cost-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#00d4ff" stopOpacity=".3" /><stop offset="1" stopColor="#00d4ff" stopOpacity="0" /></linearGradient></defs>
      {[38, 78, 118, 158].map((y) => <line key={y} x1="0" x2={width} y1={y} y2={y} stroke="rgba(95,146,164,.18)" />)}
      <path d={area} fill="url(#models-cost-area)" />
      <path d={line} fill="none" stroke="#00d4ff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {coordinates.map((point) => <circle key={point.day} cx={point.x} cy={point.y} r="3" fill="#03080b" stroke="#00d4ff"><title>{point.day}: {currency(point.costEstimate, 4)} · {compact(point.tokens)} tokens</title></circle>)}
    </svg>
  );
}

function Metric({ label, value, detail, icon: Icon, tone = "cyan" }: { label: string; value: string; detail: string; icon: typeof Activity; tone?: "cyan" | "gold" | "green" | "muted" }) {
  const colors = { cyan: "text-[var(--dream-cyan-hot)]", gold: "text-[var(--dream-gold-hot)]", green: "text-[var(--dream-success)]", muted: "text-[var(--dream-muted)]" };
  return <section className="dream-glass-panel flex min-w-0 flex-col justify-between rounded-xl p-3.5"><div className="flex items-center justify-between text-[15px] font-semibold uppercase tracking-[.12em] text-[var(--dream-subtle)]"><span>{label}</span><Icon className={`size-3.5 ${colors[tone]}`} /></div><strong className="truncate text-[32px] font-semibold tracking-[-.04em] text-[var(--dream-text)]">{value}</strong><small className="truncate text-[15px] text-[var(--dream-muted)]">{detail}</small></section>;
}

function isErrorPayload(payload: UsageSummary | { error?: string }): payload is { error?: string } {
  return "error" in payload;
}

export default function ModelsCostsPage() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [streamStatus, setStreamStatus] = useState<"connecting" | "realtime" | "polling">("connecting");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/llm/usage/summary?days=${days}`, { cache: "no-store" });
      const payload = await response.json() as UsageSummary | { error?: string };
      if (isErrorPayload(payload)) {
        throw new Error(payload.error || "Usage summary unavailable.");
      }
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
    const channel = supabase.channel("models-costs-ledger")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "usage_events" }, () => void load(true))
      .subscribe((status) => setStreamStatus(status === "SUBSCRIBED" ? "realtime" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "polling" : "connecting"));
    return () => { window.clearTimeout(initialFetch); window.clearInterval(interval); void supabase.removeChannel(channel); };
  }, [load]);

  const internalBudget = summary?.internalBudget;
  const configuredBudgets = internalBudget?.configuredModels ?? 0;
  const maxProviderTokens = Math.max(...(summary?.providers.map((provider) => provider.tokens) ?? [1]), 1);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto pr-1" aria-busy={loading}>
      <header className="flex shrink-0 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3"><div className="grid size-9 place-items-center rounded-xl border border-[color-mix(in_srgb,var(--dream-cyan)_35%,transparent)] bg-[color-mix(in_srgb,var(--dream-cyan)_8%,transparent)]"><Boxes className="size-4 text-[var(--dream-cyan-hot)]" /></div><div><div className="flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-[-.025em] text-[var(--dream-text)]">Models & Costs</h1><span className={`size-1.5 rounded-full ${streamStatus === "realtime" ? "bg-[var(--dream-success)] shadow-[0_0_8px_var(--dream-success)]" : "bg-[var(--dream-gold)]"}`} /><span className="text-[14px] font-bold uppercase tracking-[.12em] text-[var(--dream-muted)]">{streamStatus === "realtime" ? "Realtime connected" : "15s polling fallback"}</span></div><p className="text-[15px] text-[var(--dream-subtle)]">Recorded ledger · refreshes on events · no credentials exposed</p></div></div>
        <div className="flex items-center gap-2"><div className="flex rounded-lg border border-[var(--dream-glass-stroke)] bg-black/20 p-0.5" role="group" aria-label="Usage period">{PERIODS.map((period) => <button key={period.days} type="button" onClick={() => setDays(period.days)} aria-pressed={days === period.days} className={`h-9 rounded-md px-3 text-[15px] font-semibold ${days === period.days ? "bg-[color-mix(in_srgb,var(--dream-cyan)_16%,transparent)] text-[var(--dream-cyan-hot)]" : "text-[var(--dream-muted)] hover:text-[var(--dream-text)]"}`}>{period.label}</button>)}</div><button type="button" onClick={() => void load()} className="grid size-8 place-items-center rounded-lg border border-[var(--dream-glass-stroke)] text-[var(--dream-muted)] hover:text-[var(--dream-cyan-hot)]" title="Refresh ledger"><RefreshCcw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /></button></div>
      </header>

      {error && <div role="alert" className="flex shrink-0 items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--dream-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--dream-danger)_8%,transparent)] px-3 py-2 text-sm text-[var(--dream-danger)]"><AlertTriangle className="size-3.5" />{error}</div>}
      {summary?.truncated && <div role="status" className="shrink-0 rounded-lg border border-[color-mix(in_srgb,var(--dream-gold)_35%,transparent)] px-3 py-2 text-[15px] text-[var(--dream-gold-hot)]">Partial view: this period exceeded the 10,000-event safety cap.</div>}

      <section className="grid shrink-0 grid-cols-5 gap-3">
        <Metric label="Recorded cost" value={summary ? currency(summary.totals.costEstimate) : "—"} detail={`estimate · ${days === 1 ? "24 hours" : `${days} days`}`} icon={CircleDollarSign} tone="gold" />
        <Metric label="Recorded tokens" value={summary ? compact(summary.totals.tokens) : "—"} detail={summary ? `${compact(summary.totals.inputTokens)} in · ${compact(summary.totals.outputTokens)} out` : "waiting for ledger"} icon={Sigma} />
        <Metric label="Internal tokens left" value={internalBudget?.remainingTokens == null ? "Not configured" : compact(internalBudget.remainingTokens)} detail={internalBudget?.monthlyTokens == null ? "Provider quota is not inferred" : `of ${compact(internalBudget.monthlyTokens)} · resets ${resetDate(internalBudget.resetsAt)}`} icon={Sigma} tone={internalBudget?.remainingTokens == null ? "muted" : "green"} />
        <Metric label="Internal cost left" value={internalBudget?.remainingCostEur == null ? "Not configured" : currency(internalBudget.remainingCostEur)} detail={internalBudget?.monthlyCostEur == null ? "Provider credit is not inferred" : `${currency(internalBudget.monthlyCostEur)} configured · ${configuredBudgets} models`} icon={WalletCards} tone={internalBudget?.remainingCostEur == null ? "muted" : "green"} />
        <Metric label="Request quality" value={summary ? percent(summary.totals.successRate) : "—"} detail={summary ? `${summary.totals.failedRequests} failed · ${summary.totals.averageLatencyMs ?? "—"}ms avg` : "waiting for ledger"} icon={Gauge} tone="green" />
      </section>

      <section className="flex h-10 shrink-0 items-center gap-3 overflow-x-auto border-y border-[var(--dream-glass-stroke)] px-1 text-[14px]" aria-label="Internal token capacity by model">
        <b className="sticky left-0 shrink-0 bg-[var(--dream-bg)] pr-2 uppercase tracking-[.1em] text-[var(--dream-subtle)]">Internal capacity</b>
        {summary?.models.map((model) => <span key={`${model.provider}:${model.model}:capacity`} className="shrink-0 text-[var(--dream-muted)]"><strong className="text-[var(--dream-text)]">{model.model}</strong> · {model.budget?.remainingTokens == null ? "Not configured" : `${compact(model.budget.remainingTokens)} left · reset ${resetDate(model.budget.resetsAt)}`} · {model.observationStatus === "configured-unobserved" ? "configured-unobserved" : "observed"}</span>)}
      </section>

      <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.55fr)_minmax(260px,.7fr)] gap-3">
        <div className="grid min-h-0 grid-rows-[minmax(180px,.72fr)_minmax(230px,1fr)] gap-3">
          <article className="dream-glass-panel grid min-h-0 grid-rows-[48px_1fr] overflow-hidden rounded-xl"><div className="flex items-center justify-between border-b border-[var(--dream-glass-stroke)] px-3.5"><span className="flex items-center gap-2 text-[16px] font-semibold text-[var(--dream-text)]"><Activity className="size-3.5 text-[var(--dream-cyan-hot)]" />Recorded cost velocity</span><span className="text-[14px] text-[var(--dream-subtle)]">{summary ? `${summary.trend.length} observed days · ${age(summary.generatedAt)}` : "Not fetched"}</span></div><div className="min-h-0 p-3"><Trend summary={summary ?? { trend: [] } as unknown as UsageSummary} /></div></article>
          <article className="dream-glass-panel grid min-h-0 grid-rows-[48px_1fr] overflow-hidden rounded-xl"><div className="flex items-center justify-between border-b border-[var(--dream-glass-stroke)] px-3.5"><span className="flex items-center gap-2 text-[16px] font-semibold text-[var(--dream-text)]"><Router className="size-3.5 text-[var(--dream-cyan-hot)]" />Model ledger</span><span className="text-[14px] text-[var(--dream-subtle)]">auditable metrics · no composite efficiency score</span></div><div className="min-h-0 overflow-auto"><table className="w-full border-collapse text-left"><thead className="sticky top-0 z-10 bg-[rgba(6,14,18,.97)] text-[13px] uppercase tracking-[.1em] text-[var(--dream-subtle)]"><tr>{["Model", "Tokens in / out", "Requests", "Success", "Latency", "Cost", "€/1M tok", "Budget"].map((label) => <th key={label} className="px-3 py-2.5 font-semibold">{label}</th>)}</tr></thead><tbody>{summary?.models.map((model, index) => <tr key={`${model.provider}:${model.model}`} className="border-t border-[color-mix(in_srgb,var(--dream-glass-stroke)_70%,transparent)] text-[15px] text-[var(--dream-muted)]"><td className="px-3 py-2.5"><span className="flex items-center gap-2"><i className="size-1.5 rounded-full" style={{ background: PROVIDER_COLORS[index % PROVIDER_COLORS.length], boxShadow: `0 0 7px ${PROVIDER_COLORS[index % PROVIDER_COLORS.length]}` }} /><span><b className="block max-w-44 truncate text-[var(--dream-text)]">{model.model}</b><small className="text-[13px] text-[var(--dream-subtle)]">{model.provider} · {model.healthStatus}</small></span></span></td><td className="whitespace-nowrap px-3 py-2.5 font-mono">{compact(model.inputTokens)} / {compact(model.outputTokens)}</td><td className="px-3 py-2.5 font-mono">{model.requests}</td><td className="px-3 py-2.5 font-mono text-[var(--dream-success)]">{percent(model.successRate)}</td><td className="px-3 py-2.5 font-mono">{model.averageLatencyMs ?? "—"}ms</td><td className="px-3 py-2.5 font-mono text-[var(--dream-gold-hot)]">{currency(model.costEstimate, 4)}</td><td className="px-3 py-2.5 font-mono">{currency(model.costPerMillionTokens)}</td><td className="min-w-28 px-3 py-2.5">{model.budget?.remainingCostEur != null && model.budget.monthlyCostEur != null ? <><span className="font-mono">{currency(model.budget.remainingCostEur)}</span><div className="mt-1 h-0.5 overflow-hidden rounded-full bg-white/10"><i className="block h-full bg-[var(--dream-cyan-hot)]" style={{ width: `${Math.min(100, (model.budget.remainingCostEur / model.budget.monthlyCostEur) * 100)}%` }} /></div></> : <span className="text-[13px] text-[var(--dream-subtle)]">Not configured</span>}</td></tr>)}{summary && summary.models.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-[var(--dream-subtle)]">No recorded modelcalls in this period.</td></tr>}</tbody></table></div></article>
        </div>

        <aside className="grid min-h-0 grid-rows-[minmax(190px,.8fr)_minmax(190px,.8fr)_minmax(130px,.55fr)] gap-3">
          <article className="dream-glass-panel min-h-0 overflow-hidden rounded-xl"><div className="flex h-12 items-center justify-between border-b border-[var(--dream-glass-stroke)] px-3.5"><span className="flex items-center gap-2 text-[16px] font-semibold text-[var(--dream-text)]"><Database className="size-3.5 text-[var(--dream-cyan-hot)]" />Provider allocation</span><span className="text-[14px] text-[var(--dream-subtle)]">{summary?.providers.length ?? 0}</span></div><div className="space-y-2.5 p-3.5">{summary?.providers.slice(0, 6).map((provider, index) => <div key={provider.provider}><div className="mb-1 flex items-center justify-between text-[14px]"><span className="text-[var(--dream-muted)]">{provider.provider} <small className="text-[var(--dream-subtle)]">· {provider.modelCount} model{provider.modelCount === 1 ? "" : "s"}</small></span><b className="font-mono text-[var(--dream-text)]">{compact(provider.tokens)}</b></div><div className="h-1 overflow-hidden rounded-full bg-white/[.06]"><i className="block h-full" style={{ width: `${(provider.tokens / maxProviderTokens) * 100}%`, background: PROVIDER_COLORS[index % PROVIDER_COLORS.length] }} /></div></div>)}</div></article>
          <article className="dream-glass-panel min-h-0 overflow-hidden rounded-xl"><div className="flex h-12 items-center justify-between border-b border-[var(--dream-glass-stroke)] px-3.5"><span className="flex items-center gap-2 text-[16px] font-semibold text-[var(--dream-text)]"><Clock3 className="size-3.5 text-[var(--dream-cyan-hot)]" />Latest calls</span><span className="text-[14px] text-[var(--dream-subtle)]">{summary?.totals.requests ?? 0} total</span></div><div className="divide-y divide-[color-mix(in_srgb,var(--dream-glass-stroke)_70%,transparent)] px-3.5">{summary?.recent.slice(0, 5).map((event) => <div key={event.id} className="flex items-center justify-between gap-3 py-2"><span className="min-w-0"><b className="block truncate text-[14px] text-[var(--dream-text)]">{event.model}</b><small className="block truncate text-[13px] text-[var(--dream-subtle)]">{event.provider} · {compact(event.input_tokens + event.output_tokens)} tok · {event.latency_ms}ms</small></span><span className={`shrink-0 font-mono text-[13px] ${event.status === "error" ? "text-[var(--dream-danger)]" : "text-[var(--dream-gold-hot)]"}`}>{currency(event.cost_estimate, 4)}</span></div>)}</div></article>
          <article className="dream-glass-panel min-h-0 overflow-hidden rounded-xl p-3.5"><div className="mb-2 flex items-center gap-2 text-[16px] font-semibold text-[var(--dream-text)]"><ShieldCheck className="size-3.5 text-[var(--dream-gold-hot)]" />Truth boundary</div><ul className="space-y-1 text-[14px] leading-5 text-[var(--dream-muted)]"><li>Recorded ledger: exact where supplied; legacy fallback may be estimated</li><li>Client-reported events are estimates, not provider invoices</li><li>Internal budgets: calculated</li><li>Claude configured: {summary?.catalog.claudeConfiguredModels ?? 0} · observed: {summary?.catalog.claudeObservedModels ?? 0}</li><li>Claude API catalog unavailable</li><li>Provider billing unavailable</li><li>Provider credits unavailable</li><li>Context and cached tokens unavailable</li></ul></article>
        </aside>
      </section>
      <footer className="flex shrink-0 items-center justify-between border-t border-[var(--dream-glass-stroke)] pt-1.5 text-[13px] uppercase tracking-[.08em] text-[var(--dream-subtle)]"><span>{summary?.source ?? "supabase:usage_events"} · EUR via {summary?.currency.source ?? "ECB"} {summary?.currency.asOf ?? "rate unavailable"} · {summary?.generatedAt ? new Date(summary.generatedAt).toLocaleTimeString() : "not fetched"}</span><span className="text-[var(--dream-gold-hot)]">Provider invoices and quotas are not inferred</span></footer>
    </div>
  );
}

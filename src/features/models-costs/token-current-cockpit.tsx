"use client";

import { useMemo, useState } from "react";
import {
  Activity, AlertTriangle, CheckCircle2, CircleDollarSign,
  Gauge, Radio, ShieldCheck, Sigma, Sparkles, WalletCards,
} from "lucide-react";
import type { UsageSummary } from "@/features/models-costs/usage-summary";

type ModelRow = UsageSummary["models"][number];
type StreamStatus = "connecting" | "realtime" | "polling";

const PROVIDER_COLORS = ["#00d4ff", "#a78bfa", "#46e6a4", "#f0b429", "#fb7185", "#60a5fa"];

function compact(value: number | null | undefined) {
  return value == null
    ? "—"
    : new Intl.NumberFormat("nl-BE", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function currency(value: number | null | undefined, digits = 2) {
  return value == null
    ? "—"
    : new Intl.NumberFormat("nl-BE", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value);
}

function percent(value: number | null | undefined) {
  return value == null ? "—" : `${value.toFixed(1)}%`;
}

function age(iso: string | null | undefined) {
  if (!iso) return "niet geobserveerd";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s geleden`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m geleden`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}u geleden`;
  return `${Math.floor(seconds / 86_400)}d geleden`;
}

function resetLabel(iso: string | null | undefined) {
  if (!iso) return "geen resetbron";
  return new Intl.DateTimeFormat("nl-BE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(iso));
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const grammar = confidence === "provider-reported"
    ? { dot: "bg-[var(--dream-success)]", label: "provider-reported", tone: "text-[var(--dream-success)]" }
    : confidence === "manual-configuration"
      ? { dot: "rounded-[2px] bg-[var(--dream-gold)]", label: "manueel ingesteld", tone: "text-[var(--dream-gold-hot)]" }
      : confidence === "recorded-estimate"
        ? { dot: "bg-[var(--dream-cyan-hot)]", label: "recorded estimate", tone: "text-[var(--dream-cyan-hot)]" }
        : { dot: "border border-[var(--dream-muted)]", label: "onbekend", tone: "text-[var(--dream-muted)]" };

  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${grammar.tone}`}>
      <i className={`size-2 shrink-0 rounded-full ${grammar.dot}`} aria-hidden="true" />
      {grammar.label}
    </span>
  );
}

function CoverageBand({ summary }: { summary: UsageSummary }) {
  const coverage = summary.intelligence.coverage;
  const observed = new Set(summary.providers.filter((provider) => provider.requests > 0).map((provider) => provider.provider.toLowerCase()));
  const configured = [...new Set(summary.models.map((model) => model.provider.toLowerCase()))];

  return (
    <section className="dream-glass-panel grid shrink-0 grid-cols-[1.05fr_1.05fr_1fr_1.35fr] overflow-hidden rounded-xl" aria-label="Portfolio-overzicht">
      <div className="border-r border-[var(--dream-glass-stroke)] px-4 py-3">
        <div className="mb-1 flex items-center gap-2 text-[14px] font-semibold uppercase tracking-[.12em] text-[var(--dream-subtle)]">
          <Sigma className="size-4 text-[var(--dream-cyan-hot)]" /> Recorded processed
        </div>
        <strong className="text-[32px] font-semibold tracking-[-.04em] text-[var(--dream-text)]">{compact(summary.intelligence.recorded.value)}</strong>
        <p className="text-[13px] text-[var(--dream-muted)]">tokens · geselecteerde periode</p>
      </div>
      <div className="border-r border-[var(--dream-glass-stroke)] px-4 py-3">
        <div className="mb-1 flex items-center gap-2 text-[14px] font-semibold uppercase tracking-[.12em] text-[var(--dream-subtle)]">
          <WalletCards className="size-4 text-[var(--dream-gold-hot)]" /> Owner budget left
        </div>
        <strong className="text-[32px] font-semibold tracking-[-.04em] text-[var(--dream-gold-hot)]">{compact(summary.intelligence.ownerBudgetRemaining.value)}</strong>
        <p className="text-[13px] text-[var(--dream-muted)]">manueel budget · niet providerquota</p>
      </div>
      <div className="border-r border-[var(--dream-glass-stroke)] px-4 py-3">
        <div className="mb-1 flex items-center gap-2 text-[14px] font-semibold uppercase tracking-[.12em] text-[var(--dream-subtle)]">
          <ShieldCheck className="size-4 text-[var(--dream-muted)]" /> Provider remaining
        </div>
        <strong className="text-[32px] font-semibold tracking-[-.04em] text-[var(--dream-muted)]">Niet beschikbaar</strong>
        <p className="text-[13px] text-[var(--dream-muted)]">geen vergelijkbare bron aangesloten</p>
      </div>
      <div className="px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-[14px] font-semibold uppercase tracking-[.12em] text-[var(--dream-subtle)]">
          <span>Brondekking</span>
          <b className="text-[var(--dream-text)]">{coverage.measuredProviders}/{coverage.configuredProviders} providers</b>
        </div>
        <div className="flex h-3 gap-1" role="img" aria-label={`${coverage.measuredProviders} van ${coverage.configuredProviders} providers gemeten`}>
          {configured.map((provider, index) => (
            <span
              key={provider}
              className={`min-w-5 flex-1 rounded-sm border ${observed.has(provider) ? "border-transparent" : "border-dashed border-[var(--dream-muted)] bg-transparent"}`}
              style={observed.has(provider) ? { background: PROVIDER_COLORS[index % PROVIDER_COLORS.length], boxShadow: `0 0 10px ${PROVIDER_COLORS[index % PROVIDER_COLORS.length]}55` } : undefined}
              title={`${provider}: ${observed.has(provider) ? "gemeten" : "geen bron"}`}
            />
          ))}
        </div>
        <p className="mt-2 truncate text-[13px] text-[var(--dream-muted)]">
          {coverage.unavailableProviders.length ? `${coverage.unavailableProviders.join(", ")} · geen events` : "alle geconfigureerde providers gemeten"}
        </p>
      </div>
    </section>
  );
}

function TokenTimeline({ model, summary, color }: { model: ModelRow; summary: UsageSummary; color: string }) {
  const events = summary.recent.filter((event) => event.provider === model.provider && event.model === model.model);
  const start = new Date(summary.intelligence.recorded.window.startAt ?? summary.generatedAt).getTime();
  const end = new Date(summary.generatedAt).getTime();
  const span = Math.max(1, end - start);
  const maximum = Math.max(...events.map((event) => event.input_tokens + event.output_tokens), 1);

  return (
    <div className="relative h-11 overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--dream-glass-stroke)_75%,transparent)] bg-[linear-gradient(90deg,rgba(0,212,255,.025),rgba(167,139,250,.035))]">
      {[25, 50, 75].map((position) => <i key={position} className="absolute inset-y-0 w-px bg-white/[.045]" style={{ left: `${position}%` }} />)}
      <i className="absolute inset-y-0 right-0 w-px bg-[var(--dream-cyan-hot)] shadow-[0_0_9px_var(--dream-cyan-hot)]" />
      {events.length === 0 ? (
        <span className="absolute inset-0 flex items-center justify-center text-[13px] text-[var(--dream-subtle)]">geen recorded events in deze periode</span>
      ) : events.map((event) => {
        const x = Math.max(1, Math.min(96, ((new Date(event.created_at).getTime() - start) / span) * 100));
        const total = event.input_tokens + event.output_tokens;
        const width = Math.max(5, Math.min(26, (total / maximum) * 26));
        const inputShare = total === 0 ? 50 : (event.input_tokens / total) * 100;
        return (
          <span
            key={event.id}
            className="absolute top-2 h-7 overflow-hidden rounded-sm border border-white/10 shadow-[0_0_12px_rgba(0,212,255,.18)] transition-[opacity,transform] duration-300 motion-reduce:transition-none"
            style={{ left: `${x}%`, width: `${width}%`, maxWidth: "62px", minWidth: "7px", transform: "translateX(-50%)" }}
          >
            <i className="block h-full" style={{ width: `${inputShare}%`, background: color }} />
            <i className="absolute inset-y-0 right-0 bg-[#a78bfa]" style={{ width: `${100 - inputShare}%` }} />
            <title>{`${new Date(event.created_at).toLocaleString("nl-BE")} · ${compact(event.input_tokens)} input · ${compact(event.output_tokens)} output · ${currency(event.cost_estimate, 4)}`}</title>
          </span>
        );
      })}
      <span className="absolute right-2 top-0.5 text-[13px] font-semibold uppercase tracking-[.08em] text-[var(--dream-cyan-hot)]">nu</span>
    </div>
  );
}

function ModelLane({ model, summary, selected, onSelect, color }: {
  model: ModelRow;
  summary: UsageSummary;
  selected: boolean;
  onSelect: () => void;
  color: string;
}) {
  const providerRemaining = model.intelligence.providerRemaining;
  const budget = model.intelligence.ownerBudget;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`grid w-full grid-cols-[minmax(170px,.82fr)_minmax(300px,2.35fr)_minmax(220px,.95fr)] items-center gap-3 border-b border-[color-mix(in_srgb,var(--dream-glass-stroke)_65%,transparent)] px-3 py-2.5 text-left transition-colors motion-reduce:transition-none ${selected ? "bg-[color-mix(in_srgb,var(--dream-cyan)_7%,transparent)]" : "hover:bg-white/[.025]"}`}
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <i className="size-2 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 9px ${color}` }} />
          <b className="truncate text-[15px] text-[var(--dream-text)]">{model.model}</b>
        </span>
        <span className="mt-1 flex items-center gap-2 pl-4 text-[13px] text-[var(--dream-subtle)]">
          <span>{model.provider}</span><span>·</span><span>{compact(model.tokens)} processed</span>
        </span>
      </span>
      <TokenTimeline model={model} summary={summary} color={color} />
      <span className="grid grid-cols-2 gap-2">
        <span className="rounded-lg border border-dashed border-[var(--dream-glass-stroke)] px-2.5 py-2">
          <small className="block text-[13px] font-semibold uppercase tracking-[.08em] text-[var(--dream-subtle)]">Provider left</small>
          <b className="block truncate text-[15px] text-[var(--dream-muted)]">{providerRemaining.value == null ? "—" : compact(providerRemaining.value)}</b>
          <small className="block truncate text-[13px] text-[var(--dream-subtle)]">{providerRemaining.availability}</small>
        </span>
        <span className="rounded-lg border border-[color-mix(in_srgb,var(--dream-gold)_28%,transparent)] bg-[repeating-linear-gradient(135deg,rgba(240,180,41,.06),rgba(240,180,41,.06)_4px,transparent_4px,transparent_8px)] px-2.5 py-2">
          <small className="block text-[13px] font-semibold uppercase tracking-[.08em] text-[var(--dream-subtle)]">Owner left</small>
          <b className="block truncate text-[15px] text-[var(--dream-gold-hot)]">{compact(budget.value)}</b>
          <small className="block truncate text-[13px] text-[var(--dream-subtle)]">{budget.value == null ? "niet ingesteld" : resetLabel(budget.window.resetAt)}</small>
        </span>
      </span>
    </button>
  );
}

function ModelDetail({ model, generatedAt }: { model: ModelRow | undefined; generatedAt: string }) {
  if (!model) {
    return <div className="grid h-full place-items-center text-[15px] text-[var(--dream-muted)]">Selecteer een model</div>;
  }
  const quota = model.intelligence.providerRemaining;
  const budget = model.intelligence.ownerBudget;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[var(--dream-glass-stroke)] p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-[13px] font-semibold uppercase tracking-[.14em] text-[var(--dream-cyan-hot)]">Selected current</p><h2 className="truncate text-[24px] font-semibold tracking-[-.03em] text-[var(--dream-text)]">{model.model}</h2><p className="text-[14px] text-[var(--dream-muted)]">{model.provider} · {model.healthStatus}</p></div>
          <Radio className="mt-1 size-4 text-[var(--dream-cyan-hot)]" />
        </div>
        <ConfidenceBadge confidence={model.intelligence.recorded.confidence} />
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
        <section>
          <div className="mb-2 flex items-center justify-between text-[14px]"><span className="text-[var(--dream-muted)]">Recorded processed</span><b className="font-mono text-[var(--dream-text)]">{compact(model.tokens)} tok</b></div>
          <div className="flex h-2 overflow-hidden rounded-full bg-white/[.06]"><i className="bg-[var(--dream-cyan-hot)]" style={{ width: `${model.tokens === 0 ? 0 : (model.inputTokens / model.tokens) * 100}%` }} /><i className="bg-[#a78bfa]" style={{ width: `${model.tokens === 0 ? 0 : (model.outputTokens / model.tokens) * 100}%` }} /></div>
          <p className="mt-1 text-[13px] text-[var(--dream-subtle)]">{compact(model.inputTokens)} input · {compact(model.outputTokens)} output</p>
        </section>
        <section className="rounded-lg border border-[var(--dream-glass-stroke)] p-3">
          <div className="mb-1 flex items-center justify-between"><span className="flex items-center gap-2 text-[14px] font-semibold text-[var(--dream-text)]"><ShieldCheck className="size-4 text-[var(--dream-muted)]" />Provider remaining</span><b className="text-[15px] text-[var(--dream-muted)]">{quota.value == null ? "—" : compact(quota.value)}</b></div>
          <p className="text-[13px] leading-5 text-[var(--dream-subtle)]">{quota.reason}</p>
        </section>
        <section className="rounded-lg border border-[color-mix(in_srgb,var(--dream-gold)_28%,transparent)] bg-[repeating-linear-gradient(135deg,rgba(240,180,41,.055),rgba(240,180,41,.055)_5px,transparent_5px,transparent_10px)] p-3">
          <div className="mb-1 flex items-center justify-between"><span className="flex items-center gap-2 text-[14px] font-semibold text-[var(--dream-text)]"><WalletCards className="size-4 text-[var(--dream-gold-hot)]" />Owner budget</span><b className="text-[15px] text-[var(--dream-gold-hot)]">{compact(budget.value)}</b></div>
          <p className="text-[13px] text-[var(--dream-subtle)]">{budget.value == null ? budget.reason : `reset ${resetLabel(budget.window.resetAt)}`}</p>
        </section>
        <div className="grid grid-cols-2 gap-2">
          <section className="rounded-lg border border-[var(--dream-glass-stroke)] p-3"><CircleDollarSign className="mb-2 size-4 text-[var(--dream-gold-hot)]" /><b className="block text-[16px] text-[var(--dream-text)]">{currency(model.costEstimate, 4)}</b><span className="text-[13px] text-[var(--dream-subtle)]">ledger estimate</span></section>
          <section className="rounded-lg border border-[var(--dream-glass-stroke)] p-3"><Gauge className="mb-2 size-4 text-[var(--dream-success)]" /><b className="block text-[16px] text-[var(--dream-text)]">{percent(model.successRate)}</b><span className="text-[13px] text-[var(--dream-subtle)]">{model.averageLatencyMs ?? "—"}ms gemiddeld</span></section>
        </div>
        <section className="space-y-2 border-t border-[var(--dream-glass-stroke)] pt-3 text-[13px]">
          <div className="flex justify-between gap-3"><span className="text-[var(--dream-subtle)]">Bron</span><b className="truncate text-[var(--dream-muted)]">{model.intelligence.recorded.source}</b></div>
          <div className="flex justify-between gap-3"><span className="text-[var(--dream-subtle)]">Observed</span><b className="text-[var(--dream-muted)]">{age(model.intelligence.recorded.observedAt)}</b></div>
          <div className="flex justify-between gap-3"><span className="text-[var(--dream-subtle)]">Dashboard freshness</span><b className="text-[var(--dream-muted)]">{age(generatedAt)}</b></div>
        </section>
      </div>
    </div>
  );
}

function EventTicker({ summary }: { summary: UsageSummary }) {
  const latest = summary.recent[0];
  return (
    <div className="flex h-10 shrink-0 items-center gap-3 overflow-hidden border-t border-[var(--dream-glass-stroke)] px-3 text-[13px]">
      <span className="flex shrink-0 items-center gap-2 font-semibold uppercase tracking-[.12em] text-[var(--dream-cyan-hot)]"><Activity className="size-4" /> Event current</span>
      {latest ? <><b className="truncate text-[var(--dream-text)]">{latest.model}</b><span className="truncate text-[var(--dream-muted)]">{latest.provider} · {compact(latest.input_tokens)} in · {compact(latest.output_tokens)} out · {currency(latest.cost_estimate, 4)}</span><span className="ml-auto shrink-0 text-[var(--dream-subtle)]">{age(latest.created_at)}</span></> : <span className="text-[var(--dream-subtle)]">geen recorded events</span>}
    </div>
  );
}

export function TokenCurrentCockpit({ summary, streamStatus }: { summary: UsageSummary; streamStatus: StreamStatus }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const models = summary.models.slice(0, 20);
  const selected = useMemo(() => {
    const explicit = models.find((model) => `${model.provider}:${model.model}` === selectedKey);
    return explicit ?? models[0];
  }, [models, selectedKey]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <CoverageBand summary={summary} />
      <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-3">
        <article className="dream-glass-panel grid min-h-0 grid-rows-[48px_1fr] overflow-hidden rounded-xl">
          <div className="flex items-center justify-between border-b border-[var(--dream-glass-stroke)] px-3.5">
            <span className="flex items-center gap-2 text-[16px] font-semibold text-[var(--dream-text)]"><Sparkles className="size-4 text-[var(--dream-cyan-hot)]" />Token Current · model flow lanes</span>
            <span className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[.1em] text-[var(--dream-muted)]"><i className={`size-2 rounded-full ${streamStatus === "realtime" ? "bg-[var(--dream-success)] shadow-[0_0_8px_var(--dream-success)]" : "bg-[var(--dream-gold)]"}`} />{streamStatus === "realtime" ? "Live verbinding" : streamStatus === "polling" ? "Polling · 15s" : "Verbinden"}</span>
          </div>
          <div className="min-h-0 overflow-auto">
            {models.length ? models.map((model, index) => {
              const key = `${model.provider}:${model.model}`;
              return <ModelLane key={key} model={model} summary={summary} color={PROVIDER_COLORS[index % PROVIDER_COLORS.length]} selected={selected === model} onSelect={() => setSelectedKey(key)} />;
            }) : <div className="grid h-full place-items-center text-[15px] text-[var(--dream-muted)]">Geen geconfigureerde modellen.</div>}
          </div>
        </article>
        <aside className="dream-glass-panel min-h-0 overflow-hidden rounded-xl"><ModelDetail model={selected} generatedAt={summary.generatedAt} /></aside>
      </section>
      <section className="dream-glass-panel shrink-0 overflow-hidden rounded-xl">
        <EventTicker summary={summary} />
        <div className="flex min-h-9 items-center justify-between gap-4 px-3 text-[13px] text-[var(--dream-subtle)]">
          <span className="flex min-w-0 items-center gap-2 truncate"><CheckCircle2 className="size-4 shrink-0 text-[var(--dream-success)]" />{summary.source} · EUR via {summary.currency.source} {summary.currency.asOf} · observed {age(summary.generatedAt)}</span>
          <span className="flex shrink-0 items-center gap-2 text-[var(--dream-gold-hot)]"><AlertTriangle className="size-4" />quota, cache en context blijven onbekend zonder bron</span>
        </div>
      </section>
    </div>
  );
}

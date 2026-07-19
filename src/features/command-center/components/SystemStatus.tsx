"use client";

import { ShieldCheck, Wifi } from "lucide-react";
import { useAuthBoundary } from "@/components/auth-boundary-context";
import { buildSystemStatusModel } from "../system-status-model";

export function SystemStatus() {
  const auth = useAuthBoundary();
  const statuses = buildSystemStatusModel({ auth, resources: [] });
  const icons = { Session: Wifi, "Access policy": ShieldCheck } as const;

  return (
    <section className="dream-glass-panel h-full p-3" data-dream-region="system-status" aria-labelledby="system-status-title">
      <h2 id="system-status-title" className="mb-3 text-[12px] uppercase tracking-[0.12em] text-[var(--dream-muted)]">System Status</h2>
      <div className="space-y-2.5">{statuses.map(({ label, value, tone, evidence }) => {
        const Icon = icons[label as keyof typeof icons] ?? ShieldCheck;
        const toneClass = tone === "success"
          ? "text-[var(--dream-success)]"
          : tone === "error"
            ? "text-destructive"
            : "text-[var(--dream-subtle)]";
        return <div key={label} className="flex items-center gap-2 text-[12px]" title={evidence}><Icon className={`size-3.5 ${toneClass}`} /><span className="text-[var(--dream-muted)]">{label}</span><span className={`ml-auto ${toneClass}`}>{value}</span>{tone === "success" && <span className="size-1.5 rounded-full bg-[var(--dream-success)] shadow-[0_0_8px_var(--dream-success)]" />}</div>;
      })}</div>
    </section>
  );
}
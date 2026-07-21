"use client";

import { Activity, Archive, Clock3, GitBranch, ListChecks, Network, ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSecondBrainSnapshot } from "@/hooks/useSecondBrainSnapshot";

const NODE_POSITIONS = [
  "left-[8%] top-[12%]", "right-[8%] top-[12%]", "right-[5%] top-[46%]", "right-[18%] bottom-[7%]",
  "left-[18%] bottom-[7%]", "left-[5%] top-[46%]", "left-[38%] top-[7%]", "right-[38%] bottom-[5%]",
];

export default function TwinPage() {
  const { status, snapshot, error, truth } = useSecondBrainSnapshot();
  if (!snapshot) {
    return <div className="grid h-full place-items-center"><div className="max-w-md rounded-3xl border border-primary/15 bg-card/75 p-8 text-center backdrop-blur"><Network className="mx-auto size-8 text-primary" /><h1 className="mt-4 text-xl font-semibold">Digital Twin · Second Brain</h1><p className="mt-3 text-sm text-muted-foreground" role={status === "error" ? "alert" : "status"}>{status === "loading" ? "Reading the private aggregate snapshot…" : error ?? "Snapshot unavailable."}</p>{status !== "loading" && <p className="mt-3 text-xs text-muted-foreground">Local-only source · no private workspace snapshot is bundled with deployments.</p>}</div></div>;
  }

  const continuity = snapshot.continuityFilesExpected
    ? Math.round((snapshot.continuityFilesPresent / snapshot.continuityFilesExpected) * 100)
    : 0;
  const recentProjects = [...new Set(snapshot.recentChanges.map((change) => change.project))].slice(0, NODE_POSITIONS.length);
  const metrics = [
    { label: "Indexed projects", value: snapshot.indexedProjects, icon: GitBranch },
    { label: "Continuity files", value: `${snapshot.continuityFilesPresent}/${snapshot.continuityFilesExpected}`, icon: ShieldCheck },
    { label: "Open actions", value: snapshot.openActions ?? "—", icon: ListChecks },
    { label: "Unresolved decisions", value: snapshot.unresolvedDecisions ?? "—", icon: TriangleAlert },
    { label: "Stale projects", value: snapshot.staleProjects, icon: Clock3 },
    { label: "Backup state", value: snapshot.backupState, icon: Archive },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto pr-1">
      <header className="flex items-center justify-between gap-4">
        <div><div className="flex items-center gap-2"><Network className="size-5 text-primary" /><h1 className="text-xl font-bold">Digital Twin · Second Brain</h1></div><p className="mt-1 text-xs text-muted-foreground">Model-independent continuity telemetry from the local AI Workspace.</p></div>
        <Badge
          variant="outline"
          className={truth.status === "fresh" ? "border-emerald-400/25 text-emerald-300" : truth.status === "stale" ? "border-amber-300/25 text-amber-300" : "border-destructive/25 text-destructive"}
          title={`${truth.source} · observed ${snapshot.observedAt}`}
        >
          Private aggregate · {truth.status}
        </Badge>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Second Brain readouts">
        {metrics.map((metric) => <Card key={metric.label} className="border-border bg-card/75 backdrop-blur"><CardContent className="flex items-center gap-3 p-4"><metric.icon className="size-4 shrink-0 text-primary" /><div className="min-w-0"><p className="truncate text-[10px] uppercase tracking-[.12em] text-muted-foreground">{metric.label}</p><p className="mt-1 truncate text-lg font-semibold capitalize text-foreground">{metric.value}</p></div></CardContent></Card>)}
      </section>

      <div className="grid min-h-[520px] flex-1 grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="relative min-h-[520px] overflow-hidden border-border bg-card/70 backdrop-blur xl:col-span-8">
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><GitBranch className="size-4 text-primary" /> Project constellation</CardTitle></CardHeader>
          <CardContent className="absolute inset-x-0 bottom-0 top-14">
            <svg className="absolute inset-0 size-full text-primary/25" aria-hidden="true"><circle cx="50%" cy="50%" r="34%" fill="none" stroke="currentColor" strokeDasharray="3 8" />{recentProjects.map((_, index) => { const angle = ((Math.PI * 2) / Math.max(recentProjects.length, 1)) * index - Math.PI / 2; return <line key={index} x1="50%" y1="50%" x2={`${50 + Math.cos(angle) * 34}%`} y2={`${50 + Math.sin(angle) * 34}%`} stroke="currentColor" />; })}</svg>
            <div className="absolute left-1/2 top-1/2 z-10 grid size-40 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-primary/30 bg-background/90 shadow-[0_0_90px_rgba(0,212,255,.2)]"><div className="text-center"><span className="text-3xl font-semibold text-primary">{continuity}%</span><p className="mt-1 text-[9px] uppercase tracking-[.18em] text-muted-foreground">continuity</p></div></div>
            {recentProjects.map((project, index) => <div key={project} className={`absolute ${NODE_POSITIONS[index]} w-32 rounded-2xl border border-primary/15 bg-background/85 p-3 text-center shadow-xl backdrop-blur`}><span className="mx-auto block size-2 rounded-full bg-primary shadow-[0_0_12px_currentColor]" /><p className="mt-2 truncate text-xs font-medium" title={project}>{project}</p><p className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">recently changed</p></div>)}
            {!recentProjects.length && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">No durable changes in this snapshot.</div>}
          </CardContent>
        </Card>

        <Card className="border-border bg-card/75 backdrop-blur xl:col-span-4">
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><Activity className="size-4 text-primary" /> Durable change trace</CardTitle></CardHeader>
          <CardContent><ol className="space-y-2">{snapshot.recentChanges.length ? snapshot.recentChanges.map((change, index) => <li key={`${change.project}-${change.at}-${index}`} className="flex gap-3 rounded-xl border border-border bg-background/40 p-3"><span className="mt-1 size-2 shrink-0 rounded-full bg-primary shadow-[0_0_9px_currentColor]" /><div className="min-w-0"><p className="truncate text-xs font-medium">{change.project}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{change.kind} · {new Date(change.at).toLocaleString()}</p></div></li>) : <li className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">No recent durable changes.</li>}</ol></CardContent>
        </Card>
      </div>

      <p className="pb-2 text-[10px] text-muted-foreground">
        Source {truth.source} · Observed {new Date(snapshot.observedAt).toLocaleString()} · Age {truth.ageMs === null ? "unavailable" : `${Math.round(truth.ageMs / 1000)}s`} · Aggregate metadata only; document bodies, chats and credentials never enter this snapshot.
      </p>
    </div>
  );
}

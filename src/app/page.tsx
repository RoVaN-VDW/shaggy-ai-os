"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCockpitData } from "@/hooks/useCockpitData";
import { AICoreOrb } from "@/components/ui/orb";
import { ProviderConfigDialog } from "@/components/providers/provider-config-dialog";
import {
  Activity,
  Folder,
  ShieldCheck,
  Zap,
  Bell,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";

function SystemHealth({ providers }: { providers: { status: string }[] }) {
  const active = providers.filter((p) => p.status === "active").length;
  const total = Math.max(providers.length, 1);
  const score = Math.round((active / total) * 100);
  return { score, active };
}

export default function CockpitPage() {
  const { loading, error, projects, providers, reviews, updateProviderStatus, updateReviewStatus } = useCockpitData();
  const [notifications] = useState<string[]>([]);
  const { score: systemHealth, active: activeProviders } = SystemHealth({ providers });

  return (
    <div className="h-full grid grid-cols-12 grid-rows-[auto_1fr] gap-4">
      {/* Top Hero with AI Core Orb */}
      <div className="col-span-12 p-5 rounded-2xl border border-[#1e293b] bg-gradient-to-r from-[#0a0f1e] to-[#050505] flex items-center gap-6 overflow-hidden">
        <div className="shrink-0 relative">
          <div className="absolute inset-0 rounded-full bg-[#00d4ff]/20 blur-2xl" />
          <AICoreOrb size={96} />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-[#f1f5f9]">Welcome back, Ronald.</h1>
          <p className="text-sm text-[#94a3b8]">
            S.H.A.G.G.Y. is in Manual Mode. All external actions are approval-gated. {projects.length} project{projects.length !== 1 && "s"} active, {activeProviders} of {providers.length} model providers active.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className="bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30">Manual</Badge>
          <Badge className="bg-[#f0b429]/10 text-[#f0b429] border border-[#f0b429]/30">Local-first</Badge>
          <Badge className="bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30">{activeProviders}/{providers.length} Providers</Badge>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="col-span-12 flex items-center gap-2 text-sm text-[#94a3b8]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading live telemetry from Supabase...
        </div>
      )}

      {/* Error banner */}
      {error && !loading && (
        <div className="col-span-12 p-3 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 flex items-center gap-2 text-sm text-[#ef4444]">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Left Column */}
      <div className="col-span-8 row-span-1 grid grid-cols-2 gap-4">
        <Card className="border-[#1e293b] bg-[#111c21]/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#94a3b8] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#00d4ff]" /> System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#f1f5f9]">{systemHealth}%</div>
            <Progress value={systemHealth} className="mt-3 h-1.5" />
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[#94a3b8]">
              <div>Supabase: <span className="text-[#22c55e]">Connected</span></div>
              <div>Active Models: <span className="text-[#22c55e]">{activeProviders}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#1e293b] bg-[#111c21]/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#94a3b8] flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#f0b429]" /> Active Providers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#f1f5f9]">{providers.length}</div>
            <div className="mt-3 space-y-2">
              {providers.length === 0 && !loading && (
                <span className="text-xs text-[#94a3b8]">No providers registered.</span>
              )}
              {providers.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-[#03080b] border border-[#1e293b]">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`border-[#1e293b] text-[10px] ${p.status === "active" ? "text-[#22c55e]" : "text-[#94a3b8]"}`}>
                      {p.provider}
                    </Badge>
                    <span className="text-[10px] text-[#64748b]">{p.model}</span>
                  </div>
                  <ProviderConfigDialog provider={p} onStatusChange={updateProviderStatus} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 border-[#1e293b] bg-[#111c21]/80 backdrop-blur">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm text-[#94a3b8] flex items-center gap-2">
              <Folder className="w-4 h-4 text-[#f0b429]" /> Projects
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-[#00d4ff] hover:text-[#00d4ff] hover:bg-[#00d4ff]/10 h-7">
              View all <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {projects.length === 0 && !loading && (
              <p className="text-xs text-[#94a3b8]">No projects found.</p>
            )}
            <div className="grid grid-cols-3 gap-3">
              {projects.map((p) => (
                <div key={p.id} className="p-3 rounded-lg bg-[#03080b] border border-[#1e293b] flex flex-col justify-between">
                  <div>
                    <div className="text-sm font-medium text-[#f1f5f9] line-clamp-1">{p.name}</div>
                    <div className="text-[10px] text-[#94a3b8] uppercase mt-0.5">{p.status}</div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-[#94a3b8] mb-1">
                      <span>Health</span>
                      <span className="text-[#00d4ff]">{p.health_score}%</span>
                    </div>
                    <Progress value={p.health_score} className="h-1" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column */}
      <div className="col-span-4 row-span-1 flex flex-col gap-4">
        <Card className="flex-1 border-[#1e293b] bg-[#111c21]/80 backdrop-blur flex flex-col">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm text-[#94a3b8] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#22c55e]" /> Review Queue
            </CardTitle>
            <Badge className="bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30">{reviews.length}</Badge>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-full px-4">
              <div className="space-y-2 pb-4">
                {reviews.length === 0 && !loading && (
                  <p className="text-xs text-[#94a3b8]">No pending approvals.</p>
                )}
                {reviews.map((r) => (
                  <div key={r.id} className="p-3 rounded-lg bg-[#03080b] border border-[#1e293b]">
                    <div className="text-sm font-medium text-[#f1f5f9]">{r.title}</div>
                    <div className="text-[10px] text-[#94a3b8] mb-2">
                      <span className="capitalize">{r.risk_level}</span> risk · {r.status}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        className="h-6 text-[10px] bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 border border-[#22c55e]/30"
                        onClick={() => updateReviewStatus(r.id, "approved")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] border-[#ef4444]/30 text-[#ef4444] hover:bg-[#ef4444]/10"
                        onClick={() => updateReviewStatus(r.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-[#1e293b] bg-[#111c21]/80 backdrop-blur">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm text-[#94a3b8] flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#f0b429]" /> Notifications
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-[10px] text-[#94a3b8] hover:text-[#f1f5f9]">
              Clear
            </Button>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <p className="text-xs text-[#94a3b8]">No new notifications.</p>
            ) : (
              <ul className="space-y-1 text-xs text-[#f1f5f9]">
                {notifications.map((n, i) => (
                  <li key={i} className="text-[#94a3b8]">• {n}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCockpitData } from "@/hooks/useCockpitData";
import { AICoreOrb } from "@/components/ui/orb";
import { ProviderConfigDialog } from "@/components/providers/provider-config-dialog";
import { QuickActionsDialog } from "@/components/actions/quick-actions-dialog";
import { KnowledgeUpload } from "@/components/knowledge/knowledge-upload";
import { NotificationsPanel } from "@/components/notifications/notifications-panel";
import { UsagePanel } from "@/components/usage/usage-panel";
import { Activity, Folder, ShieldCheck, Zap, Bell, ArrowRight, Loader2, AlertCircle, Rocket, Cpu, Database, Bot, Clock } from "lucide-react";

function SystemHealth({ providers }: { providers: { status: string }[] }) {
  const active = providers.filter((p) => p.status === "active").length;
  const total = Math.max(providers.length, 1);
  const score = Math.round((active / total) * 100);
  return { score, active };
}

export default function CockpitPage() {
  const {
    loading,
    error,
    projects,
    providers,
    reviews,
    notifications,
    usage,
    dailyUsage,
    knowledgeDocs,
    agentActivity,
    updateProviderStatus,
    updateReviewStatus,
    markNotificationRead,
    clearAllNotifications,
  } = useCockpitData();
  const { score: systemHealth, active: activeProviders } = SystemHealth({ providers });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const totalCost = usage.reduce((sum, u) => sum + (u.cost_estimate || 0), 0);
  const failedEvents = usage.filter((u) => u.status === "error").length;

  return (
    <div className="h-full grid grid-cols-12 grid-rows-[auto_auto_1fr] gap-4">
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

      {/* KPI Row */}
      <div className="col-span-12 grid grid-cols-4 gap-4">
        <KpiCard icon={<Cpu className="w-4 h-4 text-[#00d4ff]" />} label="System Health" value={`${systemHealth}%`} sub="All providers operational" />
        <KpiCard icon={<Zap className="w-4 h-4 text-[#f0b429]" />} label="Active Providers" value={`${activeProviders}/${providers.length}`} sub="Models online now" />
        <KpiCard icon={<Database className="w-4 h-4 text-[#22c55e]" />} label="Usage Spend (30d)" value={`$${totalCost.toFixed(2)}`} sub={`${failedEvents} failed events`} />
        <KpiCard icon={<Bell className="w-4 h-4 text-[#ef4444]" />} label="Unread Alerts" value={unreadCount.toString()} sub="Needs attention" />
      </div>

      {/* Main Tabs Section */}
      <div className="col-span-12 min-h-0">
        <Tabs defaultValue="overview" className="h-full flex flex-col">
          <TabsList className="bg-[#111c21]/80 border border-[#1e293b] w-fit mb-4">
            <TabsTrigger value="overview" className="data-[state=active]:bg-[#00d4ff]/10 data-[state=active]:text-[#00d4ff]">Overview</TabsTrigger>
            <TabsTrigger value="usage" className="data-[state=active]:bg-[#00d4ff]/10 data-[state=active]:text-[#00d4ff]">Usage</TabsTrigger>
            <TabsTrigger value="alerts" className="data-[state=active]:bg-[#00d4ff]/10 data-[state=active]:text-[#00d4ff]">Alerts</TabsTrigger>
            <TabsTrigger value="knowledge" className="data-[state=active]:bg-[#00d4ff]/10 data-[state=active]:text-[#00d4ff]">Knowledge</TabsTrigger>
            <TabsTrigger value="agents" className="data-[state=active]:bg-[#00d4ff]/10 data-[state=active]:text-[#00d4ff]">Agents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="m-0 flex-1 min-h-0">
            <div className="h-full grid grid-cols-12 gap-4">
              {/* Left Column */}
              <div className="col-span-8 grid grid-cols-2 gap-4 content-start">
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
              <div className="col-span-4 flex flex-col gap-4">
                <Card className="flex-1 border-[#1e293b] bg-[#111c21]/80 backdrop-blur flex flex-col min-h-0">
                  <CardHeader className="pb-2 flex-row items-center justify-between">
                    <CardTitle className="text-sm text-[#94a3b8] flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#22c55e]" /> Review Queue
                    </CardTitle>
                    <Badge className="bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30">{reviews.length}</Badge>
                  </CardHeader>
                  <CardContent className="flex-1 p-0 min-h-0">
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
                      <Rocket className="w-4 h-4 text-[#00d4ff]" /> Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <QuickActionsDialog providers={providers} projects={projects} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="usage" className="m-0 flex-1 min-h-0">
            <UsagePanel usage={usage} dailyUsage={dailyUsage} providers={providers} />
          </TabsContent>

          <TabsContent value="alerts" className="m-0 flex-1 min-h-0">
            <NotificationsPanel
              notifications={notifications}
              onMarkRead={markNotificationRead}
              onClearAll={clearAllNotifications}
            />
          </TabsContent>

          <TabsContent value="knowledge" className="m-0 flex-1 min-h-0">
            <KnowledgeUpload docs={knowledgeDocs} />
          </TabsContent>

          <TabsContent value="agents" className="m-0 flex-1 min-h-0">
            <AgentActivityPanel activity={agentActivity} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card className="border-[#1e293b] bg-[#111c21]/80 backdrop-blur p-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-[#64748b]">{label}</p>
          <p className="text-2xl font-bold text-[#f1f5f9]">{value}</p>
          <p className="text-[10px] text-[#94a3b8]">{sub}</p>
        </div>
        <div className="p-2 rounded-lg bg-[#00d4ff]/10">{icon}</div>
      </div>
    </Card>
  );
}

function AgentActivityPanel({ activity }: { activity: { id: string; agent: string; action: string; status: string; created_at: string }[] }) {
  return (
    <Card className="h-full border-[#1e293b] bg-[#111c21]/80 backdrop-blur">
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-sm text-[#94a3b8] flex items-center gap-2">
          <Bot className="w-4 h-4 text-[#00d4ff]" /> Agent Activity
        </CardTitle>
        <Badge className="bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30">{activity.length}</Badge>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-24rem)] px-4">
          <div className="space-y-2 pb-4">
            {activity.length === 0 && (
              <p className="text-xs text-[#94a3b8]">No recent agent activity.</p>
            )}
            {activity.map((a) => (
              <div key={a.id} className="p-3 rounded-lg bg-[#03080b] border border-[#1e293b] flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${a.status === "success" ? "bg-[#22c55e]" : a.status === "error" ? "bg-[#ef4444]" : "bg-[#f0b429]"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#f1f5f9]">{a.action}</div>
                  <div className="text-[10px] text-[#94a3b8]">{a.agent}</div>
                </div>
                <div className="text-[10px] text-[#64748b] flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {new Date(a.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

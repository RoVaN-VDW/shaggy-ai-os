"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { Database, TrendingUp, AlertCircle, Clock } from "lucide-react";

const PROVIDER_COLORS: Record<string, string> = {
  openai: "#22c55e",
  kimi: "#00d4ff",
  gemini: "#f0b429",
  claude: "#a855f7",
  anthropic: "#a855f7",
  antigravity: "#ef4444",
};

export function UsagePanel({
  usage,
  dailyUsage,
  providers,
}: {
  usage: { provider: string; cost_estimate: number; status: string; input_tokens: number; output_tokens: number; created_at: string }[];
  dailyUsage: { day: string; provider: string; total_cost: number; event_count: number }[];
  providers: { provider: string }[];
}) {
  const totalCost = usage.reduce((sum, u) => sum + (u.cost_estimate || 0), 0);
  const totalTokens = usage.reduce((sum, u) => sum + (u.input_tokens || 0) + (u.output_tokens || 0), 0);
  const failedEvents = usage.filter((u) => u.status === "error").length;
  const successRate = usage.length > 0 ? Math.round(((usage.length - failedEvents) / usage.length) * 100) : 100;

  const providerCosts = providers.map((p) => ({
    name: p.provider,
    cost: usage.filter((u) => u.provider === p.provider).reduce((sum, u) => sum + (u.cost_estimate || 0), 0),
    color: PROVIDER_COLORS[p.provider.toLowerCase()] || "#94a3b8",
  }));

  const chartData = dailyUsage.slice(0, 14).map((d) => ({
    day: d.day.slice(5),
    cost: Number(d.total_cost),
    provider: d.provider,
  }));

  return (
    <div className="h-full grid grid-cols-12 gap-4">
      <div className="col-span-8 grid grid-cols-2 gap-4 content-start">
        <Card className="border-[#1e293b] bg-[#111c21]/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#94a3b8] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#00d4ff]" /> Total Spend (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#f1f5f9]">${totalCost.toFixed(2)}</div>
            <p className="text-[10px] text-[#94a3b8] mt-1">Across all providers and projects</p>
          </CardContent>
        </Card>

        <Card className="border-[#1e293b] bg-[#111c21]/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#94a3b8] flex items-center gap-2">
              <Database className="w-4 h-4 text-[#f0b429]" /> Tokens Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#f1f5f9]">{totalTokens.toLocaleString()}</div>
            <p className="text-[10px] text-[#94a3b8] mt-1">Input + output tokens</p>
          </CardContent>
        </Card>

        <Card className="col-span-2 border-[#1e293b] bg-[#111c21]/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#94a3b8] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#ef4444]" /> Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#f1f5f9]">{successRate}%</div>
            <Progress value={successRate} className="mt-3 h-1.5" />
            <p className="text-[10px] text-[#94a3b8] mt-2">{failedEvents} failed events out of {usage.length}</p>
          </CardContent>
        </Card>

        <Card className="col-span-2 border-[#1e293b] bg-[#111c21]/80 backdrop-blur h-80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#94a3b8] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#00d4ff]" /> Daily Cost (last 14 days)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px" }}
                  labelStyle={{ color: "#f1f5f9" }}
                  itemStyle={{ color: "#00d4ff" }}
                  formatter={(value: unknown) => {
                    const num = typeof value === "number" ? value : 0;
                    return [`$${num.toFixed(4)}`, "Cost"];
                  }}
                />
                <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PROVIDER_COLORS[entry.provider.toLowerCase()] || "#00d4ff"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="col-span-4 flex flex-col gap-4">
        <Card className="border-[#1e293b] bg-[#111c21]/80 backdrop-blur flex-1 min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#94a3b8]">Cost by Provider</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-64 px-4">
              <div className="space-y-2 pb-4">
                {providerCosts.map((p) => (
                  <div key={p.name} className="p-3 rounded-lg bg-[#03080b] border border-[#1e293b]">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="border-[#1e293b] text-[10px]" style={{ color: p.color }}>
                        {p.name}
                      </Badge>
                      <span className="text-sm font-bold text-[#f1f5f9]">${p.cost.toFixed(2)}</span>
                    </div>
                    <Progress
                      value={totalCost > 0 ? (p.cost / totalCost) * 100 : 0}
                      className="mt-2 h-1"
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-[#1e293b] bg-[#111c21]/80 backdrop-blur flex-1 min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#94a3b8]">Recent Events</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-64 px-4">
              <div className="space-y-2 pb-4">
                {usage.slice(0, 20).map((u) => (
                  <div key={u.created_at} className="p-2 rounded-lg bg-[#03080b] border border-[#1e293b] text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#f1f5f9]">{u.provider}</span>
                      <span className={u.status === "error" ? "text-[#ef4444]" : "text-[#22c55e]"}>{u.status}</span>
                    </div>
                    <div className="text-[#64748b] mt-1">
                      ${u.cost_estimate.toFixed(4)} · {(u.input_tokens + u.output_tokens).toLocaleString()} tokens
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

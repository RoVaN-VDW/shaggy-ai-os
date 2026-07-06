"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Network, Activity, Server, Cpu, Database, Shield } from "lucide-react";

const modules = [
  { name: "Cockpit", status: "active", icon: Activity },
  { name: "Projects", status: "active", icon: Server },
  { name: "Chat", status: "active", icon: Cpu },
  { name: "Knowledge", status: "standby", icon: Database },
  { name: "Review", status: "active", icon: Shield },
];

export default function TwinPage() {
  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Network className="w-5 h-5 text-[#00d4ff]" />
        <h1 className="text-xl font-bold text-[#f1f5f9]">Digital Twin</h1>
      </div>
      <div className="grid grid-cols-12 gap-4 flex-1">
        <Card className="col-span-8 border-[#1e293b] bg-[#111c21]/80 backdrop-blur flex flex-col">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#94a3b8]">System Architecture</CardTitle></CardHeader>
          <CardContent className="flex-1 flex items-center justify-center">
            <div className="relative w-full h-full max-w-2xl">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 rounded-full border-2 border-[#00d4ff]/30 flex items-center justify-center bg-[#03080b]/80">
                  <span className="text-[#00d4ff] font-bold text-xs">SHAGGY</span>
                </div>
              </div>
              {modules.map((m, i) => {
                const angle = (i * 360) / modules.length;
                const radius = 35;
                return (
                  <div
                    key={m.name}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                    style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(${radius}%) rotate(-${angle}deg)` }}
                  >
                    <div className="w-12 h-12 rounded-xl border border-[#1e293b] bg-[#03080b] flex items-center justify-center mb-1">
                      <m.icon className={`w-5 h-5 ${m.status === 'active' ? 'text-[#00d4ff]' : 'text-[#f0b429]'}`} />
                    </div>
                    <span className="text-[10px] text-[#f1f5f9]">{m.name}</span>
                    <Badge className={`text-[8px] mt-0.5 ${m.status === 'active' ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-[#f0b429]/10 text-[#f0b429]'}`}>{m.status}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-4 border-[#1e293b] bg-[#111c21]/80 backdrop-blur">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#94a3b8]">Live Telemetry</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "CPU Load", value: "12%" },
              { label: "Memory", value: "4.2 GB" },
              { label: "Active Providers", value: "5" },
              { label: "Pending Reviews", value: "0" },
              { label: "Uptime", value: "99.9%" },
            ].map((s) => (
              <div key={s.label} className="flex justify-between p-2 rounded bg-[#03080b] border border-[#1e293b]">
                <span className="text-xs text-[#94a3b8]">{s.label}</span>
                <span className="text-xs font-medium text-[#f1f5f9]">{s.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

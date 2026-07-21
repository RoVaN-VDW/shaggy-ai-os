"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { CockpitResourceState } from "@/hooks/cockpit-resource-status";
import { resolveChartState } from "../../visualization/chart-contract";
import type { DailyUsagePoint } from "../../visualization/chart-model";
import { SemanticChartFrame } from "./SemanticChartFrame";

export function SystemUsageTrend({ data, resource }: { data: DailyUsagePoint[]; resource: CockpitResourceState }) {
  const state = resolveChartState(resource, data.length, 2);
  return (
    <SemanticChartFrame state={state} title="30-day system usage" className="dream-usage-trend">
      <ResponsiveContainer width="100%" height={86}>
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs><linearGradient id="dreamUsageFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#55e9ff" stopOpacity={0.34} /><stop offset="100%" stopColor="#55e9ff" stopOpacity={0} /></linearGradient></defs>
          <XAxis dataKey="day" tickFormatter={(day) => day.slice(5)} axisLine={false} tickLine={false} minTickGap={26} tick={{ fill: "rgba(220,244,255,.48)", fontSize: 8 }} />
          <Tooltip cursor={{ stroke: "rgba(85,233,255,.22)" }} contentStyle={{ background: "#07131b", border: "1px solid rgba(85,233,255,.2)", borderRadius: 10, fontSize: 10 }} formatter={(value) => [`€${Number(value).toFixed(2)}`, "Spend"]} />
          <Area type="monotone" dataKey="cost" stroke="#55e9ff" strokeWidth={2} fill="url(#dreamUsageFill)" dot={false} activeDot={{ r: 3 }} isAnimationActive />
        </AreaChart>
      </ResponsiveContainer>
    </SemanticChartFrame>
  );
}

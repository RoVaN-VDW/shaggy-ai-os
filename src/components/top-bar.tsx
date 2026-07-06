"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, User } from "lucide-react";

export function TopBar() {
  return (
    <header className="h-14 border-b border-[#1e293b] bg-[#0a0f1e]/80 backdrop-blur flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-[#00d4ff] font-semibold tracking-widest text-sm uppercase">S.H.A.G.G.Y.</span>
        <Badge variant="outline" className="border-[#00d4ff]/30 text-[#00d4ff] text-[10px]">v0.1</Badge>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
          <Shield className="w-3.5 h-3.5 text-[#00d4ff]" />
          <span>Manual Mode</span>
        </div>
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full border border-[#1e293b]">
          <User className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}

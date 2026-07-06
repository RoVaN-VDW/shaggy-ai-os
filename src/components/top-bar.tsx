"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, User, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function TopBar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-primary font-semibold tracking-widest text-sm uppercase">S.H.A.G.G.Y.</span>
        <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">v0.1</Badge>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="w-3.5 h-3.5 text-primary" />
          <span>Manual Mode</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 rounded-full border border-border"
          onClick={toggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full border border-border">
          <User className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}

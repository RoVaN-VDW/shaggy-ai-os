"use client";

import { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { NavRail } from "./nav-rail";
import { TopBar } from "./top-bar";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <div className="shaggy-screen flex bg-background text-foreground">
        <NavRail />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-hidden p-4">
            {children}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}

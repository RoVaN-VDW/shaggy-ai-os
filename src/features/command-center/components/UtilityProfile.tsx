"use client";

import { Bell, HardDrive, Moon, Sparkles, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function UtilityProfile() {
  const { theme, toggleTheme } = useTheme();
  const iconButton = "grid size-9 place-items-center rounded-full border border-[var(--dream-glass-stroke)] bg-white/[0.025] text-[var(--dream-muted)] transition-colors duration-[var(--dream-motion-micro)] hover:border-[color-mix(in_srgb,var(--dream-cyan)_35%,transparent)] hover:text-[var(--dream-cyan-hot)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dream-cyan)]";

  return (
    <div className="flex h-full items-center justify-end gap-2" data-dream-region="utility-profile">
      <div className="mr-1 flex items-center gap-2 border-r border-[var(--dream-glass-stroke)] pr-3 text-[12px] uppercase tracking-[0.12em] text-[var(--dream-muted)]">
        <Sparkles className="size-4 text-[var(--dream-gold)]" aria-hidden="true" /> Manual
      </div>
      <button type="button" className={iconButton} onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
        {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </button>
      <div className={`${iconButton} relative`} aria-label="Notifications unavailable" role="status">
        <Bell className="size-4" aria-hidden="true" />
        <span className="absolute right-1 top-1 size-1.5 rounded-full bg-[var(--dream-warning)]" />
      </div>
      <div className="ml-1 grid size-10 place-items-center rounded-full border border-[color-mix(in_srgb,var(--dream-gold)_48%,transparent)] bg-[radial-gradient(circle_at_35%_28%,rgba(255,211,106,.28),rgba(7,18,27,.9)_56%)] text-sm font-semibold text-[var(--dream-gold-hot)] shadow-[var(--dream-glow-gold)]" aria-hidden="true">R</div>
      <div className="min-w-20 leading-tight"><div className="text-[13px] text-[var(--dream-text)]">Ronald</div><div className="mt-1 text-[11px] text-[var(--dream-muted)]">Commander</div></div>
      <div className={iconButton} aria-label="Local-only runtime" role="status" title="Local-only runtime"><HardDrive className="size-4" /></div>
    </div>
  );
}
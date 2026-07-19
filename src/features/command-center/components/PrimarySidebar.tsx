"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Bot, Boxes, BrainCircuit, ChartNoAxesCombined, CloudCog, FolderKanban,
  Home, MessageCircle, Network, Orbit, PanelsTopLeft, Settings, ShieldCheck, WandSparkles,
} from "lucide-react";
import { PRIMARY_NAV_ITEMS } from "../shell-contract";

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  projects: FolderKanban,
  chat: MessageCircle,
  knowledge: BrainCircuit,
  twin: Network,
  automation: Bot,
  creative: WandSparkles,
  workflow: Orbit,
  growth: ChartNoAxesCombined,
  build: CloudCog,
  reports: PanelsTopLeft,
  models: Boxes,
  security: ShieldCheck,
  settings: Settings,
};

export function PrimarySidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="dream-glass-panel flex h-full flex-col gap-0.5 p-2" data-dream-region="primary-sidebar">
      {PRIMARY_NAV_ITEMS.map((item) => {
        const Icon = ICONS[item.icon];
        const active = item.href === "/" ? pathname === "/" : Boolean(item.href && pathname.startsWith(item.href));
        const availabilityLabel = item.availability === "available" ? "Available" : "Planned";
        const content = <><Icon className="size-4 shrink-0" aria-hidden="true" /><span className="whitespace-nowrap">{item.label}</span><span className={`ml-auto text-[11px] font-semibold uppercase tracking-[0.08em] ${item.availability === "available" ? "text-[var(--dream-success)]" : "text-[var(--dream-subtle)]"}`}>{availabilityLabel}</span></>;

        if (!item.enabled || !item.href) {
          return <div key={item.label} aria-disabled="true" title={`${item.label} — ${availabilityLabel}`} className="flex h-9 cursor-not-allowed items-center gap-2.5 rounded-lg px-3 text-[12px] text-[var(--dream-subtle)]">{content}</div>;
        }

        return (
          <Link key={item.label} href={item.href} aria-current={active ? "page" : undefined} className={`flex h-9 items-center gap-2.5 rounded-lg border px-3 text-[12px] transition-[background-color,border-color,color,box-shadow] duration-[var(--dream-motion-micro)] ${active ? "border-[color-mix(in_srgb,var(--dream-gold)_38%,transparent)] bg-[linear-gradient(90deg,rgba(240,180,41,.14),rgba(240,180,41,.04))] text-[var(--dream-gold-hot)] shadow-[inset_3px_0_12px_rgba(240,180,41,.14)]" : "border-transparent text-[var(--dream-muted)] hover:border-[var(--dream-glass-stroke)] hover:bg-white/[0.025] hover:text-[var(--dream-text)]"}`}>
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
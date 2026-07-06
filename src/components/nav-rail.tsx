"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  FolderKanban,
  MessageSquare,
  FileText,
  Upload,
  BookOpen,
  Sparkles,
  Palette,
  Network,
  ClipboardCheck,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { name: "Cockpit", href: "/", icon: LayoutDashboard },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Chat", href: "/chat", icon: MessageSquare },
  { name: "Artifacts", href: "/artifacts", icon: FileText },
  { name: "Uploads", href: "/uploads", icon: Upload },
  { name: "Knowledge", href: "/knowledge", icon: BookOpen },
  { name: "Prompts", href: "/prompts", icon: Sparkles },
  { name: "Creative", href: "/creative", icon: Palette },
  { name: "Twin", href: "/twin", icon: Network },
  { name: "Review", href: "/review", icon: ClipboardCheck },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function NavRail() {
  const pathname = usePathname();

  return (
    <nav className="w-16 flex flex-col items-center py-4 border-r border-[#1e293b] bg-[#050505] shrink-0">
      <div className="mb-6 text-[#00d4ff] font-bold text-lg tracking-tight">S</div>
      <div className="flex-1 flex flex-col gap-2 w-full px-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link key={item.name} href={item.href} className="relative group flex justify-center py-2">
              <Icon
                className={cn(
                  "w-5 h-5 transition-colors",
                  active ? "text-[#00d4ff]" : "text-[#94a3b8] group-hover:text-[#f1f5f9]"
                )}
              />
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 rounded-md bg-[#00d4ff]/10 border border-[#00d4ff]/30"
                />
              )}
              <span className="sr-only">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

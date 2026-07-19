export type PrimaryNavItem = {
  label: string;
  icon: string;
  href: string | null;
  enabled: boolean;
  availability: "available" | "planned";
};

export const PRIMARY_NAV_ITEMS = [
  { label: "Command Center", icon: "home", href: "/", enabled: true, availability: "available" },
  { label: "Projects", icon: "projects", href: "/projects", enabled: true, availability: "available" },
  { label: "Chat Studio", icon: "chat", href: "/chat", enabled: true, availability: "available" },
  { label: "Knowledge Brain", icon: "knowledge", href: "/knowledge", enabled: true, availability: "available" },
  { label: "Digital Twin", icon: "twin", href: "/twin", enabled: true, availability: "available" },
  { label: "Automation Hub", icon: "automation", href: "/review", enabled: true, availability: "available" },
  { label: "Creative Studio", icon: "creative", href: "/creative", enabled: true, availability: "available" },
  { label: "Workflow Studio", icon: "workflow", href: null, enabled: false, availability: "planned" },
  { label: "Growth Center", icon: "growth", href: null, enabled: false, availability: "planned" },
  { label: "Build & Deploy", icon: "build", href: null, enabled: false, availability: "planned" },
  { label: "Reports & Insights", icon: "reports", href: null, enabled: false, availability: "planned" },
  { label: "Models & Costs", icon: "models", href: "/models", enabled: true, availability: "available" },
  { label: "Security & Backup", icon: "security", href: null, enabled: false, availability: "planned" },
  { label: "Settings", icon: "settings", href: "/settings", enabled: true, availability: "available" },
] as const satisfies readonly PrimaryNavItem[];

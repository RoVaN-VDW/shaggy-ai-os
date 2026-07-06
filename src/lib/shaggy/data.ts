import {
  Archive,
  BrainCircuit,
  Brush,
  CheckCircle2,
  CircleDollarSign,
  Cloud,
  Code2,
  Database,
  FileText,
  Fingerprint,
  FolderKanban,
  GitBranch,
  Home,
  Layers3,
  LockKeyhole,
  MessageSquareText,
  Network,
  Radar,
  Settings,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Workflow,
  type LucideIcon,
} from "lucide-react"

export type SystemMode = "Manual" | "Autopilot" | "Lockdown"

export type NavItem = {
  label: string
  icon: LucideIcon
  state: "live" | "draft" | "queued" | "locked"
}

export type ProjectSeed = {
  name: string
  status: string
  signal: string
  nextAction: string
  progress: number
  accent: string
}

export type ModelRoute = {
  model: string
  role: string
  status: "ready" | "placeholder" | "to verify"
  costSignal: string
}

export type ReviewItem = {
  title: string
  risk: number
  mode: SystemMode
  why: string
}

export const navigation: NavItem[] = [
  { label: "Home Cockpit", icon: Home, state: "live" },
  { label: "Projects", icon: FolderKanban, state: "live" },
  { label: "Chat Studio", icon: MessageSquareText, state: "draft" },
  { label: "Artifacts", icon: FileText, state: "draft" },
  { label: "Knowledge Rooms", icon: Database, state: "draft" },
  { label: "Prompt Intelligence", icon: BrainCircuit, state: "draft" },
  { label: "Creative Studio", icon: Brush, state: "queued" },
  { label: "Digital Twin", icon: Network, state: "queued" },
  { label: "Workflow Studio", icon: Workflow, state: "queued" },
  { label: "Automation Hub", icon: Radar, state: "locked" },
  { label: "Growth Command", icon: Sparkles, state: "queued" },
  { label: "Build & Deployment", icon: Cloud, state: "draft" },
  { label: "Security / Backup", icon: ShieldCheck, state: "live" },
  { label: "Review Queue", icon: CheckCircle2, state: "live" },
  { label: "Models & Costs", icon: CircleDollarSign, state: "draft" },
  { label: "Settings", icon: Settings, state: "draft" },
]

export const projectSeeds: ProjectSeed[] = [
  {
    name: "AI Command OS",
    status: "Kernel build",
    signal: "SHAGGY replaces ALFRED only after Ronald confirms v0.1 coverage.",
    nextAction: "Finish cockpit, review queue, model routes, and trace logging.",
    progress: 62,
    accent: "from-cyan-400 to-blue-500",
  },
  {
    name: "MoveID",
    status: "Active product",
    signal: "Keep knowledge traceable across Codex, Hermes, Kimi, and Gemini.",
    nextAction: "Expose project handoff, next actions, artifacts, and launch checks.",
    progress: 54,
    accent: "from-amber-300 to-orange-500",
  },
  {
    name: "AI Immo Agency",
    status: "Growth track",
    signal: "Prompt and content systems need reusable, rated production flows.",
    nextAction: "Prepare creative prompts, SEO/GEO tasks, and asset rooms.",
    progress: 38,
    accent: "from-emerald-300 to-teal-500",
  },
]

export const modelRoutes: ModelRoute[] = [
  {
    model: "Hermes",
    role: "Primary orchestration and local operating protocol",
    status: "ready",
    costSignal: "Local-first",
  },
  {
    model: "Codex",
    role: "Implementation, verification, and codebase changes",
    status: "ready",
    costSignal: "Task-based",
  },
  {
    model: "Kimi Code 2.7",
    role: "Long-context implementation and repo continuation",
    status: "placeholder",
    costSignal: "To profile",
  },
  {
    model: "Gemini",
    role: "Long-context review, spec comparison, and research synthesis",
    status: "placeholder",
    costSignal: "To profile",
  },
  {
    model: "Antigravity",
    role: "Orchestration and multi-surface build support",
    status: "to verify",
    costSignal: "Unknown",
  },
]

export const reviewQueue: ReviewItem[] = [
  {
    title: "External connector action",
    risk: 72,
    mode: "Manual",
    why: "Could publish, send, deploy, or mutate third-party state.",
  },
  {
    title: "Permanent memory write",
    risk: 58,
    mode: "Manual",
    why: "Requires Ronald approval before becoming durable knowledge.",
  },
  {
    title: "Production deployment",
    risk: 81,
    mode: "Lockdown",
    why: "Needs sandbox, QA evidence, rollback plan, and explicit approval.",
  },
]

export const cockpitMetrics = [
  { label: "Active projects", value: "3", detail: "seeded in v0.1", icon: Layers3 },
  { label: "System mode", value: "Manual", detail: "approval first", icon: LockKeyhole },
  { label: "Trace policy", value: "On", detail: "important actions", icon: GitBranch },
  { label: "Data boundary", value: "Private", detail: "no silent exits", icon: Fingerprint },
]

export const knowledgeRooms = [
  { room: "Company OS", sources: 18, status: "verified core" },
  { room: "MoveID Product", sources: 27, status: "needs live sync" },
  { room: "Prompt Lab", sources: 44, status: "rating pending" },
  { room: "Creative Assets", sources: 12, status: "classification draft" },
]

export const promptProfiles = [
  { engine: "Code", score: 8.9, pattern: "spec first, small patch, verify" },
  { engine: "Image", score: 7.6, pattern: "shot intent, subject, lighting, constraints" },
  { engine: "Video", score: 7.2, pattern: "scene beat, motion, continuity, negative space" },
  { engine: "Research", score: 8.1, pattern: "source class, freshness, confidence, gaps" },
]

export const artifactVersions = [
  { title: "SHAGGY build log", type: "Markdown", version: "v0.1-draft" },
  { title: "Project handoff export", type: "JSON", version: "schema-ready" },
  { title: "Cockpit preview", type: "HTML", version: "local" },
]

export const securityPolicies = [
  "No sensitive data leaves without approval.",
  "No irreversible action without simulation and approval.",
  "No permanent memory write without approval.",
  "No production deployment without sandbox, QA, and rollback.",
]

export const companionContracts = [
  { label: "Supabase", value: "Schema ready, keys pending", icon: Database },
  { label: "Upload Hub", value: "Classification path drafted", icon: UploadCloud },
  { label: "Export", value: "JSON and Markdown foundation", icon: Archive },
  { label: "Adapters", value: "Provider placeholders", icon: Code2 },
]

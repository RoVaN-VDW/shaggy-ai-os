import type { AuthBoundaryStatus } from "@/lib/auth/auth-boundary";

export type SystemStatusTone = "success" | "warning" | "error" | "muted";

export type SystemStatusItem = {
  label: string;
  value: string;
  tone: SystemStatusTone;
  evidence: string;
};

type SystemStatusInput = {
  auth: {
    status: AuthBoundaryStatus;
    hasSession: boolean;
    checkedAt: string | null;
    error: string | null;
  };
  resources: Array<{ status: string }>;
};

export function buildSystemStatusModel({ auth }: SystemStatusInput): SystemStatusItem[] {
  if (auth.status === "authorized" && auth.checkedAt) {
    return [
      {
        label: "Session",
        value: "Authenticated",
        tone: "success",
        evidence: `supabase:auth · ${auth.checkedAt}`,
      },
      {
        label: "Access policy",
        value: "Allowlisted",
        tone: "success",
        evidence: `supabase:is_shaggy_authorized · ${auth.checkedAt}`,
      },
    ];
  }

  if (auth.status === "forbidden" && auth.hasSession && auth.checkedAt) {
    return [
      {
        label: "Session",
        value: "Authenticated",
        tone: "success",
        evidence: `supabase:auth · ${auth.checkedAt}`,
      },
      {
        label: "Access policy",
        value: "Blocked",
        tone: "error",
        evidence: `supabase:is_shaggy_authorized · ${auth.checkedAt}`,
      },
    ];
  }

  if (auth.status === "error" && auth.hasSession && auth.checkedAt) {
    return [
      {
        label: "Session",
        value: "Authenticated",
        tone: "success",
        evidence: `supabase:auth · ${auth.checkedAt}`,
      },
      {
        label: "Access policy",
        value: "Verification unavailable",
        tone: "error",
        evidence: `supabase:is_shaggy_authorized · ${auth.checkedAt} · ${auth.error ?? "unknown error"}`,
      },
    ];
  }

  return [
    { label: "Session", value: "Unavailable", tone: "muted", evidence: "supabase:auth · not verified" },
    { label: "Access policy", value: "Unavailable", tone: "muted", evidence: "supabase:is_shaggy_authorized · not verified" },
  ];
}

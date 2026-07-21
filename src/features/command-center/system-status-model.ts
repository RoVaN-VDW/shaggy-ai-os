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
        label: "Runtime",
        value: "Local only",
        tone: "success",
        evidence: `loopback-host-policy · ${auth.checkedAt}`,
      },
      {
        label: "Access policy",
        value: "Local owner",
        tone: "success",
        evidence: `local-owner · ${auth.checkedAt}`,
      },
    ];
  }

  if (auth.status === "forbidden" && auth.checkedAt) {
    return [
      {
        label: "Runtime",
        value: "Blocked",
        tone: "error",
        evidence: `loopback-host-policy · ${auth.checkedAt}`,
      },
      {
        label: "Access policy",
        value: "Denied",
        tone: "error",
        evidence: `local-owner · ${auth.checkedAt} · ${auth.error ?? "non-local request"}`,
      },
    ];
  }

  if (auth.status === "error" && auth.checkedAt) {
    return [
      {
        label: "Runtime",
        value: "Verification unavailable",
        tone: "error",
        evidence: `loopback-host-policy · ${auth.checkedAt} · ${auth.error ?? "unknown error"}`,
      },
      {
        label: "Access policy",
        value: "Unavailable",
        tone: "muted",
        evidence: `local-owner · ${auth.checkedAt} · not verified`,
      },
    ];
  }

  return [
    { label: "Runtime", value: "Checking", tone: "muted", evidence: "loopback-host-policy · not verified" },
    { label: "Access policy", value: "Unavailable", tone: "muted", evidence: "local-owner · not verified" },
  ];
}

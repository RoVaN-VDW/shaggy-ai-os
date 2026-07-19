export type AuthBoundaryStatus =
  | "checking"
  | "anonymous"
  | "authorized"
  | "forbidden"
  | "error";

type AuthBoundaryEvidence = {
  hasSession: boolean;
  allowlisted: boolean | null;
  error: string | null;
};

export function resolveAuthBoundaryState({
  hasSession,
  allowlisted,
  error,
}: AuthBoundaryEvidence): AuthBoundaryStatus {
  if (error) return "error";
  if (!hasSession) return "anonymous";
  if (allowlisted === null) return "checking";
  return allowlisted ? "authorized" : "forbidden";
}

export function canAccessCockpitData(status: AuthBoundaryStatus): boolean {
  return status === "authorized";
}

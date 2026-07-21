export type LocalAccessReason =
  | "loopback-read"
  | "loopback-mutation"
  | "missing-host"
  | "non-loopback-host"
  | "missing-origin"
  | "invalid-origin"
  | "cross-origin";

export type LocalAccessDecision = {
  authorized: boolean;
  reason: LocalAccessReason;
};

type LocalAccessEvidence = {
  host: string | null;
  origin: string | null;
  method: string;
};

type ParsedAuthority = {
  hostname: string;
  authority: string;
};

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
}

function parseAuthority(host: string | null): ParsedAuthority | null {
  if (!host) return null;
  try {
    const url = new URL(`http://${host}`);
    if (url.username || url.password || url.pathname !== "/") return null;
    return {
      hostname: normalizeHostname(url.hostname),
      authority: url.host.toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

export function resolveLocalAccess({ host, origin, method }: LocalAccessEvidence): LocalAccessDecision {
  const requestAuthority = parseAuthority(host);
  if (!requestAuthority) return { authorized: false, reason: "missing-host" };
  if (!isLoopbackHostname(requestAuthority.hostname)) {
    return { authorized: false, reason: "non-loopback-host" };
  }

  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === "GET" || normalizedMethod === "HEAD") {
    return { authorized: true, reason: "loopback-read" };
  }

  if (!origin) return { authorized: false, reason: "missing-origin" };

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return { authorized: false, reason: "invalid-origin" };
  }

  if (
    !isLoopbackHostname(originUrl.hostname)
    || originUrl.host.toLowerCase() !== requestAuthority.authority
    || (originUrl.protocol !== "http:" && originUrl.protocol !== "https:")
  ) {
    return { authorized: false, reason: "cross-origin" };
  }

  return { authorized: true, reason: "loopback-mutation" };
}

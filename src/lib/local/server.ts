import "server-only";

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { resolveLocalAccess } from "@/lib/local/access";
import { OWNER_COOKIE_NAME, OWNER_SECRET_PATH, verifyOwnerSession } from "@/lib/local/owner-capability";

export type LocalOwner = {
  id: "local-owner";
  role: "owner";
};

function localBoundary(req: NextRequest) {
  const decision = resolveLocalAccess({
    host: req.headers.get("host"),
    origin: req.headers.get("origin"),
    method: req.method,
  });

  if (!decision.authorized) {
    return {
      error: NextResponse.json(
        { error: "Local access required", reason: decision.reason },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  return null;
}

async function requireOwnerCapability(req: NextRequest) {
  const hasOwnerSession = await verifyOwnerSession(
    OWNER_SECRET_PATH,
    req.cookies.get(OWNER_COOKIE_NAME)?.value,
  );
  if (!hasOwnerSession) {
    return {
      error: NextResponse.json(
        { error: "Local owner session required", reason: "missing-owner-session" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  return {
    user: { id: "local-owner", role: "owner" } satisfies LocalOwner,
    checkedAt: new Date().toISOString(),
    source: "owner-capability" as const,
  };
}

function hasValidUsageSyncToken(req: NextRequest) {
  const configured = process.env.SHAGGY_USAGE_TOKEN;
  const authorization = req.headers.get("authorization");
  if (!configured || !authorization?.startsWith("Bearer ")) {
    return false;
  }
  const configuredByteLength = Buffer.byteLength(configured, "utf8");
  if (configuredByteLength < 32 || configuredByteLength > 512) {
    return false;
  }
  const provided = authorization.slice("Bearer ".length);
  const expectedBytes = Buffer.from(configured, "utf8");
  const providedBytes = Buffer.from(provided, "utf8");
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

export async function requireLocalAccess(req: NextRequest) {
  const boundaryError = localBoundary(req);
  if (boundaryError) return boundaryError;
  return requireOwnerCapability(req);
}

export async function requireLocalUsageIngestAccess(req: NextRequest) {
  const boundaryError = localBoundary(req);
  if (boundaryError) return boundaryError;
  if (hasValidUsageSyncToken(req)) {
    return {
      user: { id: "local-owner", role: "owner" } satisfies LocalOwner,
      checkedAt: new Date().toISOString(),
      source: "sync-token" as const,
    };
  }
  return requireOwnerCapability(req);
}

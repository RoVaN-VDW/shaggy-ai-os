import { NextRequest, NextResponse } from "next/server";

import { readBoundedJson } from "@/lib/api/security";
import { resolveLocalAccess } from "@/lib/local/access";
import {
  consumePairToken,
  createOwnerSession,
  OWNER_COOKIE_NAME,
  OWNER_PAIR_PATH,
  OWNER_SECRET_PATH,
  OWNER_SESSION_TTL_MS,
  verifyOwnerSession,
} from "@/lib/local/owner-capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function localDecision(req: NextRequest) {
  return resolveLocalAccess({
    host: req.headers.get("host"),
    origin: req.headers.get("origin"),
    method: req.method,
  });
}

function denied(status = 403) {
  return NextResponse.json(
    { error: "Local owner session required" },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(req: NextRequest) {
  if (!localDecision(req).authorized) return denied();
  const valid = await verifyOwnerSession(OWNER_SECRET_PATH, req.cookies.get(OWNER_COOKIE_NAME)?.value);
  return valid
    ? NextResponse.json({ authorized: true }, { headers: { "Cache-Control": "no-store" } })
    : denied(401);
}

export async function POST(req: NextRequest) {
  if (!localDecision(req).authorized) return denied();
  const parsed = await readBoundedJson(req);
  if (parsed.error) return parsed.error;
  if (!await consumePairToken(OWNER_PAIR_PATH, parsed.body.token)) return denied();

  const session = await createOwnerSession();
  const response = NextResponse.json({ authorized: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(OWNER_COOKIE_NAME, session, {
    httpOnly: true,
    sameSite: "strict",
    secure: false,
    path: "/",
    maxAge: Math.floor(OWNER_SESSION_TTL_MS / 1000),
  });
  return response;
}

export async function DELETE(req: NextRequest) {
  if (!localDecision(req).authorized) return denied();
  const response = NextResponse.json({ authorized: false }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(OWNER_COOKIE_NAME, "", { httpOnly: true, sameSite: "strict", secure: false, path: "/", maxAge: 0 });
  return response;
}

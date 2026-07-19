import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/security";
import { parseSecondBrainSnapshot } from "@/lib/second-brain/snapshot";
import { requireAuth } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "second-brain", 30);
  if (limited) return limited;

  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const snapshotPath = resolve(
    process.env.SECOND_BRAIN_SNAPSHOT_PATH
      ?? resolve(process.cwd(), ".hermes/runtime/second-brain-snapshot.json"),
  );
  try {
    const snapshot = parseSecondBrainSnapshot(JSON.parse(await readFile(snapshotPath, "utf8")));
    return NextResponse.json(
      { ok: true, snapshot },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Second Brain snapshot unavailable", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        error: "Local Second Brain snapshot source is unavailable.",
        availability: "local-only",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

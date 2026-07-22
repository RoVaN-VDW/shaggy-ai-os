import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/security";
import { readLocalUsageLedger } from "@/lib/usage/local-ledger";
import { requireLocalAccess } from "@/lib/local/server";
import { parseLocalActivitySnapshot } from "@/lib/local/activity-readplane";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ACTIVITY_WINDOW_DAYS = 30;

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(req: NextRequest) {
  const access = await requireLocalAccess(req);
  if (access.error) return noStore(access.error);

  const limited = rateLimit(req, "local-activity", 60);
  if (limited) return noStore(limited);

  try {
    const ledger = await readLocalUsageLedger(ACTIVITY_WINDOW_DAYS);
    const snapshot = parseLocalActivitySnapshot(ledger);
    return NextResponse.json(
      {
        ok: true,
        source: snapshot.source,
        observedAt: snapshot.observedAt,
        truncated: false,
        activity: snapshot.activity,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("Activity feed is unavailable");
    return NextResponse.json(
      {
        error: "Activity feed is unavailable.",
        availability: "local-only",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

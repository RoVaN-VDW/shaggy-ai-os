import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/security";
import { readLocalUsageLedger } from "@/lib/usage/local-ledger";
import { requireLocalAccess } from "@/lib/local/server";
import { parseLocalProvidersSnapshot } from "@/lib/local/providers-readplane";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The collector retains provider usage by day. Use its full supported window so
// dormant observed providers remain discoverable without creating a second store.
const PROVIDER_INVENTORY_DAYS = 400;

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(req: NextRequest) {
  const access = await requireLocalAccess(req);
  if (access.error) return noStore(access.error);

  const limited = rateLimit(req, "local-providers", 60);
  if (limited) return noStore(limited);

  try {
    const ledger = await readLocalUsageLedger(PROVIDER_INVENTORY_DAYS);
    const snapshot = parseLocalProvidersSnapshot(ledger);
    return NextResponse.json(
      {
        ok: true,
        source: snapshot.source,
        observedAt: snapshot.observedAt,
        truncated: false,
        providers: snapshot.providers,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("Provider inventory is unavailable");
    return NextResponse.json(
      {
        error: "Provider inventory is unavailable.",
        availability: "local-only",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

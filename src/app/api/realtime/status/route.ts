import { NextRequest, NextResponse } from "next/server";

import { getRealtimeAvailability, REALTIME_MODEL, REALTIME_VOICES } from "@/features/voice/realtime-contract";
import { requireAuth } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const availability = getRealtimeAvailability({
    enabled: process.env.SHAGGY_REALTIME_ENABLED === "true",
    hasApiKey: Boolean(process.env.OPENAI_API_KEY),
  });

  return NextResponse.json(
    {
      ...availability,
      model: REALTIME_MODEL,
      voices: REALTIME_VOICES,
      mode: "push_to_talk",
      storesAudio: false,
      routesTools: false,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

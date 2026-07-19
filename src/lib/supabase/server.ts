import "server-only";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service role configuration");
  return createClient(url, key);
}

export async function requireAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { error: NextResponse.json({ error: "Authentication is not configured" }, { status: 503 }) };
  }
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user) {
    return { error: NextResponse.json({ error: "Invalid session" }, { status: 401 }) };
  }

  const { data: authorized, error: authorizationError } = await userClient.rpc("is_shaggy_authorized");
  if (authorizationError || authorized !== true) {
    return { error: NextResponse.json({ error: "Access is not authorized" }, { status: 403 }) };
  }
  return { user, client: userClient };
}

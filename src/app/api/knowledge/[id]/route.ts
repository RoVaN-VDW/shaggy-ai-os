import { NextRequest, NextResponse } from "next/server";
import { rateLimit, validateUuid } from "@/lib/api/security";
import { getSupabaseAdmin, requireAuth } from "@/lib/supabase/server";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, "knowledge-delete", 12);
  if (limited) return limited;

  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const idError = validateUuid(id, "document id");
  if (idError) {
    return NextResponse.json({ error: idError }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: document, error: documentError } = await supabaseAdmin
    .from("knowledge_docs")
    .select("id, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (documentError) {
    console.error("Knowledge document lookup failed", { documentId: id });
    return NextResponse.json({ error: "Document could not be removed." }, { status: 500 });
  }
  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const { error: metadataError } = await supabaseAdmin
    .from("knowledge_docs")
    .delete()
    .eq("id", id);

  if (metadataError) {
    console.error("Knowledge metadata deletion failed", { documentId: id });
    return NextResponse.json({ error: "Document metadata could not be removed." }, { status: 500 });
  }

  if (document.storage_path) {
    const { error: storageError } = await supabaseAdmin.storage
      .from("knowledge").remove([document.storage_path]);

    if (storageError) {
      console.error("Knowledge object cleanup pending", { documentId: id });
      return NextResponse.json(
        {
          ok: true,
          id,
          cleanup: "pending",
          warning: "Document removed; private storage cleanup is pending.",
        },
        { status: 202 },
      );
    }
  }

  return NextResponse.json({ ok: true, id, cleanup: "complete" });
}

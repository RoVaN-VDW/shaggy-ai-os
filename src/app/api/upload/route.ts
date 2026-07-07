import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, requireAuth } from "@/lib/supabase/server";

async function extractTextPreview(file: File, bytes: ArrayBuffer, maxChars: number): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "txt" || ext === "md" || ext === "markdown") {
    return new TextDecoder().decode(bytes).slice(0, maxChars);
  }
  if (ext === "pdf") {
    return `[PDF: ${file.name}] — text extraction pending`;
  }
  return `[${file.type || ext}] ${file.name}`;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowed = ["application/pdf", "text/plain", "text/markdown"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (
      !allowed.includes(file.type) &&
      ext !== "md" &&
      ext !== "markdown" &&
      ext !== "txt" &&
      ext !== "pdf"
    ) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const path = `docs/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;

    const supabaseAdmin = getSupabaseAdmin();

    const { error: uploadError } = await supabaseAdmin.storage
      .from("knowledge")
      .upload(path, Buffer.from(bytes), {
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const contentPreview = await extractTextPreview(file, bytes, 3000);

    const { error: dbError } = await supabaseAdmin.from("knowledge_docs").insert({
      name: file.name,
      file_type: file.type || ext || "unknown",
      size_bytes: file.size,
      storage_path: path,
      embedding_status: "pending",
      project_id: projectId || null,
      content_preview: contentPreview,
      content_text: contentPreview,
    });

    if (dbError) {
      await supabaseAdmin.storage.from("knowledge").remove([path]);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, path, name: file.name });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 500 });
  }
}

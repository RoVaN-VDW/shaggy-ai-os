import { after, NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, requireAuth } from "@/lib/supabase/server";
import { rateLimit, validateOptionalUuid } from "@/lib/api/security";
import { embedDocument } from "@/lib/knowledge/embed-document";

export const maxDuration = 20;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_INDEXED_CHARACTERS = 3_000;
const MAX_INDEXED_PDF_PAGES = 10;

import * as pdfjs from "pdfjs-dist";

async function extractTextFromPDF(bytes: ArrayBuffer, maxChars: number): Promise<string> {
  try {
    const data = new Uint8Array(bytes);
    const loadingTask = pdfjs.getDocument({ data });
    const pdf = await loadingTask.promise;
    let text = "";
    for (let i = 1; i <= Math.min(pdf.numPages, MAX_INDEXED_PDF_PAGES); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items
        .map((item) => ("str" in item ? (item as { str?: string }).str || "" : ""))
        .join(" ") + "\n";
      if (text.length >= maxChars) break;
    }
    return text.slice(0, maxChars).trim();
  } catch (e) {
    console.error("PDF extraction failed", e);
    return `[PDF: text extraction failed]`;
  }
}

async function extractTextPreview(file: File, bytes: ArrayBuffer, maxChars: number): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "txt" || ext === "md" || ext === "markdown") {
    return new TextDecoder().decode(bytes).slice(0, maxChars);
  }
  if (ext === "pdf") {
    return extractTextFromPDF(bytes, maxChars);
  }
  return `[${file.type || ext}] ${file.name}`;
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "upload", 8);
  if (limited) return limited;

  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File is too large. Maximum size is 10MB." }, { status: 413 });
    }

    const projectError = validateOptionalUuid(projectId);
    if (projectError) {
      return NextResponse.json({ error: projectError }, { status: 400 });
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
      return NextResponse.json({ error: "Upload failed." }, { status: 500 });
    }

    const contentPreview = await extractTextPreview(file, bytes, MAX_INDEXED_CHARACTERS);

    const { data: inserted, error: dbError } = await supabaseAdmin
      .from("knowledge_docs")
      .insert({
        name: file.name,
        file_type: file.type || ext || "unknown",
        size_bytes: file.size,
        storage_path: path,
        embedding_status: "pending",
        project_id: projectId || null,
        content_preview: contentPreview,
        content_text: contentPreview,
      })
      .select("id, name, file_type, size_bytes, storage_path, embedding_status, created_at")
      .single();

    if (dbError) {
      await supabaseAdmin.storage.from("knowledge").remove([path]);
      return NextResponse.json({ error: "Upload metadata could not be saved." }, { status: 500 });
    }

    if (inserted?.id) {
      after(async () => {
        try {
          await embedDocument(inserted.id);
        } catch {
          console.error("Background embedding failed");
        }
      });
    }

    return NextResponse.json({ ok: true, document: inserted });
  } catch {
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/server";
import { publicError, rateLimit, validateJsonSize, validateUuid } from "@/lib/api/security";
import {
  embedDocument,
  EmptyKnowledgeDocumentError,
  KnowledgeDocumentNotFoundError,
} from "@/lib/knowledge/embed-document";

export const maxDuration = 20;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "embed", 8);
  if (limited) return limited;
  const tooLarge = validateJsonSize(req);
  if (tooLarge) return tooLarge;

  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const { docId } = (await req.json()) as { docId: string };
    const docIdError = validateUuid(docId, "document id");
    if (docIdError) {
      return NextResponse.json({ error: docIdError }, { status: 400 });
    }

    const chunkCount = await embedDocument(docId);
    return NextResponse.json({ ok: true, chunks: chunkCount });
  } catch (err) {
    if (err instanceof KnowledgeDocumentNotFoundError) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    if (err instanceof EmptyKnowledgeDocumentError) {
      return NextResponse.json({ error: "No text to embed" }, { status: 400 });
    }
    console.error("Embedding failed", err);
    return NextResponse.json({ error: publicError(err, "Embedding failed.") }, { status: 500 });
  }
}

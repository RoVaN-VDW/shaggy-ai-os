import OpenAI from "openai";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const EMBEDDING_TIMEOUT_MS = 15_000;

export class KnowledgeDocumentNotFoundError extends Error {
  constructor() {
    super("Document not found");
    this.name = "KnowledgeDocumentNotFoundError";
  }
}

export class EmptyKnowledgeDocumentError extends Error {
  constructor() {
    super("No text to embed");
    this.name = "EmptyKnowledgeDocumentError";
  }
}

function chunkText(text: string, maxChars: number = 1500, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start >= end) start = end;
  }

  return chunks.filter(Boolean);
}

async function markEmbeddingError(docId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("knowledge_docs")
    .update({ embedding_status: "error" })
    .eq("id", docId);
  if (error) {
    console.error("Embedding status update failed");
  }
}

export async function embedDocument(docId: string): Promise<number> {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { data: doc, error: docError } = await supabaseAdmin
      .from("knowledge_docs")
      .select("id, project_id, content_text, content_preview")
      .eq("id", docId)
      .single();

    if (docError || !doc) {
      throw new KnowledgeDocumentNotFoundError();
    }

    const text = doc.content_text || doc.content_preview || "";
    if (!text.trim()) {
      throw new EmptyKnowledgeDocumentError();
    }

    const chunks = chunkText(text);
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: EMBEDDING_TIMEOUT_MS,
      maxRetries: 0,
    });
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunks,
    });

    const rows = chunks.map((content, index) => ({
      doc_id: docId,
      project_id: doc.project_id,
      chunk_index: index,
      content,
      embedding: response.data[index].embedding as unknown as number[],
      metadata: { char_count: content.length },
    }));

    const { error: upsertError } = await supabaseAdmin
      .from("knowledge_chunks")
      .upsert(rows, { onConflict: "doc_id,chunk_index" });
    if (upsertError) {
      throw new Error("Embedding chunks could not be stored");
    }

    const { error: staleDeleteError } = await supabaseAdmin
      .from("knowledge_chunks")
      .delete()
      .eq("doc_id", docId)
      .gte("chunk_index", chunks.length);
    if (staleDeleteError) {
      throw new Error("Stale embedding chunks could not be removed");
    }

    const { error: statusError } = await supabaseAdmin
      .from("knowledge_docs")
      .update({ embedding_status: "indexed" })
      .eq("id", docId);
    if (statusError) {
      throw new Error("Embedding status could not be updated");
    }

    return chunks.length;
  } catch (error) {
    await markEmbeddingError(docId);
    throw error;
  }
}

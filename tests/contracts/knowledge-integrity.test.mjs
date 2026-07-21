import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const uploadUrl = new URL("../../src/app/api/upload/route.ts", import.meta.url);
const embedUrl = new URL("../../src/lib/knowledge/embed-document.ts", import.meta.url);
const uiUrl = new URL("../../src/components/knowledge/knowledge-upload.tsx", import.meta.url);
const migrationUrl = new URL("../../supabase/migrations/20260719010000_knowledge_chunk_integrity.sql", import.meta.url);

test("Knowledge UI states that indexing covers an extracted preview", async () => {
  const [upload, ui] = await Promise.all([
    readFile(uploadUrl, "utf8"),
    readFile(uiUrl, "utf8"),
  ]);
  assert.match(upload, /MAX_INDEXED_CHARACTERS\s*=\s*3_000/);
  assert.match(upload, /MAX_INDEXED_PDF_PAGES\s*=\s*10/);
  assert.match(ui, /preview indexed/i);
  assert.match(ui, /3,000 characters/i);
  assert.match(ui, /first 10 PDF pages/i);
  assert.doesNotMatch(ui, /Indexed documents become available to Chat RAG/);
});

test("Knowledge embedding retries upsert deterministic chunks and remove stale tail chunks", async () => {
  const [embed, migration] = await Promise.all([
    readFile(embedUrl, "utf8"),
    readFile(migrationUrl, "utf8"),
  ]);
  assert.match(embed, /\.upsert\(rows,\s*\{\s*onConflict:\s*"doc_id,chunk_index"/s);
  assert.match(embed, /\.gte\("chunk_index",\s*chunks\.length\)/);
  assert.match(embed, /staleDeleteError/);
  assert.match(embed, /statusError/);
  assert.match(migration, /PARTITION BY doc_id, chunk_index/i);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS knowledge_chunks_doc_chunk_unique/i);
});

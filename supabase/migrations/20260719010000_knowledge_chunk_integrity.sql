-- Make embedding retries deterministic and safe for existing duplicate rows.

WITH ranked_chunks AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY doc_id, chunk_index
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS duplicate_rank
  FROM public.knowledge_chunks
)
DELETE FROM public.knowledge_chunks AS chunks
USING ranked_chunks
WHERE chunks.id = ranked_chunks.id
  AND ranked_chunks.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_chunks_doc_chunk_unique
  ON public.knowledge_chunks(doc_id, chunk_index);

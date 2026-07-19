-- Release integrity: private knowledge storage, RAG scope truth, and usage provenance.

INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge', 'knowledge', false)
ON CONFLICT (id) DO UPDATE
SET public = false;

UPDATE storage.buckets
SET public = false
WHERE id = 'knowledge';

DROP POLICY IF EXISTS "Authorized knowledge object access" ON storage.objects;
CREATE POLICY "Authorized knowledge object access"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'knowledge' AND public.is_shaggy_authorized())
  WITH CHECK (bucket_id = 'knowledge' AND public.is_shaggy_authorized());

CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_project_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  doc_id uuid,
  chunk_index int,
  content text,
  similarity float,
  metadata jsonb
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    kc.id,
    kc.doc_id,
    kc.chunk_index,
    kc.content,
    1 - (kc.embedding <=> query_embedding) AS similarity,
    kc.metadata
  FROM public.knowledge_chunks kc
  WHERE
    kc.embedding IS NOT NULL
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
    AND (
      p_project_id IS NULL
      OR kc.project_id IS NULL
      OR kc.project_id = p_project_id
    )
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.match_knowledge_chunks(vector, float, int, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(vector, float, int, uuid) TO authenticated, service_role;

ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS trust_level text NOT NULL DEFAULT 'server-reported';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usage_events_trust_level_check'
      AND conrelid = 'public.usage_events'::regclass
  ) THEN
    ALTER TABLE public.usage_events
      ADD CONSTRAINT usage_events_trust_level_check
      CHECK (trust_level IN ('server-reported', 'client-reported'));
  END IF;
END;
$$;

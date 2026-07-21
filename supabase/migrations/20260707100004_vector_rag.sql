CREATE OR REPLACE FUNCTION public.create_policy_if_not_exists(
  policy_name text,
  table_name text,
  operation text,
  role_name text,
  using_expr text DEFAULT 'true',
  with_check_expr text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  policy_exists boolean;
  with_check_clause text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = table_name
      AND policyname = policy_name
  ) INTO policy_exists;

  IF NOT policy_exists THEN
    IF operation IN ('SELECT', 'DELETE') OR with_check_expr IS NULL THEN
      with_check_clause := '';
    ELSE
      with_check_clause := format(' WITH CHECK (%s)', with_check_expr);
    END IF;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR %s TO %s USING (%s)%s',
      policy_name, table_name, operation, role_name, using_expr, with_check_clause
    );
  END IF;
END;
$$;

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create knowledge chunks table for vector RAG
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL REFERENCES public.knowledge_docs(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
  ON public.knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS knowledge_chunks_doc_id_idx ON public.knowledge_chunks(doc_id);
CREATE INDEX IF NOT EXISTS knowledge_chunks_project_id_idx ON public.knowledge_chunks(project_id);

-- Function to match chunks by vector similarity
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
    AND (p_project_id IS NULL OR kc.project_id = p_project_id)
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- RLS policies
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

SELECT public.create_policy_if_not_exists(
  'Allow service role all on knowledge_chunks',
  'knowledge_chunks',
  'ALL',
  'service_role',
  'true',
  'true'
);

SELECT public.create_policy_if_not_exists(
  'Allow authenticated read own project chunks',
  'knowledge_chunks',
  'SELECT',
  'authenticated',
  'project_id IS NULL OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id)',
  NULL
);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_knowledge_chunks_updated_at ON public.knowledge_chunks;
CREATE TRIGGER update_knowledge_chunks_updated_at
  BEFORE UPDATE ON public.knowledge_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

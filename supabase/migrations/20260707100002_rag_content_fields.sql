-- Add content fields for RAG text search and preview
ALTER TABLE public.knowledge_docs
ADD COLUMN IF NOT EXISTS content_preview TEXT,
ADD COLUMN IF NOT EXISTS content_text TEXT;

-- Create a simple text search index on content
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_content_preview
  ON public.knowledge_docs USING gin (to_tsvector('english', COALESCE(content_preview, '')));

-- Update embedding status default to pending if indexed rows lack content
UPDATE public.knowledge_docs
SET embedding_status = 'pending'
WHERE content_preview IS NULL AND embedding_status = 'indexed';

-- =========================================================
-- SHAGGY AI OS v0.2 schema additions
-- Run this in Supabase SQL Editor
-- =========================================================

-- 1. Usage events (token spend per provider/model/project)
CREATE TABLE IF NOT EXISTS public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_estimate NUMERIC(12, 6) DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('success', 'error', 'cached')) DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read usage_events"
  ON public.usage_events FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow service insert usage_events"
  ON public.usage_events FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Allow anon insert usage_events"
  ON public.usage_events FOR INSERT
  TO anon
  WITH CHECK (true);

-- 2. Notifications / alerts
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT CHECK (level IN ('info', 'warning', 'error', 'success')) DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read notifications"
  ON public.notifications FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon update notifications"
  ON public.notifications FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon insert notifications"
  ON public.notifications FOR INSERT
  TO anon
  WITH CHECK (true);

-- 3. Knowledge documents (for RAG)
CREATE TABLE IF NOT EXISTS public.knowledge_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  size_bytes INTEGER DEFAULT 0,
  storage_path TEXT NOT NULL,
  embedding_status TEXT CHECK (embedding_status IN ('pending', 'processing', 'indexed', 'error')) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.knowledge_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read knowledge_docs"
  ON public.knowledge_docs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert knowledge_docs"
  ON public.knowledge_docs FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon delete knowledge_docs"
  ON public.knowledge_docs FOR DELETE
  TO anon
  USING (true);

-- 4. Agent activity log
CREATE TABLE IF NOT EXISTS public.agent_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT CHECK (status IN ('running', 'success', 'error', 'waiting')) DEFAULT 'running',
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.agent_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read agent_activity"
  ON public.agent_activity FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert agent_activity"
  ON public.agent_activity FOR INSERT
  TO anon
  WITH CHECK (true);

-- 5. Helper function for daily usage aggregation
CREATE OR REPLACE FUNCTION public.get_daily_usage(
  p_provider TEXT DEFAULT NULL,
  p_project_id UUID DEFAULT NULL,
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  day TEXT,
  provider TEXT,
  total_cost NUMERIC,
  total_input_tokens BIGINT,
  total_output_tokens BIGINT,
  event_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    to_char(created_at, 'YYYY-MM-DD') AS day,
    provider,
    ROUND(SUM(cost_estimate)::numeric, 6) AS total_cost,
    SUM(input_tokens)::bigint AS total_input_tokens,
    SUM(output_tokens)::bigint AS total_output_tokens,
    COUNT(*)::bigint AS event_count
  FROM public.usage_events
  WHERE created_at >= now() - make_interval(days => days_back)
    AND (p_provider IS NULL OR provider = p_provider)
    AND (p_project_id IS NULL OR project_id = p_project_id)
  GROUP BY to_char(created_at, 'YYYY-MM-DD'), provider
  ORDER BY day DESC, provider;
$$;

-- 6. Seed sample usage, notifications, knowledge docs, activity
INSERT INTO public.usage_events (provider, model, input_tokens, output_tokens, cost_estimate, status, created_at)
SELECT
  provider,
  model,
  (random() * 5000)::int,
  (random() * 2000)::int,
  (random() * 0.05)::numeric(12,6),
  CASE WHEN random() > 0.9 THEN 'error' ELSE 'success' END,
  now() - (random() * interval '30 days')
FROM (
  VALUES
    ('openai', 'gpt-4o'),
    ('openai', 'gpt-4o-mini'),
    ('kimi', 'kimi-k2.7-code'),
    ('gemini', 'gemini-2.5-flash'),
    ('claude', 'claude-sonnet-4')
) AS t(provider, model)
WHERE NOT EXISTS (SELECT 1 FROM public.usage_events);

INSERT INTO public.notifications (level, title, message, read)
VALUES
  ('warning', 'Kimi budget at 75%', 'Daily Kimi spend reached $7.50 of $10.00 limit.', false),
  ('error', 'OpenAI call failed', 'Timeout on project SHAGGY v0.2 prompt at 09:42.', false),
  ('info', 'Knowledge base indexed', 'Uploaded document "PRD-v0.2.pdf" is now searchable.', false),
  ('success', 'Review queue cleared', 'All pending approvals were resolved.', false)
WHERE NOT EXISTS (SELECT 1 FROM public.notifications);

INSERT INTO public.knowledge_docs (project_id, name, file_type, size_bytes, storage_path, embedding_status)
SELECT
  (SELECT id FROM public.projects ORDER BY created_at DESC LIMIT 1),
  'PRD-v0.2.pdf',
  'pdf',
  124000,
  'docs/prd-v0.2.pdf',
  'indexed'
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_docs);

INSERT INTO public.agent_activity (agent, action, status, metadata)
VALUES
  ('coder', 'Generated usage panel', 'success', '{"provider": "kimi"}'),
  ('reviewer', 'Reviewed alert system', 'success', '{"items": 3}'),
  ('deployer', 'Deployed to Vercel', 'success', '{"target": "production"}')
WHERE NOT EXISTS (SELECT 1 FROM public.agent_activity);

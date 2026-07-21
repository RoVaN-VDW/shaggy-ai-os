-- Create chat sessions and messages tables
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  provider_id UUID REFERENCES public.model_providers(id) ON DELETE SET NULL,
  title TEXT DEFAULT 'New chat',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS chat_sessions_project_id_idx ON public.chat_sessions(project_id);
CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON public.chat_messages(session_id);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

SELECT public.create_policy_if_not_exists(
  'Allow service role all on chat_sessions', 'chat_sessions', 'ALL', 'service_role', 'true', 'true'
);
SELECT public.create_policy_if_not_exists(
  'Allow users own chat_sessions', 'chat_sessions', 'ALL', 'authenticated', 'user_id = auth.uid()', 'user_id = auth.uid()'
);
SELECT public.create_policy_if_not_exists(
  'Allow service role all on chat_messages', 'chat_messages', 'ALL', 'service_role', 'true', 'true'
);
SELECT public.create_policy_if_not_exists(
  'Allow users own chat_messages', 'chat_messages', 'ALL', 'authenticated', 'session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid())', 'session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid())'
);

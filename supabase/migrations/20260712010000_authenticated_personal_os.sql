-- Harden SHAGGY from a public demo into an authenticated personal OS.
-- Existing service_role access remains unaffected by RLS.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.shaggy_authorized_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  authorized_at timestamptz NOT NULL DEFAULT now()
);

-- Fail closed: identity was verified before this migration. The entire migration
-- must abort unless exactly one auth account exists and that account is confirmed.
-- This keeps hardening and operator seeding atomic without storing email or UUID
-- identity data in source control.
REVOKE ALL ON TABLE private.shaggy_authorized_users FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  total_user_count integer;
  confirmed_user_count integer;
  operator_user_id uuid;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE email_confirmed_at IS NOT NULL)
  INTO total_user_count, confirmed_user_count
  FROM auth.users;

  IF total_user_count <> 1 OR confirmed_user_count <> 1 THEN
    RAISE EXCEPTION
      'SHAGGY operator invariant failed: expected exactly one confirmed auth user, found % total and % confirmed',
      total_user_count,
      confirmed_user_count;
  END IF;

  SELECT id
  INTO STRICT operator_user_id
  FROM auth.users
  WHERE email_confirmed_at IS NOT NULL;

  INSERT INTO private.shaggy_authorized_users (user_id)
  VALUES (operator_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_shaggy_authorized()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM private.shaggy_authorized_users authorized_user
    WHERE authorized_user.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_shaggy_authorized() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_shaggy_authorized() TO authenticated, service_role;

DO $$
DECLARE
  target_table text;
  policy_record record;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'projects',
    'chats',
    'messages',
    'artifacts',
    'files',
    'knowledge_rooms',
    'knowledge_sources',
    'memory_items',
    'prompts',
    'assets',
    'agents',
    'workflows',
    'model_providers',
    'connectors',
    'traces',
    'dashboards',
    'dashboard_widgets',
    'reports',
    'settings',
    'review_items',
    'usage_events',
    'notifications',
    'knowledge_docs',
    'agent_activity',
    'knowledge_chunks',
    'chat_sessions',
    'chat_messages'
  ] LOOP
    IF to_regclass(format('public.%I', target_table)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);

    FOR policy_record IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = target_table
        -- Keep only service-role-only policies. PostgreSQL combines permissive
        -- policies with OR, so every legacy public/anon/authenticated policy
        -- must be removed before the allowlist policy is introduced.
        AND NOT (roles <@ ARRAY['service_role']::name[])
    LOOP
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        policy_record.policyname,
        target_table
      );
    END LOOP;

    -- RLS is the primary boundary; grants are reduced as defence in depth.
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated',
      target_table
    );
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated',
      target_table
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'Authenticated personal OS access',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_shaggy_authorized()) WITH CHECK (public.is_shaggy_authorized())',
      'Authenticated personal OS access',
      target_table
    );
  END LOOP;
END;
$$;

-- Conversations are user-owned even if additional accounts are ever enabled.
DROP POLICY IF EXISTS "Authenticated personal OS access" ON public.chat_sessions;
DROP POLICY IF EXISTS "Authenticated personal OS access" ON public.chat_messages;

CREATE POLICY "Allow users own chat_sessions"
  ON public.chat_sessions FOR ALL TO authenticated
  USING (public.is_shaggy_authorized() AND user_id = auth.uid())
  WITH CHECK (public.is_shaggy_authorized() AND user_id = auth.uid());

CREATE POLICY "Allow users own chat_messages"
  ON public.chat_messages FOR ALL TO authenticated
  USING (public.is_shaggy_authorized() AND session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()))
  WITH CHECK (public.is_shaggy_authorized() AND session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()));

-- RPC and migration helpers must not inherit PostgreSQL's default PUBLIC
-- execute privilege. Only runtime RPCs are exposed to authorized sessions.
REVOKE ALL ON FUNCTION public.get_daily_usage(text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_usage(text, uuid, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.match_knowledge_chunks(vector, float, int, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(vector, float, int, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_policy_if_not_exists(text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_policy_if_not_exists(text, text, text, text, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
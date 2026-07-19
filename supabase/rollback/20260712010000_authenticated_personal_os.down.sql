-- EMERGENCY ROLLBACK ONLY.
-- This restores the exact pre-hardening public/anon/authenticated access model
-- observed in the 2026-07-14 schema-only production snapshot. It intentionally
-- reopens the exposure that migration 20260712010000 closes.
-- Never apply this as a normal release step.

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

    FOR policy_record IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = target_table
        AND NOT (roles <@ ARRAY['service_role']::name[])
    LOOP
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        policy_record.policyname,
        target_table
      );
    END LOOP;

    EXECUTE format(
      'GRANT ALL PRIVILEGES ON TABLE public.%I TO anon, authenticated',
      target_table
    );
  END LOOP;
END;
$$;

CREATE POLICY "Allow anon delete knowledge_docs"
  ON public.knowledge_docs FOR DELETE TO anon USING (true);
CREATE POLICY "Allow anon insert agent_activity"
  ON public.agent_activity FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon insert knowledge_docs"
  ON public.knowledge_docs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon insert notifications"
  ON public.notifications FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon insert usage_events"
  ON public.usage_events FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon read agent_activity"
  ON public.agent_activity FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read knowledge_docs"
  ON public.knowledge_docs FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read notifications"
  ON public.notifications FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read usage_events"
  ON public.usage_events FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon update notifications"
  ON public.notifications FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous read on model_providers"
  ON public.model_providers FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous read on projects"
  ON public.projects FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous read on review_items"
  ON public.review_items FOR SELECT TO anon USING (true);

CREATE POLICY "Allow authenticated read on model_providers"
  ON public.model_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on projects"
  ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on review_items"
  ON public.review_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read own project chunks"
  ON public.knowledge_chunks FOR SELECT TO authenticated
  USING (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.projects project
      WHERE project.id = knowledge_chunks.project_id
    )
  );
CREATE POLICY "Allow users own chat_sessions"
  ON public.chat_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Allow users own chat_messages"
  ON public.chat_messages FOR ALL TO authenticated
  USING (
    session_id IN (
      SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()
    )
  );

GRANT EXECUTE ON FUNCTION public.get_daily_usage(text, uuid, integer)
  TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(vector, float, int, uuid)
  TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_policy_if_not_exists(text, text, text, text, text, text)
  TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column()
  TO PUBLIC, anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.is_shaggy_authorized();
DROP TABLE IF EXISTS private.shaggy_authorized_users;
-- Keep the private schema itself: DROP SCHEMA could remove unrelated future objects.

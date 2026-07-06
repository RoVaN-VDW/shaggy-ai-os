-- SHAGGY AI OS v0.1 safe anonymous READ policies for cockpit dashboard.
-- These allow anon/public reads on non-sensitive tables only.
-- Replace with authenticated-only policies when user auth is introduced.

alter table public.projects enable row level security;
alter table public.model_providers enable row level security;
alter table public.review_items enable row level security;

-- Drop existing anon policies if re-running
DROP POLICY IF EXISTS "Allow anonymous read on projects" ON public.projects;
DROP POLICY IF EXISTS "Allow anonymous read on model_providers" ON public.model_providers;
DROP POLICY IF EXISTS "Allow anonymous read on review_items" ON public.review_items;

CREATE POLICY "Allow anonymous read on projects"
  ON public.projects
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous read on model_providers"
  ON public.model_providers
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous read on review_items"
  ON public.review_items
  FOR SELECT
  TO anon
  USING (true);

-- Enable authz reads for future use
DROP POLICY IF EXISTS "Allow authenticated read on projects" ON public.projects;
DROP POLICY IF EXISTS "Allow authenticated read on model_providers" ON public.model_providers;
DROP POLICY IF EXISTS "Allow authenticated read on review_items" ON public.review_items;

CREATE POLICY "Allow authenticated read on projects"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read on model_providers"
  ON public.model_providers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read on review_items"
  ON public.review_items
  FOR SELECT
  TO authenticated
  USING (true);

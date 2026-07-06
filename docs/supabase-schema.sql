-- SHAGGY AI OS v0.1 initial schema.
-- Review before applying in Supabase. Keep credentials out of this file.
-- Current Supabase default behavior can require explicit grants before
-- public-schema tables are reachable via the Data API. RLS remains the row
-- access boundary; no broad anon policies are created here.

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active',
  priority integer not null default 3,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  model_provider text not null,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  artifact_type text not null,
  version integer not null default 1,
  content text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  room_type text not null,
  source_status text not null default 'unverified',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  engine_profile text not null,
  rating numeric(3, 2),
  prompt_text text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  asset_type text not null,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.review_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  risk_score integer not null check (risk_score between 0 and 100),
  status text not null default 'needs_review',
  why_this text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.model_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  profile text not null,
  policy_status text not null default 'to_verify',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.traces (
  id uuid primary key default gen_random_uuid(),
  action_name text not null,
  mode text not null,
  risk_score integer not null check (risk_score between 0 and 100),
  explanation text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.artifacts enable row level security;
alter table public.knowledge_rooms enable row level security;
alter table public.prompts enable row level security;
alter table public.assets enable row level security;
alter table public.review_items enable row level security;
alter table public.model_providers enable row level security;
alter table public.traces enable row level security;

grant select, insert, update, delete on table
  public.projects,
  public.chats,
  public.messages,
  public.artifacts,
  public.knowledge_rooms,
  public.prompts,
  public.assets,
  public.review_items,
  public.model_providers,
  public.traces
to authenticated, service_role;

grant usage, select on all sequences in schema public to authenticated, service_role;

-- Add ownership/user policies before exposing user data to browser clients.
-- Example pattern for later:
-- create policy "users can read their own projects"
-- on public.projects for select to authenticated
-- using ((select auth.uid()) = (metadata->>'owner_id')::uuid);

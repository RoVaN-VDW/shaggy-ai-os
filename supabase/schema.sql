drop table if exists traces cascade;
drop table if exists connectors cascade;
drop table if exists review_items cascade;
drop table if exists workflows cascade;
drop table if exists agents cascade;
drop table if exists assets cascade;
drop table if exists prompts cascade;
drop table if exists memory_items cascade;
drop table if exists knowledge_sources cascade;
drop table if exists knowledge_rooms cascade;
drop table if exists files cascade;
drop table if exists artifacts cascade;
drop table if exists messages cascade;
drop table if exists chats cascade;
drop table if exists dashboards cascade;
drop table if exists dashboard_widgets cascade;
drop table if exists reports cascade;
drop table if exists settings cascade;
drop table if exists model_providers cascade;
drop table if exists projects cascade;

create table projects (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid default auth.uid(),
  name text not null,
  description text,
  status text default 'active',
  type text,
  health_score integer default 0,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table chats (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  title text,
  model_profile text default 'Hermes',
  mode text default 'Manual',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table messages (
  id uuid default gen_random_uuid() primary key,
  chat_id uuid references chats(id) on delete cascade,
  role text not null,
  content text,
  model text,
  token_count integer default 0,
  cost numeric default 0,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table artifacts (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  type text not null,
  title text not null,
  content text,
  content_ref text,
  version integer default 1,
  status text default 'draft',
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table files (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  storage_path text,
  type text,
  name text not null,
  sensitive_label text default 'Public / Low Risk',
  source_status text default 'pending',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table knowledge_rooms (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  mode text default 'standard',
  source_policy text default 'verify-first',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table knowledge_sources (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references knowledge_rooms(id) on delete cascade,
  file_id uuid references files(id) on delete set null,
  reliability_score integer default 0,
  freshness timestamptz default now(),
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table memory_items (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  scope text default 'project',
  status text default 'suggested',
  content text,
  confidence numeric default 0,
  source_refs jsonb default '[]',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table prompts (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  engine text not null,
  type text,
  title text,
  prompt_text text,
  rating integer default 0,
  status text default 'draft',
  version integer default 1,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table assets (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  type text not null,
  engine text,
  prompt_id uuid references prompts(id) on delete set null,
  file_id uuid references files(id) on delete set null,
  rating integer default 0,
  rights_status text default 'unknown',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table agents (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  role text,
  model_preference text default 'Hermes',
  permissions jsonb default '[]',
  status text default 'idle',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table workflows (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  definition_json jsonb default '{}',
  status text default 'draft',
  version integer default 1,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table review_items (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  type text not null,
  title text not null,
  proposed_action text,
  risk_level text default 'low',
  status text default 'pending',
  payload_json jsonb default '{}',
  created_at timestamptz default now()
);

create table model_providers (
  id uuid default gen_random_uuid() primary key,
  provider text not null,
  model text not null,
  status text default 'active',
  cost_profile jsonb default '{}',
  policy_profile jsonb default '{}',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table connectors (
  id uuid default gen_random_uuid() primary key,
  provider text not null,
  auth_type text,
  status text default 'placeholder',
  permissions jsonb default '[]',
  health text default 'unknown',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table traces (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  run_type text,
  model text,
  tokens integer default 0,
  cost numeric default 0,
  latency numeric default 0,
  inputs_ref text,
  outputs_ref text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table dashboards (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  name text,
  layout_json jsonb default '{}',
  theme text default 'shaggy-dark',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table dashboard_widgets (
  id uuid default gen_random_uuid() primary key,
  dashboard_id uuid references dashboards(id) on delete cascade,
  type text not null,
  position jsonb default '{}',
  config_json jsonb default '{}',
  data_source text,
  created_at timestamptz default now()
);

create table reports (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  type text,
  title text,
  status text default 'draft',
  content_ref text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table settings (
  id uuid default gen_random_uuid() primary key,
  scope text default 'global',
  key text not null,
  value_json jsonb default '{}',
  created_at timestamptz default now()
);

-- Enable RLS for all tables (policies to be added later)
alter table projects enable row level security;
alter table chats enable row level security;
alter table messages enable row level security;
alter table artifacts enable row level security;
alter table files enable row level security;
alter table knowledge_rooms enable row level security;
alter table knowledge_sources enable row level security;
alter table memory_items enable row level security;
alter table prompts enable row level security;
alter table assets enable row level security;
alter table agents enable row level security;
alter table workflows enable row level security;
alter table review_items enable row level security;
alter table model_providers enable row level security;
alter table connectors enable row level security;
alter table traces enable row level security;
alter table dashboards enable row level security;
alter table dashboard_widgets enable row level security;
alter table reports enable row level security;
alter table settings enable row level security;

-- SHAGGY AI OS v0.1 seed data for supabase/schema.sql.

insert into projects (name, description, status, type, health_score, metadata)
select seed.name, seed.description, seed.status, seed.type, seed.health_score, seed.metadata::jsonb
from (
  values
    (
      'AI Command OS',
      'Central SHAGGY kernel replacing ALFRED after Ronald confirms v0.1 coverage.',
      'kernel_build',
      'operating_system',
      62,
      '{"next_action":"Finish cockpit, review queue, model routes, and trace logging."}'
    ),
    (
      'MoveID',
      'Active product workspace with traceable handoff, launch artifacts, and AI continuity.',
      'active_product',
      'product',
      54,
      '{"next_action":"Expose project handoff, next actions, artifacts, and launch checks."}'
    ),
    (
      'AI Immo Agency',
      'Growth and creative production track for reusable prompt and content systems.',
      'growth_track',
      'business_unit',
      38,
      '{"next_action":"Prepare creative prompts, SEO/GEO tasks, and asset rooms."}'
    )
) as seed(name, description, status, type, health_score, metadata)
where not exists (
  select 1 from projects where projects.name = seed.name
);

insert into model_providers (provider, model, status, cost_profile, policy_profile, metadata)
select seed.provider, seed.model, seed.status, seed.cost_profile::jsonb, seed.policy_profile::jsonb, seed.metadata::jsonb
from (
  values
    ('Hermes', 'local-orchestrator', 'active', '{"signal":"local_first"}', '{"status":"to_verify"}', '{"role":"Primary orchestration and local operating protocol"}'),
    ('Codex', 'gpt-5-codex', 'active', '{"signal":"task_based"}', '{"status":"to_verify"}', '{"role":"Implementation, verification, and codebase changes"}'),
    ('Kimi Code 2.7', 'kimi-code-2.7', 'placeholder', '{"signal":"to_profile"}', '{"status":"to_verify"}', '{"role":"Long-context implementation and repo continuation"}'),
    ('Gemini', 'gemini', 'placeholder', '{"signal":"to_profile"}', '{"status":"to_verify"}', '{"role":"Long-context review, spec comparison, and research synthesis"}'),
    ('Antigravity', 'antigravity', 'placeholder', '{"signal":"unknown"}', '{"status":"to_verify"}', '{"role":"Orchestration and multi-surface build support"}')
) as seed(provider, model, status, cost_profile, policy_profile, metadata)
where not exists (
  select 1 from model_providers
  where model_providers.provider = seed.provider
    and model_providers.model = seed.model
);

insert into review_items (project_id, type, title, proposed_action, risk_level, status, payload_json)
select p.id, seed.type, seed.title, seed.proposed_action, seed.risk_level, 'pending', seed.payload_json::jsonb
from projects p
join (
  values
    ('AI Command OS', 'external_action', 'External connector action', 'Simulate first, require Ronald approval before execution.', 'high', '{"mode":"Manual","why":"Could publish, send, deploy, or mutate third-party state."}'),
    ('AI Command OS', 'memory_write', 'Permanent memory write', 'Queue as suggested memory until approved.', 'medium', '{"mode":"Manual","why":"Durable memory changes require explicit approval."}'),
    ('AI Command OS', 'deployment', 'Production deployment', 'Require sandbox, QA evidence, rollback plan, and explicit approval.', 'high', '{"mode":"Lockdown","why":"Production deployment is irreversible enough to need a review gate."}')
) as seed(project_name, type, title, proposed_action, risk_level, payload_json)
  on p.name = seed.project_name
where not exists (
  select 1 from review_items where review_items.title = seed.title
);

insert into knowledge_rooms (project_id, name, mode, source_policy, metadata)
select p.id, seed.room_name, seed.mode, seed.source_policy, seed.metadata::jsonb
from projects p
join (
  values
    ('AI Command OS', 'Company OS', 'standard', 'verify-first', '{"source_count":18,"status":"verified_core"}'),
    ('MoveID', 'MoveID Product', 'standard', 'verify-first', '{"source_count":27,"status":"needs_live_sync"}'),
    ('AI Command OS', 'Prompt Lab', 'standard', 'rate-before-reuse', '{"source_count":44,"status":"rating_pending"}'),
    ('AI Immo Agency', 'Creative Assets', 'standard', 'classify-before-use', '{"source_count":12,"status":"classification_draft"}')
) as seed(project_name, room_name, mode, source_policy, metadata)
  on p.name = seed.project_name
where not exists (
  select 1 from knowledge_rooms
  where knowledge_rooms.project_id = p.id
    and knowledge_rooms.name = seed.room_name
);

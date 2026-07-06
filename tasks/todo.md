# SHAGGY AI OS v0.1 Task Plan

## Scope

Build the first running SHAGGY web kernel from the handover document: a fixed-screen premium AI OS cockpit with seeded projects, core module panels, placeholder-safe Supabase foundations, and a verified local build.

## Checklist

- [x] Read source handoff and current workspace state.
- [x] Confirm scaffold, dependencies, and Next.js source structure.
- [x] Add Supabase-safe schema/client foundation without hardcoded secrets.
- [ ] Replace starter page with fixed-screen SHAGGY v0.1 shell.
- [x] Seed projects: AI Command OS, MoveID, AI Immo Agency.
- [ ] Add Home Cockpit, Projects Hub, Chat Studio, Artifact Studio, Knowledge Rooms, Prompt Intelligence, Creative Studio, Digital Twin, Review Queue, Models & Costs, Security, and Settings panels.
- [ ] Update metadata, visual tokens, and AI workspace continuity docs.
- [ ] Run verification: lint, typecheck, build, and local render check.

## Spec

The first usable version should feel like a personal command layer, not a marketing page. It should use a fixed cockpit layout with left navigation, a top command/status bar, dense but calm panels, and mock/live-hybrid data. Early connector, model, Supabase, and automation behavior must remain simulation-first and approval-gated.

## File Impact

- `src/app/page.tsx`: main SHAGGY v0.1 cockpit implementation.
- `src/app/layout.tsx`: app metadata.
- `src/app/globals.css`: theme and viewport refinements.
- `src/lib/shaggy/data.ts`: typed seed data and module definitions.
- `src/lib/supabase.ts`: placeholder-safe Supabase client factory.
- `docs/NEXT_ACTIONS.md`: continuation steps.
- `docs/supabase-schema.sql`: initial v0.1 schema draft.
- `tasks/todo.md`: progress and review log.
- `tasks/lessons.md`: correction patterns when needed.

## Risk And Rollback

Risk is low because the app currently shows the starter page only. Rollback is to revert the new files plus the page/layout/style edits. No external services, credentials, deployment, or destructive actions are touched.

## Review

2026-07-06 23:06 CEST:

- Supabase CLI login completed with user-provided access token.
- SHAGGY Supabase project selected: `S.H.A.G.G.Y. - AI Operating System.` / `aormdmjtzwnvayjvhhgt`.
- `.env.local` created with the project URL, project ref, and publishable browser key.
- `docs/supabase-schema.sql` is ready but not applied to the remote database.
- `docs/seed.sql` is ready but not applied to the remote database.
- Scope narrowed by Ronald: Hermes continues the rest.

2026-07-06 23:18 CEST:

- Remote SHAGGY schema applied to Supabase project `aormdmjtzwnvayjvhhgt`.
- The original `supabase/schema.sql` contains destructive `drop table ... cascade` lines. Remote execution first checked `public` tables and found none, then applied the non-destructive create/RLS portion only.
- Seed data inserted with a schema-compatible seed in `supabase/seed.sql` and `docs/seed.sql`.
- Verified remote state: 20 public tables, RLS enabled on all 20 tables, 3 projects, 5 model providers, 4 knowledge rooms, and 3 review items.

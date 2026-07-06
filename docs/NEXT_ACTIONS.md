# SHAGGY AI OS - Next Actions

## Immediate

1. Build the fixed-screen shell.
2. Replace placeholder adapters for Hermes, Codex, Kimi Code 2.7, Gemini, and Antigravity with real provider routes.
3. Add trace persistence against the connected Supabase project.
4. Add explicit authenticated RLS policies before browser writes are enabled.
5. Keep ALFRED until Ronald confirms SHAGGY v0.1 covers the required command-center workflows.

## Completed Supabase Setup

- `.env.local` points to SHAGGY Supabase project `aormdmjtzwnvayjvhhgt`.
- Remote schema from `supabase/schema.sql` has been applied safely without executing destructive drop statements.
- Seed data is inserted.
- Verification: 20 tables exist, RLS is enabled on all 20, and seed counts are present.

## Build Rule

Keep web v0.1 usable before expanding the Mac companion, public publishing, or irreversible automation.

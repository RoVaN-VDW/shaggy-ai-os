# Lessons

- When Ronald says "Dit moeten we nu doen de rest doet Hermes verder", stop broad implementation immediately and narrow the task to the named handoff step. For this session that means Supabase login/project/env/schema handoff only, not continuing the SHAGGY UI build.
- For pnpm v11+, do not put pnpm settings under `package.json#pnpm`. Keep npm `overrides` in `package.json`, but put pnpm overrides/settings in `pnpm-workspace.yaml` so installs stay warning-free.

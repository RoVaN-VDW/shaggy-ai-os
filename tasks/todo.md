# SHAGGY AI OS v0.1 Task Plan

## Active Dream v3 gate — 2026-07-16

- [x] Convert the authenticated Fable/Kimi audit into eight failing contracts.
- [x] Implement semantic health tones, truthful continuity, labeled low-data Knowledge Map, source-backed dock metadata, unavailable voice status and state-gated entity waveform.
- [x] Disable the Next.js development indicator using the installed Next.js 16 contract.
- [x] Pass 95/95 tests, security verification, lint, typecheck, production build and production dependency audit.
- [x] Capture authenticated 1440×778 runtime evidence without bypassing auth; retain exact target viewports as deterministic contracts, not fabricated live captures.
- [x] Close magic-link URL-fragment leakage TDD-first and rotate the QA session; four local tabs return fail-closed login with empty hashes.
- [x] Implement the premium wide face-frame TDD-first: wider Mission/right rails, exact entity-corridor centering, aligned top-zone baseline and full-width cognitive dock.
- [x] Complete authenticated 1440×778 full-cockpit visual QA with all lower cards/footer visible and no clipping, overlap or broken loading state.
- [x] Run and reconcile one approved Fable High review for Knowledge Map, Digital Twin, semantic motion and dashboard capability truth.
- [x] Record Ronald's dual-mode presence decision: performance-gated 4K Orb first, cinematic Ronald face second.
- [ ] Benchmark local Dutch STT/TTS plus microphone security only after explicit approval; no model install or cloud audio upload before that gate.
- [x] Implement the validated Knowledge/Twin masterplan P0 truth/capability slice with RED→GREEN contracts.
- [ ] Implement P1 and P2 as separate owner-approved slices; neither phase is authorized by the P0 completion.
- [x] Perform final scoped review and create four separately approved local code commits after clean cumulative worktree verification.
- [ ] Obtain follow-up independent review and GitHub CI before remote push or Preview promotion.
- [ ] Apply Preview migrations, deploy Preview and promote production only through separate owner approval gates.

> The original v0.1 plan below is retained as historical context.

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

Risk is moderate because the app now touches Supabase, provider APIs, and Vercel production. Rollback is to redeploy the previous successful Vercel deployment and revert the scoped API/security/provider changes. Secrets must remain only in Supabase/Vercel environment storage and never in source files.

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

2026-07-07 01:47 CEST:

- Supabase storage bucket `knowledge` exists and is private.
- Storage policy `Allow service role all operations` exists for `storage.objects` with role `service_role`.
- Vercel production env vars confirmed: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PROJECT_REF`, and `SUPABASE_SERVICE_ROLE_KEY`.
- Provider key names exist in `.env.local` but their values are empty, so `OPENAI_API_KEY`, `KIMI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, and `ANTIGRAVITY_API_KEY` were not added to Vercel.
- Local production build passed.
- Vercel production deploy succeeded: `dpl_5kxDbTVM5UjPep4rMjMhVP8Hvyak`.
- Live production alias verified with HTTP 200: `https://shaggy-ai-os.vercel.app`.

2026-07-07 02:53 CEST:

- `OPENAI_API_KEY` added to Vercel production environment.
- Fixed malformed line-number prefixes in `src/lib/supabase/client.ts`.
- Local production build passed after the fix.
- Vercel production redeploy succeeded: `dpl_5Ars7AQ38o7ARu3dCDD3vycWzE2v`.
- Live production alias verified with HTTP 200: `https://shaggy-ai-os.vercel.app`.

2026-07-07 03:03 CEST:

- `GEMINI_API_KEY` added to Vercel production environment.
- Local production build passed.
- Vercel production redeploy succeeded: `dpl_7B3PogQ5UJv99WopXbbdH74fMQZh`.
- Live production alias verified with HTTP 200: `https://shaggy-ai-os.vercel.app`.

2026-07-07 03:15 CEST:

- `KIMI_API_KEY` added to Vercel production environment.
- Vercel env listing confirmed `KIMI_API_KEY` is encrypted in Production.
- Production redeploy has not completed yet because repeated `npx vercel --prod --yes` / `npx vercel deploy --prod --yes --force` attempts hung at `Retrieving project...` and were stopped.
- Latest live deployment remains `https://shaggy-ai-hk2yxs0ez-move-id-s-projects.vercel.app` / alias `https://shaggy-ai-os.vercel.app`; it predates `KIMI_API_KEY`.

2026-07-07 hardening/redeploy run:

- Kimi integration is being aligned to the official OpenAI-compatible Moonshot endpoint and current runtime model `kimi-k2.6`.
- Provider API routes are being hardened with auth, rate limits, request size checks, prompt/project validation, generic public errors, timeouts, safer Gemini key transport, and production security headers.
- Remote model provider rows will be checked before deployment so Kimi is not blocked by placeholder status.
- Verification target before final handoff: lint, typecheck, production build, dependency audit, secret scan, Vercel production deploy, and live HTTP checks.

2026-07-07 03:40 CEST:

- Remote Supabase provider row updated: Kimi now uses provider `Kimi`, model `kimi-k2.6`, and status `active`.
- API hardening completed for chat, dispatch, health, and upload routes.
- Production security headers added through `next.config.ts`.
- PostCSS audit warning fixed with dependency override; `npm audit --omit=dev` reports 0 vulnerabilities.
- Verification passed: lint, TypeScript, local production build, remote Vercel build, dependency audit, and secret-pattern scan.
- Vercel production deploy succeeded: `dpl_CgsYrrXotbaEQpYPCnvb2Hy3qXMw`.
- Live alias verified with HTTP 200 and expected security headers: `https://shaggy-ai-os.vercel.app`.
- Protected health API verified unauthenticated with HTTP 401.
- Temporary local Vercel production env file created by `vercel pull` was removed after deployment.

2026-07-07 03:50 CEST:

- Antigravity integration corrected from the placeholder `api.antigravity.co` endpoint to Google's Gemini Interactions API.
- Antigravity now uses agent model `antigravity-preview-05-2026` and the existing `GEMINI_API_KEY` fallback through provider config.
- Remote Supabase provider row updated: Antigravity is now `active`.
- Vercel production deploy succeeded: `dpl_6Mh9fYRWdavngTv9jSfZsfWZ5Kex`.
- Remote Vercel build passed with 0 npm vulnerabilities and a successful Next.js production build.
- Live alias verified with HTTP 200 and expected security headers: `https://shaggy-ai-os.vercel.app`.
- Protected health API verified unauthenticated with HTTP 401.

2026-07-07 pnpm v11 config fix:

- Moved pnpm override configuration from ignored `package.json#pnpm` to `pnpm-workspace.yaml`.
- Kept npm `overrides` in `package.json` for npm/Vercel compatibility.
- Vercel install command switched to `pnpm install --frozen-lockfile` to avoid npm/arborist failures on the local Node 26/npm 11 stack.
- Confirmed `pnpm install --frozen-lockfile` runs without the pnpm v11 ignored-settings warning.
- Verification passed: `pnpm run lint`, `pnpm exec tsc --noEmit`, `pnpm audit --prod`, and `pnpm run build`.

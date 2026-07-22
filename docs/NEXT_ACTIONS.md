# SHAGGY AI OS - Next Actions

## Stabilization checkpoint (2026-07-19)

- [x] Run the complete local release gate: Golden Frame, 149/149 tests, four security verifiers, lint, typecheck and the Next.js production build.
- [x] Confirm `pnpm audit --prod` reports no known vulnerabilities.
- [x] Deliver Models & Costs locally with authenticated ledger reads, EUR conversion, truth boundaries and owner-accepted high-readability typography.
- [x] Complete the Knowledge/Twin P0 truth-and-capability slice: timestamp-derived Twin freshness, local-only Settings boundaries, decision-only Review Queue and uniform planned navigation states.
- [x] Keep private `.hermes/` runtime/evidence data, backup files and the archived design-source package outside product commits.
- [x] Reconcile the 182-file worktree in a clean temporary worktree and create four separately approved local code commits on `stabilization/release-checkpoint-2026-07-19`.
- [x] Obtain a follow-up independent reviewer verdict and add GitHub CI before any remote push or Preview promotion.
- [ ] Apply the pending Supabase migrations to the intended Preview database only after separate owner approval and verify bucket privacy, RLS, RAG scope and usage provenance.
- [ ] Deploy Preview only after separate approval, then run authenticated desktop/mobile browser QA. Production remains untouched.
- [x] Complete and merge P1 local provider readplane with independent release acceptance and green main CI.
- [x] Implement and locally accept P2 Activity Readplane; commit, push, PR, merge and deployment remain separate gates.
- [x] Run one independent read-only fail-closed P2 review after Ronald explicitly approved Fable Low; reconcile the microsecond-ordering blocker TDD-first and reject unsupported clock-skew/window findings.
- [x] Re-run 232/232 tests, security, lint, typecheck, production build, production audit and authenticated runtime QA; `/api/activity` returns 50 local SQLite events and all four wide-layout rows render without clipping.

## Current Dream v3 handoff (2026-07-16)

- [x] Implement the eight Fable/Kimi audit contracts for truthful health, continuity, Knowledge Map, dock metadata, voice status, entity waveform and development chrome.
- [x] Verify 95/95 tests, security contracts, lint, typecheck and the Next.js 16 production build.
- [x] Consolidate pnpm PostCSS resolution on 8.5.16; `pnpm audit --prod` reports no known vulnerabilities.
- [x] Complete authenticated 1440×778 runtime/visual QA without an auth bypass; exact target viewports remain deterministic contract coverage rather than claimed live captures.
- [x] Sanitize Supabase credential fragments after session acceptance and rotate the temporary QA session fail-closed.
- [x] Build the premium wide face-frame: wider Mission and right rail, centered entity corridor, full-width six-space dock and aligned 12px rail/dock baselines.
- [x] Pass authenticated 1440×778 full-cockpit visual acceptance with lower cards/footer visible and no clipping, overlap or broken state.
- [x] Complete one approved Fable High Knowledge Map/Digital Twin/functionality review and reconcile every material finding against source and authenticated evidence.
- [x] Lock the AI-presence direction: one dual-mode engine, 4K Orb first and cinematic Ronald face second on shared state/audio/viseme contracts.
- [ ] Obtain separate approval for the local Dutch STT/TTS and microphone-security benchmark; do not install models or change `Permissions-Policy` before that gate.
- [x] Execute `docs/KNOWLEDGE_TWIN_MASTERPLAN.md` P0 truth/capability slice with deterministic contract coverage; P1/P2 remain separately gated.
- [x] Review and locally commit the scoped code diff in four separately approved, cumulatively verified commits.
- [ ] Commit the reconciled handoff docs only after separate approval; push, Preview and production remain separate decisions.

> The v0.1 notes below are historical and no longer the current execution queue.

## Immediate

1. [x] Build the fixed-screen shell.
2. [x] Replace placeholder adapters for Hermes, Codex, Kimi Code 2.7, Gemini, and Antigravity with real provider routes.
3. [x] Add trace persistence against the connected Supabase project.
4. [x] Add explicit authenticated RLS policies before browser writes are enabled.
5. [x] Retire ALFRED Command Center once SHAGGY v0.1 is verified.

## Recently Completed (2026-07-07)

- Codebase audit completed. Build + type check pass. Provider health UI works.
- Fixed hydration error in `provider-config-dialog.tsx` caused by nested `<button>` elements.
- Repaired `pnpm-workspace.yaml` so dependencies install cleanly with `pnpm install`.
- ALFRED Command Center archived to `~/Desktop/AI workspace/archive/ALFRED-Command-Center/` and removed from:
  - `/Users/vanderwaerenronald/alfred-command-center`
  - `/Users/vanderwaerenronald/Documents/Codex/2026-07-05/alfred-command-center`
- Desktop AI workspace was NOT touched.

## Post-Audit Blockers (do before calling v0.1 "stable")

1. **Auth flow**: UI currently reads Supabase as `anon`; `/api/health` and write routes require Bearer token. Add login page or switch health route to service-role check.
2. **Persistent rate limiting**: in-memory `Map` does not work on Vercel/serverless. Move to Redis/Upstash or Supabase-backed rate limit.
3. **Antigravity health endpoint**: currently points to `generativelanguage.googleapis.com` (Gemini copy-paste). Replace with real Antigravity base URL.
4. **Tests + CI**: no test runner or GitHub Actions workflow. Add `vitest`/`playwright` and `.github/workflows/ci.yml`.
5. **Tech debt cleanup**: large `useCockpitData` hook, hardcoded hex colors, no error boundaries/loading skeletons.

## Backlog

- Add Git repository (currently no `.git` in project folder).
- Add low-budget alert email/push integration.
- Build Knowledge Room embedding pipeline end-to-end.
- Add chat sessions persistence and streaming responses.

## Completed Supabase Setup

- `.env.local` points to SHAGGY Supabase project `aormdmjtzwnvayjvhhgt`.
- Remote schema from `supabase/schema.sql` has been applied safely without executing destructive drop statements.
- Seed data is inserted.
- Verification: 20 tables exist, RLS is enabled on all 20, and seed counts are present.

## Build Rule

Keep web v0.1 usable before expanding the Mac companion, public publishing, or irreversible automation.

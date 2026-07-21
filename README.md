# SHAGGY AI OS

Private personal AI operating-system cockpit built with Next.js 16, React 19, TypeScript, Supabase and pnpm.

SHAGGY combines an authenticated command center with project, knowledge, chat, review, Digital Twin, voice/realtime and Models & Costs modules. Dashboard claims follow explicit source, freshness and capability-truth boundaries.

## Local setup

Requirements:

- Node.js 22 (`.nvmrc`)
- pnpm 11.10.0
- project environment variables supplied locally; never commit `.env*`

```bash
nvm use
pnpm install --frozen-lockfile
pnpm dev
```

Next.js uses port 3000 by default. To run the production build on the local SHAGGY port:

```bash
pnpm build
pnpm exec next start -p 3001
```

## Verification

Run the complete local release gate:

```bash
pnpm verify
pnpm audit --prod
```

`pnpm verify` checks:

- canonical Golden Frame integrity;
- Node contract tests;
- auth, knowledge-delete and embedding-lifecycle security contracts;
- ESLint;
- TypeScript;
- the Next.js production build.

## Supporting commands

```bash
pnpm snapshot:second-brain
pnpm voice:companion
```

The voice companion is loopback-only. Realtime voice is conditional, paid-cloud, push-to-talk and non-autonomous.

## Safety and release boundaries

- Authentication and Supabase RLS stay fail-closed.
- Provider credentials remain server-side and outside Git.
- `.hermes/` contains private local plans/evidence/runtime data and is ignored.
- Commit, Preview deployment and production promotion each require a separate owner decision.
- Knowledge Constellation P1 and Living Twin P2 remain separately gated.

See `docs/NEXT_ACTIONS.md`, `docs/KNOWLEDGE_TWIN_MASTERPLAN.md` and `docs/RELEASE_CHECKPOINT_2026-07-19.md` for the current handoff.
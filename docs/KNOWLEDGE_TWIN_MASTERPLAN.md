# SHAGGY Knowledge Constellation & Digital Twin — validated masterplan

> Status: Fable High reviewed; Sol reconciled against source and authenticated evidence on 2026-07-16. P0 was implemented and passed the complete local release gate on 2026-07-19. P1, P2, commit and deployment remain separately gated.

## North star

SHAGGY becomes one cinematic instrument with one truth source. The neural face remains the Tier-0 identity and sole continuous RAF owner. Knowledge Map and Digital Twin become quieter evidence-bound instruments: interaction and motion occur only because a real source, selection, state change or durable event justifies them. Reduced Motion preserves identical meaning in static form.

## Capability truth model

| State | Meaning | Dashboard treatment |
|---|---|---|
| Runtime-proven | Executed successfully in authenticated QA | Default enabled state with source/freshness metadata |
| Source-backed | Handler/query exists and deterministic checks pass, but mutation E2E was not executed | Enabled; no “proven” claim |
| Conditional | Requires provider credentials, quota, indexed data or another runtime dependency | Visible “Requires …” badge and truthful unavailable/error state |
| Read-only / decision-only | Visualizes data or records a decision without executing the external action | Boundary copy in the panel |
| Local-only | Browser/device preference with no server enforcement | “Stored on this device · not enforced server-side” |
| Planned | No working route/capability | Uniform Planned badge; no clickable dead affordance |

## Knowledge Constellation target

- Preserve deterministic project anchors and verified project→document edges.
- Projects are luminous anchors; documents are satellites; orphan documents live in an explicitly labeled Unlinked zone.
- Add click/Enter selection, Escape clear, hover/focus neighborhood preview and non-neighborhood dimming.
- Open a compact provenance drawer with full title, owner project, embedding state, source metadata and timestamp where available.
- Keep labels at least 11 CSS px and collision-safe; truncation may remain in-canvas but never in the detail surface.
- One-shot radial reveal and selection ripple via SVG/CSS/Framer or the existing conductor phase—no second RAF.
- Do not add document-to-document semantic edges, clusters, recency glow or trends until stored source data supports them.

## Living Digital Twin target

- Keep the continuity core and identify orbiting nodes honestly as recently changed projects—not agents or dependencies.
- Derive freshness from `snapshot.observedAt`; render “as of …” and a deterministic stale state instead of unconditional “live”.
- Selecting a project filters the durable-change trace and opens provenance detail for actual change records.
- Selecting the core exposes the six aggregate metrics and observation time.
- Draw spokes once on mount; pulse a node once only when a newly observed snapshot contains a durable change for it.
- IDLE remains static; Reduced Motion shows completed spokes and a static changed marker.
- Defer health layers, attention routing and temporal replay until source contracts and an append-only history exist.

## Signature interaction

A real activity or durable-change event triggers one chain:

1. entity gaze shifts once toward the owning region;
2. the corresponding Knowledge/Twin node receives one pulse;
3. the destination panel gets one brief rim highlight;
4. the sequence settles and does not replay until a new event exists.

No heartbeat, random jitter, perpetual edge flow or decorative data motion.

## Delivery phases

### P0 — Truth and capability contract

- Replace Twin’s unconditional live badge with timestamp-derived freshness/stale status.
- Label Settings safety switches as local-only until server enforcement exists.
- State that Review Queue records a decision and does not execute the proposed action.
- Give six disabled sidebar destinations a uniform Planned treatment.
- Add capability-state contracts and tests.

Acceptance: no text implies liveness, enforcement or execution beyond runtime truth; existing tests/lint/typecheck/security/audit/build remain green.

### P1 — Interactive Knowledge Constellation

- Selection/focus state and keyboard parity.
- Neighborhood dimming.
- Provenance drawer.
- One-shot reveal and conductor-aligned selection ripple.
- Collision-safe labels across canonical, laptop and 4K contracts.

Acceptance: zero extra RAF loops; Reduced Motion parity; no invented edges; no clipping/scroll at authenticated 1440×778; accessible text equivalent.

### P2 — Living Twin and coordinated pulse

- Timestamp-derived freshness state.
- Project selection and filtered durable-change trace.
- Provenance drawer.
- Real-event node pulse.
- Entity→node→panel signature interaction.

Acceptance: each animation maps to a real event; IDLE calm; keyboard/accessibility checks pass; auth remains fail-closed; no external side effects.

## Functional audit summary

- Runtime-proven: authenticated dashboard read, allowlist boundary, protected `/api/second-brain` HTTP 200, sign-out/theme behavior previously verified.
- Source-backed but mutation E2E not executed in this review: project creation, knowledge-room creation, notification read, review status updates, prompt/artifact persistence and Models & Costs ledger ingestion.
- Conditional: chat/provider dispatch, RAG, uploads/embedding, health checks, Creative Studio brief generation and the paid cloud Realtime audition.
- Read-only/decision-only: Knowledge Map, Digital Twin, Review Queue execution boundary.
- Local-only: Settings preferences, local prompt structuring/copy and browser downloads.
- Planned: Workflow Studio, Growth Center, Build & Deploy, Reports & Insights and Security & Backup.
- Voice: the dashboard speech companion is privacy-gated; the Realtime audition is feature-flag/key-gated, push-to-talk and non-autonomous. The global command performs workspace navigation only when a workspace name matches.

## Deferred by truth boundary

- document-to-document semantic relations without persisted relation data;
- graph freshness/trends without per-node timestamps/history;
- Twin temporal replay without append-only retained events;
- biometric, agent or attention metrics without a real source contract.

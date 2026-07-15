# Idea 7 — Anthropic-key AI summary

> One of five competing **summary source** approaches. Renders through
> [Idea 2 — Summary card display](../summary-card-display/requirements.md). Strongly pairs with
> [Idea 1](../filter-changed-and-blocked/requirements.md) (what changed) as prompt input.

## Problem

Even with all the data (status, date slips, blockers, child comments), turning it into a crisp
executive sentence is manual work. If the user supplies their own Anthropic API key, the report
can **generate** a short summary per initiative from the data it already has.

## User value

- Narrative for **every** card with no human authoring.
- Consistent tone/length; can explicitly explain "what changed and why" using the Idea 1 signals.
- User brings their own key → no shared cost, no server-side secret to manage.

## How it might work

### Key handling (security-critical)

- User pastes an Anthropic API key into a settings panel; store it in the
  [storage service](../../../src/react/services/storage/) as a **local/user-scoped** setting —
  never in the URL, never in saved-report data that gets shared, never committed.
- Clearly mark it as sensitive; provide a "clear key" action; document that it stays on their
  storage.
- **CORS/proxy:** browser→Anthropic calls may need a proxy. Prefer routing through the existing
  auth/Express server ([`server/`](../../../server/)) as a thin pass-through that injects nothing
  and forwards the user's key, OR document a direct-call path if Anthropic CORS allows it. Do not
  log prompts or keys server-side.

### What we send (prompt input)

- Per initiative: title, rollup status, target date + slip vs. Compare-to, the Idea 1
  `changeReason` (blocked/warning/slipped/status-changed), the driving child issues, and
  optionally their latest comments (Idea 6 data). **Structured, minimal** — not raw issue dumps.
- Keep payloads small and **redact** anything sensitive per project policy; make the fields sent
  explicit and reviewable.

### Generation flow

- On demand ("Summarize this board" / per-card "Generate"), not automatically on every load
  (cost + latency). Show a loading state per card.
- Batch/queue requests with concurrency limits and backoff; cache results (React Query
  key-factory keyed by issue + a hash of the input data) so unchanged initiatives aren't
  re-summarized.
- Optionally **persist** the generated text back to Jira via
  [Idea 3](../status-summary/requirements.md)/[Idea 4](../user-typed-summary/requirements.md)
  so it's shareable and doesn't need regenerating — with a clear "AI-generated" provenance tag.

### Display

- Idea 2 surface with `source: 'ai'`, an explicit "AI-generated" badge, and the input timestamp.
  Never present AI text as authored fact without the badge.

## Acceptance criteria

- [ ] User can add/clear an Anthropic key stored locally (never in URL/shared report data).
- [ ] A per-card / per-board action generates summaries from structured status+change data (not
      raw dumps); results render via the Idea 2 surface with an "AI-generated" badge.
- [ ] Requests are batched with concurrency limits + backoff and cached; unchanged initiatives
      are not re-generated.
- [ ] Failures (bad key, 429, network) surface per-card without breaking the board.
- [ ] No key or prompt is logged; the exact data sent is documented and minimal.
- [ ] Prompt-building + caching key logic covered by unit tests (mock the AI client).

## Open questions

- Direct browser call vs. proxy through `server/`? (Leaning proxy for CORS + to avoid embedding
  key handling in the client bundle.)
- Which model / cost ceiling; do we expose model choice?
- Auto-persist generated summaries to Jira, or keep them ephemeral per session?
- Should generation be gated behind the Idea 1 filter (only summarize "needs attention" cards) to
  cut cost?

## Effort & risk

- **Effort:** High (key management, proxy/CORS, prompt design, batching/caching, provenance,
  optional write-back).
- **Risk:** High — **security** (user key handling), **cost/latency**, and **accuracy**
  (hallucinated status is worse than none). Requires the Idea 1 change signals to be trustworthy
  first.
- **Evaluation notes:** highest coverage and lowest human effort; highest engineering + trust +
  cost burden. Best as an **augmentation** (draft that a human edits via Idea 4), not the sole
  source of truth.

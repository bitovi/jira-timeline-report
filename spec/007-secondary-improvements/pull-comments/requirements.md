# Idea 6 — Pull the last comment (or driving child comments)

> One of five competing **summary source** approaches. Renders through
> [Idea 2 — Summary card display](../summary-card-display/requirements.md).

## Problem

The narrative already exists in Jira most of the time — as the **latest comment** on the
initiative, or on the **child issue that caused the change** (the blocker, the slipping story).
Instead of asking people to write a new summary, we can surface the most relevant existing
comment(s) so the reader sees "what someone last said about this".

## User value

- **No new authoring discipline and no admin setup** — uses comments teams already write.
- Especially useful paired with [Idea 1](../filter-changed-and-blocked/requirements.md): show the
  latest comment on the specific child that triggered blocked/warning/slip.
- Good default content even when no one wrote a dedicated exec summary.

## How it might work

### What to pull

- **Initiative-level:** the newest comment on the primary issue.
- **Change-driven (better):** when Idea 1 identifies the child(ren) responsible for a
  blocked/warning/slip (the pipeline already tracks `blockedStatusIssues`, `warningIssues`, and
  `dueTo`/`startFrom` "driven by" references in `rollupStatuses`), pull the newest comment on
  **those** children. This ties the narrative to the actual cause.

### Read — rate-limit sensitive

Same constraints as [Idea 5](../exec-summary-comment/requirements.md): comments aren't fetched
today and per-issue fetching caused rate limiting ([spec/001](../001-comments-causing-rate-limiting.md)).

- Scope to a **small, targeted set**: the visible primary issues plus only the specific
  change-driving children — not the whole tree.
- Prefer inline expand on the primary search, or a **bulk/batched** comment fetch, with React
  Query caching (key-factory).
- Only the **latest 1** comment per targeted issue is needed for the card (more in the popup).

### Adapter & display

- `getSummary(issue)` returns the newest targeted comment, ADF→text, truncated, with
  `source: 'comment'`, author, and time. Because this is un-curated content, clearly label it as
  "Latest comment" (not "Executive summary") so readers calibrate trust.
- The popup can show a short thread (last few comments) for context.

### Noise handling

- Latest comments are noisy (automation comments, "moved to sprint 12", @mentions). Add light
  filtering: skip comments from bot/app authors, optionally skip very short comments, and prefer
  human authors. Make this best-effort, not clever.

## Acceptance criteria

- [ ] Cards show the latest relevant comment (initiative-level, or change-driving child when the
      filter identifies a cause), via the Idea 2 surface, labeled "Latest comment" with author +
      time.
- [ ] Comment fetching is scoped to primary/visible + driving-child issues only, batched/cached —
      no per-child-tree fetch, no rate-limit regression.
- [ ] Bot/automation-authored comments are de-prioritized/filtered.
- [ ] Issues with no suitable comment fall back to the swatch view.
- [ ] Targeting logic (which child's comment to pull) and ADF→text covered by unit tests.

## Open questions

- Initiative-latest vs. change-driving-child — do both, with change-driving preferred when
  available?
- How aggressive should bot/noise filtering be? (Start with an author-type/app-user skip list.)
- Truncation length on the card vs. thread depth in the popup.

## Effort & risk

- **Effort:** Medium–High (comment fetch plumbing + targeting the right child + noise filtering).
- **Risk:** Medium–High — **rate limiting** plus **relevance/noise**: the latest comment is often
  not a real status narrative. Highest chance of showing low-value text.
- **Evaluation notes:** best "works with zero effort from users" story; weakest signal quality.
  Strong as a _fallback_ content source behind field/marker approaches.

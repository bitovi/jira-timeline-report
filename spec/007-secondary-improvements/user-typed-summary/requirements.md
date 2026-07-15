# Idea 4 — User-typed summary saved back to Jira

> One of five competing **summary source** approaches. Renders through
> [Idea 2 — Summary card display](../summary-card-display/requirements.md). This idea is the
> **write/authoring UX**; where the text is stored reuses either
> [Idea 3 (custom field)](../status-summary/requirements.md) or
> [Idea 5 (EXEC SUMMARY comment)](../exec-summary-comment/requirements.md).

## Problem

Even with a place to store summaries, people won't leave the report to open Jira and edit a field
or add a comment. We want the reader/PM to **type a short summary directly on the card** during
(or right after) a status review and have it persist to Jira so it shows next time and for
everyone.

## User value

- Zero context-switch: write the narrative where you're reading the status.
- The report becomes the authoring tool for exec summaries, driving adoption of ideas 3/5.
- Everyone sees the same text next load (it's stored in Jira, not local).

## How it might work

### Authoring UX

- Each card gets an **edit affordance** (pencil / "Add summary") in the Idea 2 summary block.
- Clicking opens an inline editor (textarea or a light rich-text control). Keep it small —
  plain text or a safe markdown subset.
- Save / Cancel. Save is optimistic: the card shows the new text immediately with a "saving…"
  state, then confirms or rolls back on error.

### Persistence (reuses a storage target)

Two storage targets, selectable by config:

1. **Custom field** (preferred, from Idea 3) — write via `editJiraIssueWithNamedFields`
   ([`jira.ts`](../../../src/jira-oidc-helpers/jira.ts)); wrap text as ADF for a paragraph field.
   Single canonical value, easy to re-edit.
2. **Comment with marker** (from Idea 5) — `POST /rest/api/3/issue/{key}/comment` with an
   `EXEC SUMMARY` marker. Preserves history (every edit is a new comment) but needs comment
   read to display (rate-limit care).

Recommend **custom field** as the default storage for the typed-summary flow — one value,
cleanest re-edit, rate-limit-safe read.

### Service layer

- Add a `useUpdateSummary` mutation in
  [`src/react/services/jira/`](../../../src/react/services/jira/) (`useMutation`, optimistic
  update, invalidate the issues query / patch the cache).
- Author + timestamp come from the current user (available via auth/serverInfo) and `now()`;
  stored/displayed as provenance in the Idea 2 `summary` object with `source: 'user'`.
- Requires `write:jira-work` scope (already requested — `.env` `VITE_JIRA_SCOPE`).

### Permissions & conflicts

- Hide the edit affordance if the user lacks edit permission (best-effort; Jira will 403 on save
  otherwise — surface a friendly error and roll back).
- Last-write-wins for v1; note a possible stale-overwrite if two people edit at once (accept for
  v1, revisit with field version checks).

## Acceptance criteria

- [ ] Each card exposes an inline "add / edit summary" editor.
- [ ] Saving writes to the configured target (custom field default) via a mutation with
      optimistic UI and error rollback.
- [ ] The saved summary displays via the Idea 2 surface with `source: 'user'` provenance
      (author + time).
- [ ] Save failures (permission/network) show a non-destructive error and restore prior text.
- [ ] Mutation + optimistic cache update covered by tests (mock the jira client, as in existing
      service tests).

## Open questions

- Rich text vs. plain text in the editor? (Proposed: plain text v1; ADF-wrap on write.)
- Default storage target — custom field vs. comment? (Proposed: custom field.)
- Do we need edit history / who-changed-what? If yes, the comment target (Idea 5) wins despite
  the read cost.

## Effort & risk

- **Effort:** Medium (inline editor + mutation + optimistic UI + permission handling).
- **Risk:** Medium — write path, permissions, and conflict handling. Depends on a storage target
  (3 or 5) being chosen.
- **Evaluation notes:** highest engagement/adoption lever, but only as good as the storage target
  it writes to.

# Idea 5 — "EXEC SUMMARY" marker comment

> One of five competing **summary source** approaches. Renders through
> [Idea 2 — Summary card display](../summary-card-display/requirements.md).

## Problem

Custom fields ([Idea 3](../status-summary/requirements.md)) require a Jira admin to create
and standardize a field — a real adoption blocker. Comments need **no setup**: anyone can add
one. If we agree on a convention — a comment whose text starts with a marker like
`EXEC SUMMARY:` — the report can find and surface the latest such comment as the card's summary.

## User value

- **Zero Jira configuration** — works in any project immediately.
- Authoring is a normal Jira comment (from Jira or from the report via
  [Idea 4](../user-typed-summary/requirements.md)).
- History is preserved — every update is a new marked comment; the report shows the newest.

## How it might work

### Convention

- A summary comment is any comment whose (rendered/plain) body begins with a case-insensitive
  marker, e.g. `EXEC SUMMARY:` (configurable string). The text after the marker is the summary.
- The **most recent** marked comment wins. Older ones remain as history (surfaced in the popup).

### Read — the rate-limit-sensitive part

Comments are **not** fetched today, and per-issue fetching previously caused rate limiting
([spec/001](../001-comments-causing-rate-limiting.md)). Options, cheapest first:

1. **JQL prefilter + narrow fetch.** Only initiatives (primary issues) need summaries, and only
   the ones **currently visible** (especially when combined with the Idea 1 filter). Fetch
   comments for that small set on demand, not for the whole child tree.
2. **`renderedFields` / `comment` expand on the primary-issue search.** The search API can expand
   comment data inline for the primary issues only, avoiding N follow-up calls.
3. **Lazy per-card fetch.** Fetch a card's comments only when it scrolls into view / is expanded,
   cached via React Query key-factory.

Whichever path: scope to **primary issues**, cap the count, and cache aggressively. Never fetch
comments for every child.

### Adapter

- `getSummary(issue)` scans the issue's fetched comments for the newest marker match, strips the
  marker, converts ADF→text, and returns the Idea 2 `summary` object with `source: 'comment'`,
  `author`, and the comment `created`/`updated`.

### Write

- Reuse [Idea 4](../user-typed-summary/requirements.md): "save summary" posts a new
  `EXEC SUMMARY:`-prefixed comment via `POST /rest/api/3/issue/{key}/comment`.

## Acceptance criteria

- [ ] The report identifies the newest `EXEC SUMMARY:` (configurable marker) comment per primary
      issue and renders it via the Idea 2 surface with author + time.
- [ ] Comment fetching is scoped to primary/visible issues, capped, and cached — no per-child
      fetch, no measurable rate-limit regression.
- [ ] Marker matching is case-insensitive and strips the marker from the displayed text.
- [ ] Issues with no marked comment fall back to the swatch view.
- [ ] Parsing (marker match, newest-wins, ADF→text) covered by unit tests.

## Open questions

- Marker string + format — `EXEC SUMMARY:` prefix vs. a `{panel}`/label convention? Keep it a
  simple configurable prefix.
- Fetch strategy — expand-on-search vs. lazy-on-view? Decide after measuring comment payload size
  for typical primary-issue counts.
- Should we show the last N marked comments as a mini timeline in the popup?

## Effort & risk

- **Effort:** Medium (comment fetch plumbing + caching + parser). Higher than the custom-field
  read because comments aren't in the pipeline today.
- **Risk:** Medium — **rate limiting** is the primary risk; mitigated by scoping to primary/
  visible issues and caching. Convention drift (people forget the marker) reduces coverage.
- **Evaluation notes:** best "no admin setup" story; the trade is comment-fetch cost and reliance
  on a human-followed convention.

# 029 — Status Update: match the previous week, not the current week

## Context

The Status Update derived field (`spec/027-status-updates`) matches a
`Status update`-prefixed comment **created** within the current Monday–Monday
(UTC) week, per `pickStatusUpdate` in
`src/react/reports/ReportOfReports/model/statusUpdate.ts` and the window built
by `weekContaining(Date.now())` in
`src/react/reports/ReportOfReports/hooks/useStatusUpdate.ts:43`.

In practice, reports get viewed early in the week — Monday morning, before
anyone has posted this week's update — and the field reads "No status update
has been posted yet." even though a genuine update from last week exists and
is still the current news. `spec/027-status-updates/plan.md` never considered
this scenario; the current-week window was an unexamined default, not a
deliberate choice.

### Decisions

1. **Window** — match the week **before** the current one (still Monday
   00:00 UTC → the following Monday 00:00 UTC, half-open), not the current
   week. `pickStatusUpdate(comments, week)` is unchanged — it already takes
   the window as a plain parameter; only the caller's choice of window moves.
2. **Match rule / tie-break** — unchanged. `created` still decides which
   comments are eligible for the (now previous) week; `updated` (falling back
   to `created`) still breaks ties toward the most recently edited match.
   Prefix stays a hardcoded, literal, case-insensitive `startsWith('status
update')` on the comment's first block.
3. **Configurable prefix / span / match-count** — discussed and explicitly
   **deferred**, not built in this change (see Future work below).

---

## Changes

### 1. `src/react/reports/ReportOfReports/model/currentWeek.ts`

Add `previousWeekContaining(time)`, the week immediately before the one
containing `time`:

```ts
export const previousWeekContaining = (time: number): WeekWindow => {
  const end = startOfWeekUTC(time);
  return { start: end - WEEK_MS, end };
};
```

Keep `weekContaining` — it's still the building block `previousWeekContaining`
is defined against, and tests use it to construct fixture windows. Update the
file's top doc comment to describe both windows.

### 2. `src/react/reports/ReportOfReports/hooks/useStatusUpdate.ts`

- Line 43: `weekContaining(Date.now())` → `previousWeekContaining(Date.now())`.
- Update the doc comment ("This week's status update...") → "Last week's
  status update...".
- No other change: `pickStatusUpdate`, `isWithinWeek`, and
  `isStatusUpdateComment` are all window-agnostic already.

### 3. `src/react/reports/ReportOfReports/ReportOfReports.tsx`

- `StatusUpdateView`'s doc comment ("This week's status update on a work
  item...") → "Last week's status update...".
- `emptyNote` (currently `"No status update has been posted yet."`) → reword
  to name the window, e.g. `"No status update was posted last week."`, so the
  empty state matches what was actually checked.

### Caveat: the fetch is not actually windowed (carried forward, not solved here)

Jira's comment endpoint has no date-range filter — `orderBy` only accepts
`created` / `-created` / `+created`, and there is no server-side "comments
since X" query. So this feature was never fetching "last week's comments"; it
fetches one flat page of the 100 most-recently-_created_ comments on the
issue (`COMMENT_SCAN_SIZE` in `jira-oidc-helpers/jira.ts`, `orderBy=-created`)
and filters that page down to the target week **client-side**, in
`pickStatusUpdate`/`isWithinWeek`. The 100-comment page is a _guess_ dressed
up as a bound, not a real query.

Shifting the matched window back one week (this change) makes that guess
looser: the current (now-ignored) week's comments and last week's now compete
for slots in the same 100-comment page, where before only one week's worth
did. A sufficiently chatty current week could push a genuine previous-week
status update out of the page entirely, and the feature would silently show
the empty state instead of a wrong-but-plausible answer — no error, just a
false "nobody posted one."

This is the same scan-limit trade-off `spec/027-status-updates/plan.md` §
The scan limit already accepted for a single week (added a line there noting
it now spans two weeks of activity instead of one). It's rare in practice —
a single work item would need 100+ comments within the two covered weeks —
but it is not theoretical, and it gets strictly worse if `Future work`'s
configurable span ever ships (a "Last 2 weeks" or "Last 4 weeks" preset
would stretch the same fixed 100-comment page over 3–5 weeks of activity).
**Not addressed here.** If it needs to be addressed: either grow
`COMMENT_SCAN_SIZE` to scale with the span, or replace the flat fetch with a
real paging loop that stops once the whole target window has been covered
(the endpoint's `startAt`/pagination fields would drive that).

---

## Tests to update

- **`model/currentWeek.test.ts`** — add a suite for `previousWeekContaining`,
  mirroring the existing boundary-pair pattern used for `weekContaining`.
- **`model/statusUpdate.test.ts`** — no changes needed; `pickStatusUpdate` is
  tested against explicit `WeekWindow` values and doesn't know which helper
  produced them.
- **`hooks/useStatusUpdate.test.tsx`** — shift fixtures that post a comment
  "this week" (relative to the mocked now) to "last week" instead; add/flip a
  case confirming a comment created in the _current_ week is now correctly
  ignored — mirroring the flip commit `1568d1b1` made for the
  created-vs-updated fix.
- **`ReportOfReports.test.tsx`** (`describe('status update values', …)`) —
  its fixture helper builds dates off `startOfWeekUTC(Date.now())`; rebuild
  off the previous week's Monday instead.

## Verification

- Run the updated/added tests above.
- Manually: a work item with a `Status update:` comment created last week
  (none this week) should show that update; a work item with only a comment
  from the current week should show the empty state.

---

## Future work — configurable prefix and span (deferred)

Discussed with the user (2026-08-26) and explicitly out of scope for this
change:

- **What's configurable**: the match prefix (free text, still a literal
  case-insensitive `startsWith`) and the week span.
- **Span input**: a dropdown of presets (e.g. _Previous week_ / _This week_ /
  _Last 2 weeks_), not a numeric "weeks back" field or a freeform
  relative-date string like `-1w` — the app has no existing precedent for
  relative-date strings, and dropdowns are the established pattern for
  enum-like report settings (`RoundDatesTo`, `GroupBy`, etc. in
  `ReportControls/components/ViewSettings`).
- **Setting scope**: a **global, report-wide** setting (alongside
  `TeamConfiguration` in the Settings Sidebar), not per-node. There's no
  existing per-node config plumbing on `InlineValueNode` (`params` is just
  `{ expression }` today), and nodes are immutable after creation — a
  per-node setting would need new machinery for little payoff over one
  report-wide choice.
- **Match count**: no new concept needed. Confirmed the field should keep
  resolving to a single, most-recently-edited winner, same as today —
  `pickStatusUpdate`'s `[0]` of a sort stays as-is.

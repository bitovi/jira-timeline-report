# Filter: show changed / blocked / warning work

## Problem

The primary report (Gantt/Scatter) and the secondary report (Work Breakdown & Status) both show
**every** issue, and the secondary report's cards list **every** child. In a status meeting the
reader has to scan the whole board to find what actually needs attention. We want a filter that
collapses either report down to the items that changed, or are currently blocked/at risk.

## User value

- Fewer cards/rows/bars to read during a status review — the view becomes an "exceptions list."
- Works the same way, with the same control, on **both** the primary report and the secondary
  (Work Breakdown) report — but as two **independent** filters, so a user can, for example, keep
  the Gantt chart showing everything while narrowing the Work Breakdown board to just what
  changed.
- Reuses the same interaction users already know from Jira Plans' filter bar (field / operator /
  value rows, "+ Add filter", "×" to remove a row, "Clear all filters").

## Two different "status" concepts (important distinction)

- **Jira Status** — the literal `issue.status` (e.g. "In Progress", "Done", "Idea"). This is what
  today's Filters dropdown already filters on.
- **Rollup Status** — the app's own computed status
  (`rollupStatuses.rollup.status`: `On Track` / `Behind` / `Ahead` / `Blocked` / `Warning` /
  `Complete` / `Not Started` / `Unknown`). "Blocked" and "Warning" are already values of this field
  today — showing "blocked/warning work" needs no new derivation, just a way to filter on it.
- **Newly started / Newly completed / Newly dated** — three brand-new signals (don't exist yet):
  whether the issue's dates moved in a meaningful way since the Compare-to period. Presented as
  three more selectable values of the Rollup Status field (see below), not a third status concept.
  Selecting all three reproduces the original single "anything changed" idea; selecting just one
  narrows to that specific transition (e.g. only newly-completed work).

## The control: a generic filter-row builder

Modeled on Jira Plans' filter bar: a list of rows, each with a **Field**, an **Operator**, and a
**Value** (multi-select), a "×" to remove that row, a "+ Add filter" button, and a "Clear all
filters" action. Rows **AND** together; a row's multi-select value **ORs** together — so one row
expresses everything this feature needs:

> **Rollup Status** · is any of · `[Blocked, Warning, Newly started, Newly completed, Newly dated]`

= "blocked OR warning OR changed (in any of the 3 ways) since last period," in a single row.

This is not a full rebuild of the whole Filters system — only two fields are generalized this way:

| Field         | Operator(s) | Value                                                                                                                                                           | Notes                                                                             |
| ------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Jira Status   | is / is not | multi-select of literal statuses, with counts (e.g. `"Done (9)"`)                                                                                               | Replaces today's `StatusFilter`; same underlying data (`useSelectableStatuses()`) |
| Rollup Status | is / is not | multi-select of `On Track / Behind / Ahead / Blocked / Warning / Complete / Not Started / Unknown / Newly started / Newly completed / Newly dated`, with counts | New field; the 3 "Newly ..." values are independently selectable                  |

`IssueTypeFilters` (unknown initiatives, semver releases, releases-to-show) and `DateRangeFilter`
are **not** part of this generalization — they stay as separate sections in the Filters dropdown,
unchanged.

## What "Newly started / Newly completed / Newly dated" mean (pure date-driven — no Jira status)

This app derives truth from **dates**, not Jira status categories, so each of these is defined
purely by comparing the same raw start/due dates at two points in time — **today** and the
Compare-to period's timestamp (`when`) — with no reconstruction of a prior-period status category.
Each is an independently selectable value; select more than one to OR them together (select all
three to get the original "anything changed" behavior):

- **Newly started** — has a start date on/before today, but as of the Compare-to period it had
  none, or hadn't been reached yet.
- **Newly completed** — has a due date on/before today, but as of the Compare-to period it hadn't
  passed yet (mirrors the existing "due date passed → complete" rule, evaluated at two points in
  time).
- **Newly dated** — had no start or due date at all as of the Compare-to period, but has one now.

If there's no prior period to compare against (e.g. the issue didn't exist before, or Compare-to is
effectively "now"), all three are `false` (fail closed — nothing to compare).

**Explicitly out of scope:**

- Reconstructing a full prior-period status (`behind`/`ahead`/`ontrack`) — unreliable without a
  second prior period to compare against, and prone to misleading "improvements" that are really
  just "it didn't slip _again_ this period."
- Jira `statusCategory` transitions (e.g. To Do → In Progress) — this app's source of truth is
  computed dates, not Jira's own status workflow.
- Story-point / estimation changes ("went from unestimated to estimated") — the rollback pipeline
  (`rollback.ts`) has no changelog handler for story points, so this isn't reliably derivable
  without adding new pipeline work; out of scope here.

Blocked and Warning are **not** part of these — they're plain, always-current-state values (we
always want to see currently-blocked/warning work, not just newly-blocked/warning work).

## Two independent instances of the same control

1. **Primary** — lives in the existing Filters dropdown, filters the shared issue list that feeds
   the Gantt/Scatter/Table report _and_ (indirectly, since it consumes the same list) which primary
   issues appear as Work Breakdown cards.
2. **Secondary** — a new, second Filters control shown only when a secondary report
   (`secondaryReportType !== 'none'`) is active. Has its own independent state and is split into two
   scopes:
   - **Card filters** (`secondaryFilterRows`) decide whether a card/primary issue shows.
   - **Child filters** (`secondaryChildFilterRows`) trim which children render within an
     already-shown card (a card can render with zero matching children).

These are two separate route-persisted states — filtering the primary report does not affect the
secondary report's filter and vice versa.

## Legacy URL / saved-report compatibility

Old `statusesToShow`/`statusesToRemove` URL params are migrated automatically: the first time
they're present and the new filter-rows state is empty/unset, they're seeded in as an equivalent
`Jira Status` row, so existing bookmarks and saved reports keep working without modification.

## Empty state

When a filter is active and it removes everything, show a distinct message ("Nothing matches the
current filters") rather than the generic "Unable to find any issues."

## Acceptance criteria

- [ ] A generic filter-row control (field/operator/value, add/remove row, clear all) replaces
      today's Jira-Status-only filter in the primary Filters dropdown.
- [ ] The Rollup Status field offers `On Track / Behind / Ahead / Blocked / Warning / Complete /
  Not Started / Unknown / Newly started / Newly completed / Newly dated` as selectable values,
      each showing a count.
- [ ] `Rollup Status is any of [Blocked, Warning, Newly started, Newly completed, Newly dated]`
      (one row) shows exactly the "needs attention" set described above, on both reports.
- [ ] The primary filter narrows the Gantt/Scatter/Table report and the Work Breakdown cards
      (shared list). A second, independent Filters control appears only when the secondary report
      is on, and narrows the Work Breakdown board (cards + child rows) on top of/independently from
      the primary filter.
- [ ] Newly started/Newly completed/Newly dated each reflect the Compare-to slider; changing the
      slider changes what's flagged.
- [ ] Old `statusesToShow`/`statusesToRemove` URLs still filter correctly on first load.
- [ ] Distinct empty state when a filter removes everything.
- [ ] Pure helpers (`filter-rows.ts`, the date-based derivations) covered by unit tests with inline
      fixtures (mirrors existing `buildBoard.test.ts`/`work-status.test.ts` style).

## Open questions

- Label for the new secondary Filters trigger button — "Filters" (matches the primary button,
  positionally scoped) vs. "Secondary Filters" (more explicit but longer)?

## Effort & risk

- **Effort:** Medium. The generic filter-row UI + predicate module is a clean, self-contained
  addition; the 3 new derivations are a small, purely additive change to `work-status.ts` (three
  independent date comparisons, no status-category logic); wiring touches several existing files
  (`Filters.tsx`, `route-data.js`, `timeline-report.js`, `buildBoard.ts`) but each change is
  additive/replacing a narrow existing block.
- **Risk:** Low-medium. The riskiest-looking part of the original idea (reconstructing a full
  prior-period status category) was replaced with simple, reliable date comparisons on data the
  pipeline already carries correctly (`issueLastPeriod.rollupDates`) — nothing today reads these new
  flags, so they can't regress existing behavior. The legacy `statusesToShow`/`statusesToRemove`
  migration needs care/tests so old bookmarks don't silently lose their filter.
- **Prereq for:** none identified; independent of the AI-summary/exec-summary ideas in this spec
  folder.

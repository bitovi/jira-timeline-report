# Implementation Plan — Filter: changed / blocked / warning

## Goal

Add a generic, Jira-Plans-style **filter row** control (field / operator / value, "+ Add filter",
"×" per-row remove, "Clear all filters") that replaces today's single-purpose `StatusFilter`, and
extend it with a new **Rollup Status** field so users can show only work that is `Blocked`,
`Warning`, and/or has **Newly started**, **Newly completed**, or **Newly dated** work since the
Compare-to period. The same control is mounted **twice**, independently: once in the existing
primary `Filters` dropdown (filters the shared issue list feeding the Gantt/Scatter/Table reports),
and once in a new secondary-report-only `Filters` dropdown that additionally narrows the
WorkBreakdown board's cards and child rows.

## Architecture

- One reusable, presentation-only `FilterRowsBuilder` React component + one pure predicate module
  (`filter-rows.ts`) shared by both the CanJS primary-issue pipeline (`timeline-report.js`) and the
  TypeScript WorkBreakdown pipeline (`buildBoard.ts`).
- Two independent route-persisted row arrays (`filterRows`, `secondaryFilterRows`) — no shared
  state between the primary and secondary filters.
- "Newly started"/"Newly completed"/"Newly dated" are **not** reconstructed status categories.
  They're three narrow, pure date comparisons computed once in the existing rollup pipeline
  (`work-status.ts`) and exposed as three independent booleans on `rollupStatuses.rollup`, which
  the generic filter just reads.

## Key design decisions (from discussion)

1. **Two status concepts stay distinct.** "Jira Status" = literal `issue.status` (today's
   `StatusFilter`). "Rollup Status" = the already-computed `rollupStatuses.rollup.status`
   (`ontrack`/`behind`/`ahead`/`blocked`/`warning`/`complete`/`notstarted`/`unknown`). They are two
   separate fields in the new builder, not merged.
2. **Newly started / Newly completed / Newly dated are independently selectable values** inside
   the Rollup Status field, not one combined "Changed" value. A row like `Rollup Status · is any
of · [Blocked, Warning, Newly started, Newly completed, Newly dated]` expresses "blocked OR
   warning OR any of the 3 change types" in one row, because a row's value multi-select already
   ORs its selections. Selecting all 3 "Newly ..." values reproduces the original single "anything
   changed" idea; selecting just one narrows to that specific transition. Rows across different
   fields AND together (Jira Plans semantics) — no cross-row AND/OR toggle needed.
3. **Blocked/Warning are plain current-state values** — always show all currently-blocked/warning
   work, not just newly-blocked/warning. Zero new derivation; `rollupStatuses.rollup.status` already
   holds these values today.
4. **"Newly started"/"Newly completed"/"Newly dated" are 100% date-driven, not Jira-status-driven.**
   This app derives truth from dates, not `statusCategory`. Each is an independent check, each
   comparing the same raw `rollupDates.start`/`rollupDates.due` fields at two points in time —
   **today** and **`when`** (the rollback timestamp already computed in `timeline-report.js` as
   `new Date(Date.now() - compareTo * 1000)`, which needs to be threaded one level deeper into
   `work-status.ts`, since it isn't today):
   - **Newly started** — has a start date on/before today, but as of `when` it had none or hadn't
     arrived.
   - **Newly completed** — has a due date on/before today, but as of `when` it hadn't passed yet
     (mirrors the existing "due date passed → complete" rule in `timedStatus`, just evaluated
     twice).
   - **Newly dated** — had no start/due at all as of `when`, but has one now.
   - No-prior-period (`issueLastPeriod` missing, e.g. Compare-to is "now") → all three are `false`
     (fail-closed; nothing to compare against).
   - Explicitly **not** used: `statusCategory` (Jira-status-based, rejected), and story-point
     "estimated" transitions (`rollback.ts` has no changelog handler for story points today, so
     `issueLastPeriod.storyPoints` always equals the current value — not derivable without adding a
     new rollback handler, which is out of scope here).
5. **Only 2 fields are generalized.** `IssueTypeFilters` (unknown initiatives, semver releases,
   releases-to-show) and `DateRangeFilter` stay exactly as they are today, as separate sections
   below the new filter rows in the primary `Filters` dropdown. This is not a full rebuild of the
   Filters system.
6. **Legacy URL/saved-report compatibility.** Old `statusesToShow`/`statusesToRemove` params are
   seeded into `filterRows` as an initial `Jira Status` row the first time they're read (if
   `filterRows` itself is empty/unset), so existing bookmarks and saved reports don't lose their
   filter.
7. **Value options show counts**, matching today's `StatusFilter` (`"Done (9)"`). Rollup Status
   values get the same treatment (`"Blocked (3)"`, `"Newly completed (5)"`), which requires
   threading the rolled-up issue list to the `Filters` component tree for the first time (see Task
   5).

## File structure

```
src/jira/rollup/filter-rows/
  filter-rows.ts               # FilterRow types + matchesFilterRow/matchesAllFilterRows (pure)
  filter-rows.test.ts

src/jira/rolledup/work-status/
  work-status.ts                # + `when` param, + newlyStarted/newlyCompleted/newlyDated flags
  work-status.test.ts            # + Newly started/completed/dated/no-prior-period cases

src/react/reports/WorkBreakdown/
  types.ts                       # RollupStatus.{newlyStarted,newlyCompleted,newlyDated}?: boolean
  helpers/buildBoard.ts          # + filterRows param, card/child-row filtering
  helpers/buildBoard.test.ts
  WorkBreakdown.tsx              # + filterRowsObs prop

src/react/ReportControls/components/Filters/
  Filters.tsx                    # StatusFilter -> FilterRowsBuilder
  components/FilterRowsBuilder/
    FilterRowsBuilder.tsx
    FilterRowsBuilder.test.tsx
    index.ts
  hooks/useFilterRows/useFilterRows.ts     # mirrors useStatusFilters shape
  hooks/useSelectableRollupStatuses/useSelectableRollupStatuses.ts

src/react/ReportControls/components/SecondaryFilters/
  SecondaryFilters.tsx            # thin wrapper: DropdownMenu + FilterRowsBuilder, gated visibility
  index.ts

src/react/ReportControls/ReportControls.tsx   # mount <SecondaryFilters /> next to <Filters />
src/canjs/routing/route-data/route-data.js     # + filterRows, + secondaryFilterRows params
src/timeline-report.js                          # primaryIssuesOrReleases filter chain, thread `when`,
                                                 # thread rolled-up issues into ReportControls mount
```

## Steps

### Task 1 — Pure `filter-rows.ts` predicate module

**Files:** create `src/jira/rollup/filter-rows/filter-rows.ts` + `.test.ts`

- `type FilterField = 'jiraStatus' | 'rollupStatus'`
- `type FilterOperator = 'is' | 'is not'`
- `type FilterRow = { id: string; field: FilterField; operator: FilterOperator; value: string[] }`
- `matchesFilterRow(issue, row)`:
  - `jiraStatus` → reads `issue.status` (Releases: `.some()` over `childStatuses.children`, same
    rule `timeline-report.js` uses today).
  - `rollupStatus` → reads `issue.rollupStatuses.rollup.status`, **except** the values
    `'newlyStarted'`/`'newlyCompleted'`/`'newlyDated'`, which instead read
    `issue.rollupStatuses.rollup.newlyStarted/newlyCompleted/newlyDated === true`.
  - `'is'` → true if any selected value matches (OR). `'is not'` → true if no selected value
    matches.
- `matchesAllFilterRows(issue, rows)` → ANDs `matchesFilterRow` over all rows; `rows.length === 0`
  → always `true`.
- Rollup Status value list = `STATUS_LEGEND_ORDER` (`statusClass.ts`) + `{ value: 'newlyStarted',
label: 'Newly started' }` + `{ value: 'newlyCompleted', label: 'Newly completed' }` + `{ value:
'newlyDated', label: 'Newly dated' }`.
- Tests: `is` OR-within-row, `is not`, AND-across-rows, each of the 3 new values
  true/false/no-prior-period, empty rows array.

### Task 2 — Newly started/completed/dated derivation in `work-status.ts` (depends on nothing,

parallel with Task 1)

**Files:** modify `src/jira/rolledup/work-status/work-status.ts` + `.test.ts`,
`src/react/reports/WorkBreakdown/types.ts`

- Extend `calculateReportStatuses(issues)` → `calculateReportStatuses(issues, when: Date)`.
- Add a pure helper implementing the 3 independent checks from decision #4 above, given
  `current: { start, due }`, `lastPeriod: { start, due } | null`, `when: Date`, `today: Date`,
  returning `{ newlyStarted, newlyCompleted, newlyDated }` (three separate booleans — no combined
  OR'd flag needed).
  Store the result as `timingData.rollup.newlyStarted`/`newlyCompleted`/`newlyDated`.
- `src/react/reports/WorkBreakdown/types.ts`: add `newlyStarted?: boolean`, `newlyCompleted?:
boolean`, `newlyDated?: boolean` to `RollupStatus`.
- Update the one call site (`timeline-report.js`'s `rolledupAndRolledBackIssuesAndReleases`
  getter) to pass `when` through.
- Tests: Newly started, Newly completed, Newly dated, no-prior-period → all `false`, and a case
  that is none of the three (dates identical at both points in time).

### Task 3 — `FilterRowsBuilder` component (depends on Task 1 for types/value lists)

**Files:** create `src/react/ReportControls/components/Filters/components/FilterRowsBuilder/`

- Props: `rows: FilterRow[]`, `onChange(rows: FilterRow[]): void`, `fieldDefinitions: { field:
FilterField; label: string; operators: FilterOperator[]; options: { value: string; label:
string }[] }[]`.
- Renders one row per entry using `FilterGrid`: Field `Select`, Operator `Select`, Value `Select`
  (`isMulti`), an "×" remove-row button. Below the rows: "+ Add filter" button (appends a new row
  defaulted to the first field definition) and a "Clear all filters" text button (empties the
  array). Changing a row's Field resets its Value to `[]` and Operator to the first allowed
  operator for that field.
- Tests (RTL): add a row, remove a row, change field resets value, change operator, clear all.

### Task 4 — Wire the primary `Filters` dropdown (depends on Tasks 1, 3)

**Files:** modify `route-data.js`, `Filters.tsx`; create `hooks/useFilterRows/`

- `route-data.js`: add `filterRows: saveJSONToUrlButAlsoLookAtReport_DataWrapper('filterRows', [],
Array, JSON)`. In its `parse`, if the resolved value is empty AND either `statusesToShow` or
  `statusesToRemove` is non-empty, seed one `Jira Status` row from whichever is set (`is` for
  `statusesToShow`, `is not` for `statusesToRemove`) — the legacy migration from decision #6.
- New `useFilterRows()` hook (mirrors `useStatusFilters` shape) wrapping `useRouteData<FilterRow[]>
('filterRows')`.
- `Filters.tsx`: replace `<StatusFilter {...statusFilterControls} />` with `<FilterRowsBuilder
rows={filterRows} onChange={setFilterRows} fieldDefinitions={[jiraStatusFieldDef,
rollupStatusFieldDef]} />`. `IssueTypeFilters`/`DateRangeFilter` sections are untouched.
- `timeline-report.js`'s `primaryIssuesOrReleases` getter: replace the `statusesToShow`/
  `statusesToRemove` block with `matchesAllFilterRows(issueOrRelease, this.routeData.filterRows)`
  (Release branch keeps its existing `childStatuses.children` check via the `jiraStatus`-on-release
  rule in `filter-rows.ts`).

### Task 5 — Rollup Status counts + rolled-up data plumbing (depends on Task 4)

**Files:** modify `timeline-report.js` (the one `ReportControls` mount call), `ReportControls.tsx`,
`Filters.tsx`; create `hooks/useSelectableRollupStatuses/`

- `timeline-report.js`: change `createRoot(...).render(createElement(ReportControls))` to pass
  `rolledupAndRolledBackIssuesAndReleasesObs: value.from(this, 'rolledupAndRolledBackIssuesAndReleases')`.
- `ReportControls.tsx`: accept and forward that prop to `Filters` (and later `SecondaryFilters`).
- New `useSelectableRollupStatuses(issuesObs)` hook: reads the observable, filters to the selected
  issue type (same rule as `useSelectableStatuses`), tallies `rollupStatuses.rollup.status` plus
  counts for `newlyStarted`/`newlyCompleted`/`newlyDated === true`, returns `{ label, value }` pairs
  ordered by `STATUS_LEGEND_ORDER` + the 3 "Newly ..." values last.
- `Filters.tsx`: build the Rollup Status field definition's `options` from this hook.

### Task 6 — Secondary report's own `Filters` control (depends on Tasks 1, 3; parallel with 4/5)

**Files:** create `src/react/ReportControls/components/SecondaryFilters/`; modify `route-data.js`,
`ReportControls.tsx`

- `route-data.js`: add `secondaryFilterRows` the same way as `filterRows` (no legacy migration
  needed — this param is new).
- `SecondaryFilters.tsx`: thin wrapper — `DropdownMenu` + `FilterRowsBuilder`, same field
  definitions as the primary Filters (reuse the same Rollup Status options hook/observable).
- `ReportControls.tsx`: mount `<SecondaryFilters />` next to `<Filters />`, gated on
  `useFeatures().secondaryReport && secondaryReportType !== 'none'` (same guard style as
  `GanttViewSettings.tsx`).

### Task 7 — `buildBoard` filtering + empty state (depends on Tasks 1, 6)

**Files:** modify `src/react/reports/WorkBreakdown/helpers/buildBoard.ts` + `.test.ts`,
`WorkBreakdown.tsx`, `timeline-report.js`'s `attachReactSecondaryReport()`

- `buildBoard(primaryIssues, allIssues, mode, planningIssues, filterRows = [])`:
  - Card inclusion: `matchesAllFilterRows(primary, filterRows) || children.some((c) =>
matchesAllFilterRows(c, filterRows))`.
  - When a card is included, `matrixRows`/`statusRows` come from children filtered to those that
    match — **unless** zero children match but the primary itself matched directly, in which case
    keep the full original children list (a card can qualify "as a whole" with nothing to trim).
- `WorkBreakdown.tsx`: add `filterRowsObs` prop, pass through to `buildBoard`. Empty state: when
  `filterRows.length > 0` and `board.cards.length === 0`, show "Nothing matches the current
  filters" instead of "Unable to find any issues."
- `timeline-report.js`: wire `filterRowsObs: value.bind(this.routeData, 'secondaryFilterRows')`
  into the `WorkBreakdown` mount.
- Tests: card kept via own match, card kept via child match (only matching children shown), card
  kept with zero matching children (shows all), empty `filterRows` → unchanged behavior.

### Task 8 — Cleanup + verification

- Remove now-unused `StatusFilter`/`useStatusFilters`/`useSelectedStatuses` files (confirm no other
  importers first).
- `npm run typecheck && npm run test`.
- Manual check on the no-login sample report (`http://localhost:5173/`): Jira Status row filters
  like today; Rollup Status row with `[Blocked, Warning, Newly started, Newly completed, Newly
dated]` narrows both the primary report and WorkBreakdown; the secondary-only Filters narrows
  WorkBreakdown independently of the primary view; old `?statusesToShow=...` URLs still filter
  correctly on first load.

## Verification

1. `npm run typecheck`
2. `npm run test` — new/updated: `filter-rows.test.ts`, `work-status.test.ts`, `buildBoard.test.ts`,
   `FilterRowsBuilder.test.tsx`
3. Manual check on `http://localhost:5173/` (no Jira login required)

## Open questions (non-blocking, revisit during/after implementation)

1. Label for the new secondary Filters trigger button — "Filters" (recommended, positionally
   scoped next to the secondary report) vs. "Secondary Filters" (more explicit, longer).

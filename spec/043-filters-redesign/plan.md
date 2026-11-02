# 043: Filters redesign (right-side panel, filters per level)

## Context

Today the Filters control is an `@atlaskit/dropdown-menu`
(`src/react/ReportControls/components/Filters/Filters.tsx`). Everything in it applies only to the
"Report on" level. The "Epic Status Filtering" heading says so, but "Filter options" and "Due date
range" are scoped the same way and don't say it. The only filter that reaches below that level is
the Cards-only "Card \_\_\_ Status Filtering" list.

The redesign:

1. Moves Filters into a **right-side panel**: a header with a close button, a scrolling **tab strip**
   with count badges, and a footer with **Clear all filters** and **Done**.
2. Has **one tab per hierarchy level** the sources pulled in, plus an **All items** tab, so a filter
   can target any level.
3. Keeps today's body sections (field filters, options, due date range) on every tab, restyled to
   the mockup.
4. Adds an **Issue Type · is / is not · [types]** field to the field filters.

Originally gated behind a `filtersPanel` Features flag; the flag and the dropdown were removed on
2026-10-27 (see Graduation below), so the panel is always on.

Exclude statuses (`statusesToExclude`) moved from Sources to the All items tab. It still removes
issues before rollup, unlike the panel's other filters, and Clear all filters resets it.
Estimation Progress reads issues before rollup, so its Filters button opens an exclude-only panel
(no tabs); there, Clear all filters clears only the exclusions.

Flow Metrics and Time in Status also read issues before rollup, but get the full panel (2026-10-29).
They read `levelFilteredDerivedIssues` (`filterBeforeRollup`): All items covers every loaded level,
each level tab filters that level's issues by their own Jira dates, and there's no Releases tab or
Rollup Status field (Rollup Status rows saved elsewhere are ignored). Filtering a level doesn't hide
the issues below it. Status categories, project options and colors still come from the unfiltered
list.

## Decisions (agreed)

| Topic                  | Decision                                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tabs                   | **All items**, then every level in `routeData.issueHierarchy` (everything the sources loaded), top to bottom. When reporting on releases, a **Releases** tab comes first. Levels above Report on are not disabled. |
| Effect below Report on | **Rows are hidden only, after rollup.** Parent dates, status and percent complete still come from all children. This is the same as today's Cards child filter.                                                    |
| Tab body               | **The full body on every tab**: field filters, options and due date range. Release-only options (release picker, semver) appear only on the Releases tab.                                                          |
| Apply                  | **Live.** The report updates as you edit. Done and X only close the panel.                                                                                                                                         |

## What a filter on each tab means

The report has three kinds of level relative to Report on (`primaryIssueType`):

- **The Report on level.** Rows that don't match are removed from `primaryIssuesOrReleases`. This is
  today's behavior.
- **A level above Report on** (e.g. Outcome while reporting on Story). A report row is kept only
  when its **ancestor at that level** matches. Ancestors come from `filteredDerivedIssues` by
  following `parentKey` upward. `groupIssues.ts` already does this for grandparent grouping (see
  `filteredDerivedIssuesObs`). These ancestors are never rolled up:
  - **Rollup Status** is not offered as a field on these tabs.
  - **Hide items without dates** and **Due date range** use the ancestor's own Jira dates
    (`derivedTiming`).
  - If an ancestor at that level is missing, the row **does not match**. (Open question 1.)
- **A level below Report on.** Child rows at that level that don't match are hidden wherever
  children render: Gantt expanded rows and Cards. Parent rows are never removed because of their
  children. Scatter plots only the Report on level, so filters on these tabs don't change it.

**All items** applies to the Report on level and every level below it. It is ANDed with each level's
own tab. Levels above Report on aren't "in the report", so All items doesn't reach them.

Inside one tab: rows are ANDed, values in a row are ORed, and an empty row matches everything. This
is unchanged from `filter-rows.ts`.

## State model

### New route param: `levelFilters`

The param holds JSON:

```ts
// src/jira/rollup/filter-rows/level-filters.ts (new)
type LevelKey = 'all' | string; // 'all', a level name from issueHierarchy ('Epic'), or 'Release'
interface LevelFilter {
  rows: FilterRow[];
  hideWithoutDates?: boolean;
  dueDateStart?: string; // ISO YYYY-MM-DD
  dueDateEnd?: string;
  // Releases tab only
  releasesToShow?: string[];
  showOnlySemverReleases?: boolean;
}
type LevelFilters = Record<LevelKey, LevelFilter>;
```

It's keyed by level **name**, the same naming `selectedIssueType` and `issueHierarchy` use. Issues
are matched to a level by `hierarchyLevel` (looked up from `issueHierarchy`), not by `issue.type`,
because a level named "Epic" can contain other types (`issueHierarchyFromNormalizedIssues`). A
filter therefore stays attached to its level when Report on changes. Today the filters follow
Report on; with tabs, staying on the level is the point.

### Legacy params, read as a fallback

This follows the existing `effectiveFilterRows` precedent. A new getter, `effectiveLevelFilters`,
lives in a pure function `resolveLevelFilters(config)` in `level-filters.ts`, and both
`route-data.js` and `ChildReportConfig.js` call it. It returns `levelFilters` merged with these
fallbacks:

- **Report on level** (only when `levelFilters[primaryIssueType]` is absent): taken from
  `effectiveFilterRows`, `hideUnknownInitiatives`, `scatterDateRangeStart`/`End`, `releasesToShow`
  and `showOnlySemverReleases`.
- **The level directly below Report on** (only when its entry is absent): rows taken from
  `cardsChildFilterRows`.

When the panel writes a tab, it writes `levelFilters[key]`, which then wins over the fallback. The
legacy params stay untouched, so old saved reports, old links and the flag-off dropdown keep
working.

The flag-off dropdown's hooks (`useFilterRows`, `useUnknownInitiatives`, `useDateRangeFilter`,
`useCardsChildFilterRows`, `useSelectedReleases`, `useShowOnlySemverReleases`) change to read
through `effectiveLevelFilters` for the Report on level. If a site toggles the flag, both UIs then
show the same state.

No URL migration is needed. Register `levelFilters` in:

- `route-data.js`, using the `saveJSONToUrlButAlsoLookAtReport_DataWrapper('levelFilters', {}, Object, JSON)` pattern
- `ChildReportConfig.js`, as `json({})`, so Report of Reports sections respect it

## Pipeline changes

**`src/jira/rollup/filter-rows/filter-rows.ts`**

- Add `'issueType'` to `FilterField`.
- Add `type?: string` to `FilterableIssueOrRelease`.
- Make `matchesFilterRow` dispatch explicitly on each field. Today it's a two-way ternary, so a new
  field would fall into the rollup branch.
- Issue Type checks `issue.type`; releases have `type: 'Release'`.

**`src/jira/rollup/filter-rows/level-filters.ts`** (new, pure, unit-tested)

- `resolveLevelFilters(config)`: applies the legacy fallbacks above.
- `matchesLevelFilter(issue, filter, { dates })`: rows, hide-without-dates, and the due-date range.
  Undated issues are kept unless hide-without-dates is on, matching Gantt's
  `filterIssuesKeepingUndated` rule.
- `countActiveFilters(filter)`: used for the tab badges and the trigger badge.

**`timeline-report-view-model.js`**

- `primaryIssuesOrReleases`: replace the `filterRows` / `hideUnknownInitiatives` / releases block
  with:
  - `matchesLevelFilter(issue, all ∧ primaryLevel)`
  - for each filtered level above Report on, the row's ancestor at that level must match
  - the planning-status exclusion and `sortByDueDate` stay as they are
  - the Scatter-specific `hasNoDueDate` rule for hide-without-dates stays
- New getter `visibleIssuesOrReleases`: `rolledupAndRolledBackIssuesAndReleases` with
  below-Report-on issues removed when they fail `all ∧ theirLevel`. The unfiltered list stays as it
  is for Estimation Analysis, Auto-Scheduler, Table and the rollup-status option counts.

**Date range.** Gantt and Scatter currently apply it in the component (`GanttGrid.tsx:104`,
`ScatterTimeline.tsx:151`), and Scatter needs the outside-range list for its key and axis clamp, so
keep it there.

- In `reportProps.ts`, bind `dateRangeStartObs`/`EndObs` to new config getters
  `effectiveDueDateStart`/`End`: the intersection of the All items range and the Report on level's
  range.
- The vm doesn't also apply the Report on level's range, so it isn't applied twice.

**`reportProps.ts`**

- Add `visibleIssuesOrReleasesObs`.
- Update the pinned key list in `reportProps.test.ts`.

**Children consumers**

- Gantt: `GanttGrid` builds `getChildren` from `visibleIssuesOrReleases`
  (`helpers/getChildren.ts`). It already drops keys it can't find. The expand chevron checks
  `getChildren(issue).length` instead of `childKeys.length`, so an issue whose children are all
  filtered out has no chevron.
- Cards: `WorkBreakdown`'s `buildBoard` looks children up in `visibleIssuesOrReleases`. Its own
  `childFilterRows` pass becomes redundant, since the fallback covers `cardsChildFilterRows`. Leave
  it in place until the flag graduates.

## Option sources per tab

These are new hooks under `Filters/hooks/`. Each is parameterized by level (`'all'` means the union),
generalizing the existing hooks that are hard-wired to `selectedIssueType`:

- `useLevelStatusOptions(level)`: Jira statuses with counts, from `derivedIssues` at that
  `hierarchyLevel`. Generalizes `useSelectableStatuses`.
- `useLevelRollupStatusOptions(level)`: from `rolledupAndRolledBackIssuesAndReleases` at that level.
  Returns nothing for levels above Report on, so the field isn't offered there.
- `useLevelIssueTypeOptions(level)`: the distinct `type` values at that level, with counts.
- `useFilterTabs()`: `issueHierarchy`, plus `Release` when `isRelease`, plus `all`. Each tab carries
  a label (pluralized name), its key, and `countActiveFilters`.

## UI

### New files under `src/react/ReportControls/components/FiltersPanel/`

**`FiltersPanel.tsx`**

- A trigger button labelled "Filters" with the total active-filter count.
- The panel is a `createPortal` to `document.body`. A portal keeps React context, so it needs no
  re-wrapping, unlike `ViewReportsWrapper`.
- Layout: `fixed` to the right edge, full height with a margin, rounded left corners, shadow,
  `z-50`, `print-hidden`, a light backdrop, about 560px wide.
- Closes on Escape, the backdrop, X or Done. Open/closed is local `useState`, not a route param.

**`FilterTabs.tsx`**

- A horizontal tab strip modelled on the `ViewReports.tsx:300-333` tablist: `role="tablist"`,
  roving `tabIndex`, count badge.
- Adds `overflow-x-auto` and a scroll-right arrow button that shows only while the strip overflows.
- Extract the shared tab and badge markup from ViewReports only if it stays small; otherwise
  duplicate it.

**`FilterTabBody.tsx`**

- An info callout: "These filters apply to every issue type in the report." on All items, otherwise
  "These filters apply to {Epics}."
- **FIELD FILTERS** with a **Clear** link (clears this tab's rows).
- **OPTIONS**: "Hide items without dates", plus the release picker and semver toggle on Releases.
- **DUE DATE RANGE**: date inputs and the quarter pills.

**Footer**

- **Clear all filters**: writes `levelFilters = {}` and clears every legacy param, so the fallbacks
  don't bring old filters back.
- **Done**: closes the panel.

### Reused and restyled

- `FilterRowsBuilder`: add `issueType` to the field definitions. Restyle it to the mockup: rounded
  bordered selects, `+ Add filter` as a link-style button, X at the row end. Remove its internal
  "Clear all filters"; the section header's **Clear** replaces it. Set
  `menuPortalTarget={document.body}` on its Selects so menus aren't clipped by the panel's scroll
  area.
- `DateRangeFilter`: larger bordered date inputs, and quarter presets as outlined pills.
- `IssueTypeFilters`: the toggle label and the release controls only.

### Styling and wiring

- Use the app's palette: `blue-400` primary, `neutral-*`. The mockup is teal, and the palette has no
  teal (`tailwind.config.js`). (Open question 2.)
- Storybook loads the compiled CSS, so run `npm run build:css` before checking stories.
- `ReportControls.tsx`: in the default branch, render `<FiltersPanel>` when
  `useFeatures().filtersPanel` is true, otherwise `<Filters>`.
- `src/configuration/features.ts` and `src/jira/features/fetcher.ts`: add a `filtersPanel` entry
  ("Filters panel", "Filter any hierarchy level from a side panel"), off by default.

## Phases

1. **Model and pipeline.** No UI change; behavior is unchanged while `levelFilters` is empty.
   - `filter-rows.ts` issueType field
   - `level-filters.ts`
   - the `levelFilters` param in `route-data.js` and `ChildReportConfig.js`
   - vm `primaryIssuesOrReleases` and `visibleIssuesOrReleases`
   - `reportProps` changes
   - Gantt and Cards children
   - legacy hooks reading through the resolver
2. **Panel UI** behind `filtersPanel`: the panel, tabs, body restyle, the issueType field in the
   builder, and stories.
3. **Graduation** (done 2026-10-27): removed the flag, deleted the dropdown, `FilterGrid`, the
   `filters-nested-modal-visibility-override` CSS (`status-reports.css:356-359`; keep the
   ViewSettings selector) and the Cards child section.

## Tests

**Unit**

- `filter-rows.test.ts`: the issueType field; dispatch for unknown fields.
- `level-filters.test.ts` (new):
  - legacy fallback for the Report on level and the child level
  - `levelFilters` wins over the fallback
  - `countActiveFilters`
  - hide-without-dates and the date range, with the undated rule
- `timeline-report-view-model.test.js`:
  - All items ∧ the Report on tab
  - an ancestor-level filter, including a missing ancestor
  - `visibleIssuesOrReleases` hides children only, and parent rollup is unchanged
- `ChildReportConfig.test.js`: `levelFilters` round-trips.
- `reportProps.test.ts`: the new key.
- `GanttGrid.test.tsx`: an expanded row hides filtered children; no chevron when all children are
  filtered out.
- `WorkBreakdown/helpers/buildBoard.test.ts`: children come from the visible list.

**Component**

- `FiltersPanel.test.tsx`:
  - opens from the trigger; closes on Done, X and Escape
  - tab badges count active filters
  - Clear clears one tab; Clear all filters clears everything, including legacy params
  - Issue Type rows apply live
- `FilterTabs.test.tsx`: arrow-key navigation; the scroll arrow appears only when the strip
  overflows.

**Storybook**

- `FiltersPanel.stories.tsx`: All items; a mid-level tab; the Releases tab; many tabs (overflow).

## Verification

1. `npm run typecheck && npm run test`.
2. Run `npm run dev` with the sample data:
   - Report on Epic, filter Stories by Jira Status on the Stories tab. Gantt expanded rows hide the
     non-matching stories, and the epic bars and dates are unchanged.
   - Filter on the Initiatives tab while reporting on Epic: only epics under matching initiatives
     remain.
   - Issue Type filter on All items.
   - Reload the URL: the state persists. Save the report and reopen it.
   - Embed it in a Report of Reports: the section respects it.
   - Open an old saved report with `filterRows` / `hideUnknownInitiatives` / a date range: the
     Report on tab shows those values.
3. Turn the flag off: the old dropdown shows the same Report on level state.
4. Check in Forge (the user runs the Forge commands) that the fixed panel and portaled Select menus
   render correctly inside the iframe.

## Open questions

1. When a row has no ancestor at a filtered upper level, should it be hidden (this plan's default)
   or kept?
2. Should we adopt the mockup's teal primary, or keep the app's blue?
3. Should "Hide items without dates" on levels below Report on also hide children with no start
   date, or only those with no due date?

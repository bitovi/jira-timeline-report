# 044: Planning health metric MVP (Table report)

## Context

We want a "planning health" view of initiatives: when is each one due, and how well estimated is the
work under it. Rather than build a new report type, the MVP composes it from the **Table report**:

- Report type **Table**, hierarchy **Initiative → Initiative** (Outcome above, Epic below).
- Columns: **Parent Summary** (the Outcome), **Icon & Summary**, **Rolled-up Due Date**,
  **Estimate Progress**.
- Ungrouped, it lists one row per initiative. **Group by Parent Summary** collapses it to one row per
  Outcome:

| Parent Summary | Icon & Summary   | Due date                | Estimate Progress                                    |
| -------------- | ---------------- | ----------------------- | ---------------------------------------------------- |
| outcomeA       | inc1, inc2, inc3 | 2026-12-01 – 2027-06-01 | Partially estimated (1), Estimated (1), No epics (1) |

With **Aggregation → Max** on the due date column the cell becomes `2027-06-01`, and with
**Format → How far out** it becomes `8 months out`.

Four pieces of work deliver this:

1. Date columns get **Min** and **Max** aggregations.
2. Date columns get a **Format** option: Date (today) or **How far out**.
3. A new **Rolled-up Due Date** column.
4. A new **Estimate Progress** column, reusing the Estimation Progress report's rules.

### What exists today (answers to the questions raised)

- **Report Fields → Due Date** (`report:dueDate`, `model/builtinFieldRegistry.ts:250`) reads
  `issue.dueDate`. That is the normalized due date: whichever field Team Configuration maps as the
  due-date field for that issue's team and level (`src/jira/normalized/normalize.ts:82`).
- **Fields → Due date** (`field:duedate`, `model/buildColumnCatalog.ts:58-86`) is the raw Jira field.
  However, `normalizedFieldSources.ts:68-71` aliases `duedate` to `issue.dueDate`, so in practice it
  shows the same value and only falls back to the raw field when the normalized one is empty.
- **Neither rolls up.** No Table column reads `rollupDates`/`rollupStatuses`. The rollup logic exists
  (`src/jira/rollup/dates/dates.ts`: `childrenFirstThenParent`, `mergeStartAndDueData`), but it only
  runs for levels **inside** the selected hierarchy range (`getIssueHierarchyUnderType` in
  `src/react/TimelineReport/timeline-report-view-model.js`). With the range set to
  Initiative → Initiative, epics aren't in the rollup, so an initiative's `rollupDates.due` is just its
  own date. **That's why the new columns compute from `filteredDerivedIssues` (every loaded issue,
  linked by `parentKey`), not from the rollup pipeline.** The Estimation Progress report reads the
  same input.
- The ⋯ column menu (`components/ColumnHeaderMenu.tsx`) already has an **Aggregation** section. Its
  options come from `applicableAggregations(column)` (`model/grouping.ts:168`) and are filtered by
  `aggregations[id].applicableTo` (`model/aggregations.ts:109-117`). Today `min`/`max` apply only to
  `number`, and dates only get `count` and `range`.
- Per-column settings persist in `TableColumnEntry { sourceId, aggregation?, width? }`
  (`model/persistence.ts:19-23`), stored in the `tableColumns` route param (URL plus saved report).

## Decisions (agreed)

| Topic                    | Decision                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rolled-up due            | Latest due date among children (each child's own rolled-up value, recursively), **falling back to the issue's own due date** when no child has one. Same semantics as `childrenFirstThenParent`. |
| Children source          | `filteredDerivedIssues` linked by `parentKey`, independent of the hierarchy range. The sources' JQL must still load the epics.                                                                   |
| "Estimated" epic         | Same as Estimation Progress: an estimate (`storyPoints ?? storyPointsMedian`) **and** a `confidence`.                                                                                            |
| Estimate Progress labels | Epic rows: **Estimated / Unestimated**. Initiative rows: **Estimated / Partially estimated / Unestimated epics / No epics**. Grouped: `Estimated (1), Partially estimated (1), No epics (1)`.    |
| How far out              | `Today`, `N days out` (under 14 days), `N weeks out` (under 8 weeks), `N months out` (under 24 months), then `N years out`. Past dates read `… ago`. Singular for 1 (`1 week out`).              |
| Feature flag             | New `planningHealth` flag in the Features tab gates **the two new columns**. Date Min/Max and the How far out format ship ungated.                                                               |

## Design

### 1. Date Min / Max aggregation

`model/aggregations.ts`

- `min` and `max`: change `applicableTo` to `['number', 'date']`.
- Make `minReducer`/`maxReducer` accept date-ish items via the existing `toTime()` helper. Numbers pass
  through unchanged. Dates reduce to epoch ms.
- The reducer output for a date column is an epoch number, so the **rendering** must know it's a date.
  In `model/grouping.ts` (`computeMeasureValue` / `formatMeasureValue` / `getMeasureRenderer`), when
  the column's `filter.kind === 'date'` and the aggregation is `min` or `max`, format the result
  through the column's date formatter (§2) instead of as a number.
- `NUMERIC_AGGREGATION_IDS` right-aligns `min`/`max`. Exclude date columns from that alignment so a
  date stays left-aligned like its ungrouped cell.

The ⋯ menu needs no structural change. It lists `applicableAggregations(column)`, so date columns
will show Count, Range, Min and Max.

### 2. Date Format option: "How far out"

- **Persistence:** add `format?: 'date' | 'relative'` to `TableColumnEntry` (`model/persistence.ts`),
  defaulting to `'date'`. Absent means `'date'`, so old URLs and saved reports keep working. Add a
  `setColumnFormat` alongside `setColumnAggregation` in `TableReport.tsx` (~L1027).
- **Formatter:** a new pure module `model/relativeDate.ts` with
  `formatHowFarOut(value: unknown, today: Date): string`. It measures whole **local calendar days**
  between today and the date, then applies the thresholds in the Decisions table. Weeks and months
  round to the nearest whole unit. Months use calendar-month difference.
- **Where it applies:** the ungrouped cell (`dateEntry.render` in `model/fieldTypeRegistry.ts:72-80`,
  and the Rolled-up Due Date column), Min/Max aggregates, and both ends of a Range
  (`4 days out – 8 months out`). Date **group labels** (`dateBucketing.ts`) are unchanged.
- **Menu:** add a **Format** section to `ColumnHeaderMenu.tsx` with two options, **Date** and
  **How far out**. Show it only for columns whose `filter.kind === 'date'`. Mirror the Aggregation
  section's props (`format`, `onFormatChange`).
- The render path needs the format. Pass it through `RenderContext` (`model/columns.ts:61`) as
  `dateFormat?: 'date' | 'relative'`, and have date renderers read it. That's the smallest change
  that reaches both the cell and the measure renderer.

### 3. Shared estimation-progress rules

The rules live as private functions in `src/react/reports/EstimationProgress/EstimationProgress.tsx`
(`getReportingData`, L145-193). Extract the classification into
`src/react/reports/shared/estimationProgress.ts`:

```ts
export type EpicEstimate = 'Estimated' | 'Unestimated';
export type InitiativeEstimate = 'Estimated' | 'Partially estimated' | 'Unestimated epics' | 'No epics';

export function isEpicEstimated(issue: DerivedIssue): boolean; // storyPoints ?? storyPointsMedian, and confidence
export function classifyAboveEpic(epicTotal: number, epicEstimated: number): InitiativeEstimate;
```

`EstimationProgress.tsx` imports these and keeps its own counting and team rollups. Its behavior must
stay the same. While extracting, fix the modal-title key mismatch (`noEpic` vs `noEpics`, L251/L407),
which makes the "no epics" modal show the title "Issues".

Like the existing report, this hard-codes level 1 = Epic and level 2 = the level above epics.

### 4. Per-issue planning-health data

A new pure module, `src/react/reports/TableReport/model/planningHealth.ts`:

```ts
export interface PlanningHealth {
  rolledUpDue: Date | null;
  /** Level 1: one EpicEstimate. Level 2: one InitiativeEstimate. Level ≥3: the InitiativeEstimate of
   *  every level-2 descendant (a tally). Level 0: null. */
  estimateProgress: string | string[] | null;
}
export function computePlanningHealth(issues: DerivedIssue[]): Map<string, PlanningHealth>;
```

- Build `childrenByParentKey` from `parentKey`, then memoize a bottom-up walk.
- `rolledUpDue(issue)` is the max of `rolledUpDue(child)` over children, or `issue.dueDate` when there
  is no such child value. Guard against `parentKey` cycles.
- `estimateProgress` uses §3. At level 2, `epicTotal` and `epicEstimated` count direct level-1
  children.

In `TableReport.tsx`, compute the map once with
`useMemo(() => computePlanningHealth(filteredDerivedIssues), …)`, but only when the flag is on. Attach
it to every table row as `planningHealth` where `flatIssues`, `hierarchyRoots`, `hierarchyAll` and
`hierarchyVisible` are built (~L757-781). `toHierarchyIssue` / `toTableIssue` grow an optional
lookup argument.

### 5. The two new columns

Add them to `buildColumnCatalog` (`model/buildColumnCatalog.ts:230`) in the **Report Fields** group,
next to the `estimation:*` columns, only when the flag is on. Use a new
`buildColumnCatalog(fields, { planningHealth })` options argument.

- **Rolled-up Due Date** (`planning:rolledUpDue`)
  - `getValue: (i) => i.planningHealth?.rolledUpDue`, with the date renderer, date filter, date
    compare, and default aggregation `max`.
  - It gets Min/Max/Range and the How far out format like any other date column.
- **Estimate Progress** (`planning:estimateProgress`)
  - `getValue` returns the string or string array. The cell renders a single label as-is and an array
    as a tally.
  - Filter `select` over the six labels. Sort follows label order (No epics → Estimated), not the
    alphabet.
  - Default aggregation is a new **`tally`**: `AggregationId 'tally'`, label "Count by value",
    `applicableTo: ['text', 'select']`. It flattens arrays (so grouping Outcome rows merges their
    tallies), counts each value, and finalizes to `"Estimated (1), Partially estimated (1), …"` in
    first-seen order. It's generic, so any text/select column can use it.
  - Optional nice-to-have: colour each label with the Estimation Progress report's classes
    (`color-text-and-bg-complete` / `-ontrack` / `-behind` / `-notstarted`).

Neither column needs extra Jira fields (`requiredFieldsFor` returns nothing). They only use fields
that derived issues already have.

### 6. Feature flag

Add `planningHealth` to `nonReportsFeatures` in `src/configuration/features.ts`, with the name
"Planning health columns" and a subtitle saying it adds Rolled-up Due Date and Estimate Progress to
the Table report. Read it in `TableReport.tsx` with `useFeatures()`
(`src/react/services/features/useFeatures.ts`). If the flag is off, a saved report that references
`planning:*` columns must drop them silently. Check that `applyView`/catalog lookup already ignores
unknown `sourceId`s, and add a test either way.

## Critical files

| File                                                            | Change                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------ |
| `src/react/reports/TableReport/model/aggregations.ts`           | date-aware min/max, new `tally`                        |
| `src/react/reports/TableReport/model/grouping.ts`               | date formatting for min/max measures, alignment        |
| `src/react/reports/TableReport/model/relativeDate.ts` (new)     | `formatHowFarOut`                                      |
| `src/react/reports/TableReport/model/fieldTypeRegistry.ts`      | `dateEntry` honours `dateFormat`                       |
| `src/react/reports/TableReport/model/columns.ts`                | `RenderContext.dateFormat`                             |
| `src/react/reports/TableReport/model/persistence.ts`            | `TableColumnEntry.format`                              |
| `src/react/reports/TableReport/components/ColumnHeaderMenu.tsx` | Format section                                         |
| `src/react/reports/shared/estimationProgress.ts` (new)          | extracted rules                                        |
| `src/react/reports/EstimationProgress/EstimationProgress.tsx`   | use shared rules, fix modal title                      |
| `src/react/reports/TableReport/model/planningHealth.ts` (new)   | rolled-up due + estimate progress per issue            |
| `src/react/reports/TableReport/model/buildColumnCatalog.ts`     | two new columns behind option                          |
| `src/react/reports/TableReport/TableReport.tsx`                 | compute + attach `planningHealth`, format setter, flag |
| `src/configuration/features.ts`                                 | `planningHealth` flag                                  |

## Out of scope / follow-ups

- **Possible date off-by-one:** `dateEntry` and `toDateLabel` format local-midnight dates with
  `toISOString()` (UTC), so users east of UTC may see the previous day. It hasn't been confirmed by
  running the app. `formatHowFarOut` must use local days regardless. Confirm the bug and fix it
  separately unless it's a one-liner.
- The planning "rungs" model from `spec/038-planning-progress` (Refined / Sized / Scheduled). The MVP
  uses only the Estimation Progress categories.
- Exporting the new values to CSV, and colour bars like the Estimation Progress report.

## Verification

- **Unit tests (vitest), next to each model file:**
  - `relativeDate.test.ts`: today, ±1 day singular, 13 vs 14 days, 7 vs 8 weeks, 23 vs 24 months,
    past dates "ago", and DST boundaries.
  - `aggregations.test.ts`: date min/max over Date, string and epoch values, nulls ignored; `tally`
    with flattened arrays and order.
  - `grouping.test.ts`: date min/max measures render as dates and in relative format;
    `applicableAggregations` for a date column includes min/max.
  - `planningHealth.test.ts`: due falls back to own when there are no dated children; recursion
    (outcome → initiative → epic); cycle guard; all four initiative categories; level ≥3 tally;
    level 0 null.
  - Shared estimation rules: Estimation Progress counts are unchanged (existing tests, or add a
    snapshot of `getReportingData` output before extracting).
  - `buildColumnCatalog.test.ts`: columns present only with the flag; `persistence.test.ts`: `format`
    round-trips, and absent means `'date'`.
- **`TableReport.test.tsx`:** the user's scenario end to end. Three initiatives under one outcome,
  with epics in the derived set. Assert the ungrouped rows, then group by Parent Summary and assert
  `Partially estimated (1), Estimated (1), No epics (1)`, Max = latest date, and How far out text
  (fake timers for "today").
- **Manually**, via the `launch-dev` agent: turn on `tableReport` and `planningHealth` in Features.
  Build the Initiative → Initiative table with the four columns, group by Parent Summary, set
  Max + How far out, reload, and check everything persists in the URL and saved report.
- Run `npm run typecheck`, `npm test`, and lint.

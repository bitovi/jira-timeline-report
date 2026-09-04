# 028 — Fix the Gantt Chart's date-range filter

## Context

The Filters menu offers a "Due date range" section — two date inputs plus _This quarter_ /
_This and next quarter_ preset chips — for exactly two report types: Scatter Plot (`due`) and
Gantt Chart (`start-due`) ([Filters.tsx:75][filters]).

On the Scatter Plot the presets work as expected: the axis zooms to the chosen window. On the
Gantt they appear to do nothing. Setting a window several years in the past _does_ change the
Gantt — it empties it, with no explanation.

Both symptoms have the same cause, and it is not that the Gantt is unwired. The Gantt reads the
same route params and **does** filter its rows correctly. What it never does is let the range
touch its **axis**.

### Root cause

Both reports receive `dateRangeStartObs` / `dateRangeEndObs` from the identical prop bag
([reportProps.ts:39-40][props]), sourced from the `scatterDateRangeStart` /
`scatterDateRangeEnd` route params (the `scatter*` names are kept for URL back-compat).

|                    | Scatter Plot (`due`)                                                                  | Gantt Chart (`start-due`)                                       |
| ------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Row filter         | `filterIssuesByDateRange` → `insideRange` + `outsideRange`                            | `filterIssuesKeepingUndated` — undated always kept ✅ **works** |
| **Axis domain**    | `rangeStart = dateRangeFilter.from ?? contentRange.rangeStart` ([:163-164][scatter1]) | `computeAxisRange(primaryIssues)` — **range never passed in**   |
| **Axis start**     | the chosen window's `from`                                                            | **hard-pinned to `today`** ([computeAxisRange.ts:31][axis])     |
| Empty-window state | "No issues are due in the selected date range." ([:261-264][scatter2])                | bare grid: quarter headers, zero rows, no message               |

`getQuartersAndMonths` snaps outward to whole quarters, so with `axisStart = today` the Gantt's
left edge is **always the current quarter**, whatever the filter says. Only the right edge can
move, and only _inward_ — when the filter removes later-due issues. Hence:

- **Presets look like no-ops.** _This quarter_ and _This and next quarter_ both start at today,
  which is already the left edge. If the data ends within the preset window, the right edge
  doesn't move either, and nothing at all changes on screen.
- **A far-past window empties the chart.** The row filter correctly excludes every dated issue;
  only undated ones survive. `computeAxisRange` falls back to `today → today+90d` and renders an
  empty grid. Right behavior, zero feedback.

### Why `axisStart = today` is safe to change

`spec/005-gantt-rewrite/plan.md` §Known issues #1 records the today-pin as deliberate ("the Gantt
is a **future-timeline** report and intentionally starts at today"). That decision stands — but it
predates the feature that conflicts with it, and never contemplated it:

```
2026-07-05  94e6bea7  scatter date range filter        <- Gantt explicitly out of scope
2026-07-06  60608ef1  React Gantt rewrite              <- axisStart = today preserved
2026-07-16  93523dcc  date filter added to the Gantt   <- only the row-filter half wired
```

`spec/004-scatter-improvements/date-range.md` Questions #5 answered _"Scatter-only for now; the
Gantt is planned for later reuse of the same pattern."_ When that reuse landed ten days later it
wired the row filter and stopped. **No one ever decided how the today-pin should interact with an
explicitly-chosen window.**

The same §Known issues #1 entry also pre-built the seam: _"Isolate it in a single
`computeAxisRange` helper so it is explicit and easy to revisit, but do not change the
behavior."_ — "do not change the behavior" scoped the **port**, not the future.

So this change is a **narrowing, not a reversal**: the today-pin yields only when the user has
explicitly named a start date. With no range set, behavior is byte-identical, and all four
existing `computeAxisRange.test.ts` cases (which pass no range at all) stay green untouched.

### Decisions

1. **Axis** — honor an explicit window on both ends; keep the future-looking default when unset.
2. **Match rule** — unchanged: rolled-up **due date only**, per
   `spec/004-scatter-improvements/date-range.md` Questions #2. A Gantt bar that started in 2025 and
   is due in-window still survives; "interval overlap" matching is explicitly **out of scope**.
3. **Feedback UI** — add the empty-window message only. The Scatter's
   "N outside date range" footer key and its modal are **out of scope** (the Gantt has no footer
   and computes no `outsideRange` bucket).

---

## Changes

### 1. `computeAxisRange` — accept the range

`src/react/reports/GanttReport/GanttGrid/helpers/computeAxisRange.ts`

Add an optional third parameter and anchor the existing default/clamp math on `axisStart` instead
of `today`. Reuse the existing `DateRangeFilter` type from
`src/react/reports/shared/timeline/helpers/dateRangeFilter.ts` — do not define a new shape.

```ts
export const computeAxisRange = (
  issues: IssueOrRelease[],
  today = new Date(),
  range: DateRangeFilter = {},
): { axisStart: Date; axisEnd: Date } => {
  const axisStart = range.from ?? today;

  // An explicit upper bound wins outright. The `>= axisStart` guard rejects an inverted
  // window (the two date inputs are independent, so `from > to` is easy to type) rather
  // than handing `getQuartersAndMonths` a negative span, which yields zero month columns.
  if (range.to && range.to >= axisStart) {
    return { axisStart, axisEnd: range.to };
  }

  const rollups = issues.map((i) => i.rollupStatuses.rollup);
  let { start, due } = mergeStartAndDue(rollups);
  if (!start) start = axisStart;
  if (!due) due = new Date(start.getTime() + 90 * DAY_MS);
  if (due < axisStart) due = new Date(axisStart.getTime() + 90 * DAY_MS);

  return { axisStart, axisEnd: due };
};
```

Why this shape:

- **Third parameter, not second.** The four existing tests call `computeAxisRange(issues, today)`;
  keeping `today` in position 2 leaves them untouched, which is the evidence that the unfiltered
  default is preserved.
- **`axisStart` replaces `today` in all three fallback lines.** When `range` is empty
  `axisStart === today`, so the branch reduces exactly to today's code. When `from` is in the past,
  the `+90d` default and the past-due clamp anchor to the window rather than snapping forward to
  today — which would otherwise produce a wildly oversized axis.

Update the `DECISION (plan §Known issues #1)` docblock: the axis still starts at today **by
default**, and now yields to an explicit `range.from`. Point at this spec.

### 2. `GanttGrid` — pass the range in, and handle the empty window

`src/react/reports/GanttReport/GanttGrid/GanttGrid.tsx`

The component already parses the range into a memoized `dateRangeFilter` (`{ from, to }` as
`Date`s) at lines 91-97. Three edits:

- **Feed the axis** (line 123):

  ```ts
  const { axisStart, axisEnd } = useMemo(
    () => computeAxisRange(primaryIssues, new Date(), dateRangeFilter),
    [primaryIssues, dateRangeFilter],
  );
  ```

  `new Date()` becomes explicit because the third argument is needed; freshness is unchanged —
  the current call already re-evaluates the `today` default on every recompute.

- **Add `hasDateRange`**, mirroring `ScatterTimeline.tsx:147`:

  ```ts
  const hasDateRange = dateRangeStart !== '' || dateRangeEnd !== '';
  ```

  Note this is derived from the **raw strings**, not `dateRangeFilter` — an invalid/unparseable
  string should still count as "the user set something", exactly as the Scatter treats it.

- **Render the empty state** in place of the grid:

  ```ts
  const showEmptyRangeState = hasDateRange && rawPrimaryIssues.length > 0 && primaryIssues.length === 0;
  ```

  Gated on `rawPrimaryIssues`, **not** the Scatter's `datedIssues`: the Gantt keeps undated issues
  inline rather than partitioning them out, so `primaryIssues.length === 0` already implies no
  undated survivors. Wrap the existing `<div style={{ display: 'grid' }}>` in a ternary the way
  `ScatterTimeline.tsx:261-265` does. The `PercentCompleteModal` stays outside it.

### 3. Lift the empty-state message into `shared/timeline`

New `src/react/reports/shared/timeline/components/DateRangeEmptyState/` (`.tsx` + `index.ts`,
matching the sibling layout of `StatusLegend`, `TodayLine`, `GridLines`,
`QuarterAndMonthHeaders`), exported from `shared/timeline/components/index.ts`.

Move the markup currently inlined at `ScatterTimeline.tsx:261-264` verbatim — including the copy
_"No issues are due in the selected date range."_, which reads correctly for both reports now that
due-only matching is retained — and have **both** reports render it. This keeps the wording in one
place; `StatusLegend` is the precedent for a component shared by exactly these two reports.

### 4. Stale comment

`src/canjs/routing/route-data/route-data.js:1072-1074` still says the range is _"scatter-only for
now"_. It has been shared since `93523dcc`. Correct it to match the accurate docblock already in
`useDateRangeFilter.ts:5-8`.

---

## Out of scope

Recorded so the next reader doesn't mistake these for oversights:

- **Interval-overlap matching.** Due-date-only is retained (decision #2). A bar spanning
  start→due is still judged by its due date alone, so a long bar that started before the window
  survives and renders with its `startExtends` left-clip.
- **`allIssues` is not date-filtered.** `makeGetChildren` reads the unfiltered set, so expanding a
  parent can reveal children outside the window. Pre-existing; arguably correct (you asked for
  that parent's children).
- **"N outside date range" key + modal** and the Scatter's "Showing X of Y" hint (decision #3).
- **`to` set alone and in the past** (e.g. `to = 2020` with no `from`) stays degenerate: the
  inverted-window guard falls through to `today → today+90d`, and any surviving past-due issues
  render entirely left of `firstDay`. Unusual input; honoring it would invert the axis.

---

## Verification

### Tests

```bash
npx vitest run src/react/reports/GanttReport src/react/reports/shared/timeline src/react/reports/ScatterTimeline
```

- **`computeAxisRange.test.ts`** — the four existing cases must pass **unmodified**; that is the
  regression proof for the unfiltered default. Add: `range.from` honored (axis starts before
  today); `range.to` honored; both honored; inverted `from > to` falls back instead of producing a
  zero-column axis; `range.from` with no surviving dated issues gives `from → from+90d`.
- **`GanttGrid.test.tsx`** — the existing `describe('due date range filter')` block (lines 74-110)
  asserts row visibility only. Add **axis** assertions, which is what was missing: with
  `dateRangeStartObs: obs('2025-01-01')` / `dateRangeEndObs: obs('2025-03-31')`, expect `Jan`/
  `Feb`/`Mar` month headers present and `Apr` absent. Add an empty-window case asserting the
  message renders and `data-testid="gantt-grid"`'s grid does not.
- **`ScatterTimeline.test.tsx`** — its empty-state assertion must still pass after the component
  is extracted (same copy, same place).

### Manually, in the app

`npm run dev`, load a report with a Gantt Chart and a decent spread of due dates.

1. **Presets move the axis.** Filters → _This quarter_ → the axis is exactly the current quarter
   (three month columns), starting at the quarter's first month, not at today. _This and next
   quarter_ → six columns. This is the reported bug; it fails on `main`.
2. **A past window is reachable.** Set From/To to a quarter that ended a year ago and contains
   real due dates → the axis moves back to that quarter and shows those bars. On `main` the axis
   refuses to leave the current quarter.
3. **The empty window explains itself.** Set the range to a window with no data → "No issues are
   due in the selected date range." instead of an empty grid. This is the confusing symptom that
   started this work.
4. **Nothing changed when unfiltered.** Clear the range → the axis returns to today → latest due
   date, whole-quarter snapped, identical to `main`. Worth an A/B against `main` side by side,
   since preserving this is the whole argument for the change being safe.
5. **Scatter is unregressed.** Switch to Scatter Plot and repeat 1-3; the shared route params and
   the extracted empty-state component both touch it.
6. **Embedded children.** Put a Gantt inside a report-of-reports and confirm the child's own
   `scatterDateRangeStart`/`End` (via `ChildReportConfig`) drive its axis independently — the same
   `propsFor` bag feeds both paths, so this should follow, but it is the path least covered by
   tests.

[filters]: ../../src/react/ReportControls/components/Filters/Filters.tsx
[props]: ../../src/react/reports/reportProps.ts
[scatter1]: ../../src/react/reports/ScatterTimeline/ScatterTimeline.tsx
[scatter2]: ../../src/react/reports/ScatterTimeline/ScatterTimeline.tsx
[axis]: ../../src/react/reports/GanttReport/GanttGrid/helpers/computeAxisRange.ts

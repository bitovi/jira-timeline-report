# Gantt Chart Report — React Rewrite Logic & Architecture

**Status**: Architecture Design
**Report Key**: `'start-due'` (Gantt Chart)
**Feature Flag**: `ganttChart`
**Target**: Pure functions + React components following repo conventions
**Companion docs**: [behavior.md](behavior.md) (existing behavior), [plan.md](plan.md) (migration plan & decisions)

---

## 1. Design Philosophy

The Gantt rewrite follows the exact pattern proven by the ScatterTimeline rewrite
([spec/003-scatter-timeline-rewrite/logic.md](../003-scatter-timeline-rewrite/logic.md)):
**separate all layout/hierarchy math into pure, exhaustively-tested functions, and keep the
React components as thin renderers.** The Gantt is more complex than the scatter plot (bars with
duration, hierarchy expand/collapse, grouping, breakdown work-type bars, last-period shadows), so
the payoff for isolating pure logic is even larger.

### Layers

| Layer                                            | Responsibility                                                                                                               | Testability                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Pure helpers** (`helpers/*.ts`)                | Axis range, row flattening, grouping, bar positioning, corner/border classes, percent-complete, tooltip data                 | Unit tests, no DOM/globals        |
| **Shared timeline module** (`shared/timeline/*`) | Quarter/month headers, today line, grid lines, status colors, density, grouping — shared with ScatterTimeline (plan Phase 0) | Already unit-tested               |
| **React components** (`components/*`)            | Presentation, CSS-grid placement, hover/expand state, tooltips (Atlaskit Popup), modal                                       | Component tests w/ mocked helpers |
| **Container** (`GanttGrid.tsx`)                  | Read observables, orchestrate helpers, own expand state                                                                      | Component/integration tests       |

### Principles

- **No raw-DOM building.** The legacy `getReleaseTimeline` imperatively builds a
  `DocumentFragment` per row ([gantt-grid.js#L434-L590](src/canjs/reports/gantt-grid.js#L434-L590)).
  The rewrite renders **declarative JSX** with absolute-positioned divs; React reconciliation
  replaces the manual per-row rebuild (plan §Bars, §Performance).
- **Measurement-free.** Unlike the scatter plot, the Gantt does **not** measure text widths — bars
  are positioned purely from dates. This removes the scatter's only impurity, so the entire
  positioning pipeline is pure with **no DOM dependency**.
- **Expand state is component-local React `useState`** (`showChildrenByKey`), matching today's
  non-URL-persisted behavior (plan §State). All row-building helpers receive an
  `isExpanded(key) => boolean` predicate so they stay pure.
- **routeData stays the source of truth** for `groupBy`, `roundTo`, `primaryIssueType`,
  `primaryReportBreakdown`, `showPercentComplete` — read via `useCanObservable`, written via
  `.value` (plan §State, §Known issues #4).

---

## 2. Reuse Map

Before writing new code, these already exist and are reused directly.

### 2.1 Shared timeline module (plan Phase 0 — extracted from ScatterTimeline)

Location: `src/react/reports/shared/timeline/`

| Export                                                                | Source today                             | Gantt use                                                                                                                                                                                         |
| --------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `groupIssues(items, allIssues, groupBy, getIssue)`                    | `ScatterTimeline/helpers/groupIssues.ts` | Replaces the parent/team/project branches of `gridRowData` **and** `getSortedParents`. Already handles the "No Team"/"No Parent"/"No Project" fallbacks and rank sorting (plan §Known issues #2). |
| `getStatusColorClass(status)`, `getStatusLabel(status)`               | `helpers/status.ts`                      | Bar/circle colors (`color-text-and-bg-{status}`).                                                                                                                                                 |
| `shouldUseDensityOptimizations(count)`                                | `helpers/density.ts`                     | `lotsOfIssues` = `count > 20`. Gantt additionally forces it **false in breakdown mode** (see `computeDensity`).                                                                                   |
| `QuarterAndMonthHeaders`, `TodayLine`, `GridLines`, `StatusLegend`    | `components/*`                           | Rendered as bare grid children; each already accepts a `columnOffset` prop for the Gantt's label + %-complete gutter columns.                                                                     |
| `IssueOrRelease` slice, `Quarter`, `Month`, `QuartersAndMonths` types | `types.ts`                               | Extended locally with Gantt-only fields (see §5).                                                                                                                                                 |

### 2.2 Existing date / rollup utilities

| Export                                          | Location                                                                                                                      | Gantt use                                                                                                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `computeQuartersAndMonths(start, end)`          | [src/utils/date/compute-quarters-and-months.ts](src/utils/date/compute-quarters-and-months.ts)                                | Axis quarters/months (century-year-safe; the scatter rewrite already switched to this over the legacy `getYear()` version).                                |
| `getDaysInMonth(year, month)`                   | [src/utils/date/days-in-month.js](src/utils/date/days-in-month.js)                                                            | Only if not reading `month.daysInMonth` directly.                                                                                                          |
| `roundAndShiftDueDate` / `roundDate` table      | [src/utils/date/round.js](src/utils/date/round.js), [round-and-shift-due-date.ts](src/utils/date/round-and-shift-due-date.ts) | Endpoint rounding keyed by a `roundTo` **string param** (pure) — replaces `roundDateByRoundToParam` which reads the global `routeData.roundTo` (see §3.4). |
| `mergeStartAndDueData(rollups)`                 | [src/jira/rollup/dates/dates.ts](src/jira/rollup/dates/dates.ts)                                                              | Merge start/due across issues for the axis range.                                                                                                          |
| `makeGetChildrenFromReportingIssues(allIssues)` | [src/jira/rollup/rollup.ts](src/jira/rollup/rollup.ts)                                                                        | Resolve a parent's children for hierarchy flattening and the percent-complete modal.                                                                       |
| `daysBetween(a, b)`                             | [src/utils/date/days-between.js](src/utils/date/days-between.js)                                                              | Dates-tooltip duration.                                                                                                                                    |
| `timeRangeShorthand(days)`                      | [src/utils/date/time-range-shorthand.js](src/utils/date/time-range-shorthand.js)                                              | Dates-tooltip "3w"/"2d" shorthand and signed diffs.                                                                                                        |
| `workTypes`                                     | [src/jira/derived/work-status/work-status.ts](src/jira/derived/work-status/work-status.ts)                                    | Breakdown-mode dev/qa/uat bars.                                                                                                                            |

**Deliberately NOT reused**: `getBusinessDatesCount` (imported-but-unused in legacy),
`roundDateByRoundToParam` (reads global state), the CanJS `SimpleTooltip`/`issue-tooltip`
(rebuilt with Atlaskit Popup — plan §Tooltips).

---

## 3. New Pure Functions (Gantt-specific `helpers/`)

Each function below is pure (inputs → output, no DOM/globals), colocated with a `*.test.ts`.

### 3.1 Axis range

#### `computeAxisRange(issues: IssueOrRelease[], today?: Date): { axisStart: Date; axisEnd: Date }`

**Purpose**: Reproduce the legacy `quartersAndMonths` range computation, including its defaults.

**Logic** (ports [gantt-grid.js#L330-L344](src/canjs/reports/gantt-grid.js#L330-L344)):

```typescript
const DAY_MS = 24 * 60 * 60 * 1000;

export const computeAxisRange = (issues: IssueOrRelease[], today = new Date()) => {
  const rollups = issues.map((i) => i.rollupStatuses.rollup);
  let { start, due } = mergeStartAndDueData(rollups);
  if (!start) start = today;
  if (!due) due = new Date(start.getTime() + 90 * DAY_MS); // default +90d
  if (due < today) due = new Date(today.getTime() + 90 * DAY_MS); // clamp past-due
  // DECISION (plan §Known issues #1): the axis intentionally starts at TODAY — the Gantt is a
  // future-looking timeline. `start` is computed for the default/clamp math only; it is NOT the
  // axis start. Isolating this here makes the choice explicit and easy to revisit.
  return { axisStart: today, axisEnd: due };
};
```

**Why pure**: only ambient read is `now`, injectable via the `today` param for deterministic tests.

**Then**: `computeQuartersAndMonths(axisStart, axisEnd)` → `{ quarters, months, firstDay, lastDay }`.

**Replaces**: [gantt-grid.js#L330-L345](src/canjs/reports/gantt-grid.js#L330-L345) (`quartersAndMonths` getter).

**Test cases**: empty list → `today → today+90d`; all-missing due → default +90d; past-due →
clamped to `today+90d`; normal range → `axisStart === today`, `axisEnd === max due`.

---

### 3.2 Grid template columns

#### `computeGridTemplateColumns(months: Month[], extraColumnCount: number): string`

**Purpose**: Build the CSS `grid-template-columns` string: two `auto` gutter columns (chevron +
label), one `auto` per extra column (% complete), then one day-weighted `fr` per month.

**Logic** (ports [gantt-grid.js#L404-L419](src/canjs/reports/gantt-grid.js#L404-L419) `gridColumnsCSS`,
plus the leading `auto auto` from the template [L70](src/canjs/reports/gantt-grid.js#L70)):

```typescript
export const computeGridTemplateColumns = (months: Month[], extraColumnCount: number): string => {
  const gutter = 'auto auto'; // chevron + label
  const extras = extraColumnCount > 0 ? ` repeat(${extraColumnCount}, auto)` : '';
  const monthCols = ' ' + months.map((m) => `${m.daysInMonth}fr`).join(' ');
  return gutter + extras + monthCols;
};
```

> The shared `computeGridColumnCSS(months)` produces just the month `fr` portion; this Gantt
> helper wraps it with the gutter + extra columns. Reuse it internally to avoid divergence.

**Replaces**: [gantt-grid.js#L404-L419](src/canjs/reports/gantt-grid.js#L404-L419).

---

### 3.3 Row model (hierarchy flatten + grouping)

The Gantt renders a **flat list of row descriptors**. Two pure helpers build it.

#### `flattenIssueRows(issues, isExpanded, getChildren, depth?): GanttRow[]`

**Purpose**: Recursively expand the hierarchy into rows, honoring per-key expand state.

**Logic** (ports `makeGetRows` [gantt-grid.js#L763-L778](src/canjs/reports/gantt-grid.js#L763-L778)):

```typescript
export type GanttRow =
  | { type: 'issue'; issue: IssueOrRelease; isShowingChildren: boolean; depth: number }
  | { type: 'group'; issue: GroupHeader; depth: 0 };

export const flattenIssueRows = (
  issues: IssueOrRelease[],
  isExpanded: (key: string) => boolean,
  getChildren: (issue: IssueOrRelease) => IssueOrRelease[],
  depth = 0,
): GanttRow[] =>
  issues.flatMap((issue) => {
    const showing = isExpanded(issue.key);
    const row: GanttRow = { type: 'issue', issue, isShowingChildren: showing, depth };
    return showing ? [row, ...flattenIssueRows(getChildren(issue), isExpanded, getChildren, depth + 1)] : [row];
  });
```

**Why pure**: `isExpanded` and `getChildren` are injected predicates — no `this`, no observables.

#### `buildGanttRows(config): GanttRow[]`

**Purpose**: Top-level row assembly — apply grouping (or not), then flatten each group.

**Input**:

```typescript
interface BuildGanttRowsConfig {
  primaryIssues: IssueOrRelease[];
  allIssues: IssueOrRelease[];
  groupBy: '' | 'parent' | 'team' | 'project';
  primaryIssueType: string;
  isExpanded: (key: string) => boolean;
  getChildren: (issue: IssueOrRelease) => IssueOrRelease[];
}
```

**Logic** (ports the four branches of `gridRowData`
[gantt-grid.js#L352-L419](src/canjs/reports/gantt-grid.js#L352-L419), but delegating grouping to
the shared `groupIssues`):

```typescript
export const buildGanttRows = (cfg: BuildGanttRowsConfig): GanttRow[] => {
  const grouped = cfg.groupBy !== '' && cfg.primaryIssueType !== 'Release';
  if (!grouped) {
    return flattenIssueRows(cfg.primaryIssues, cfg.isExpanded, cfg.getChildren);
  }
  const groups = groupIssues(cfg.primaryIssues, cfg.allIssues, cfg.groupBy); // shared helper
  return groups.flatMap((g) => [
    { type: 'group', issue: toGroupHeader(g), depth: 0 } as GanttRow,
    ...flattenIssueRows(g.issues, cfg.isExpanded, cfg.getChildren),
  ]);
};
```

- `groupIssues` handles parent-summary/rank resolution and the "No Parent/Team/Project" fallbacks
  — this **fixes the legacy group-by-team crash** on issues without a team (plan §Known issues #2).
- `toGroupHeader(group)` maps `IssueGroup` → a minimal `GroupHeader` (`{ key, summary, status? }`)
  for the group row.

**Replaces**: `gridRowData` + `getSortedParents`
([gantt-grid.js#L352-L419](src/canjs/reports/gantt-grid.js#L352-L419),
[L780-L822](src/canjs/reports/gantt-grid.js#L780-L822)).

**Test cases**: ungrouped flatten; grouped-by-parent orders parents by rank; group-by-team with a
teamless issue → "No Team" (no throw); `primaryIssueType === 'Release'` ignores `groupBy`; expand
state inserts child rows at `depth+1`.

---

### 3.4 Bar positioning

#### `computeBarPosition(range, work, roundTo): BarPosition`

**Purpose**: Convert a `{ start, due }` work window into CSS-grid bar geometry + extension flags.

**Input**:

```typescript
interface AxisRange {
  firstDay: Date;
  lastDay: Date;
}
interface Work {
  start?: Date | null;
  due?: Date | null;
}

interface BarPosition {
  startExtends: boolean; // begins before firstDay (clip left)
  endExtends: boolean; // ends after lastDay (clip right)
  endIsBeforeFirstDay: boolean; // entirely in the past → render ← circle
  startIsAfterLastDay: boolean;
  isEmpty: boolean; // both dates null → degenerate 1px placeholder
  widthPercent: number;
  marginLeftPercent: number;
}
```

**Logic** (ports `getPositionsFromWork`
[gantt-grid.js#L675-L716](src/canjs/reports/gantt-grid.js#L675-L716); `roundTo` is now a **param**):

```typescript
const DAY_MS = 24 * 60 * 60 * 1000;

export const computeBarPosition = (range: AxisRange, work: Work, roundTo: string): BarPosition => {
  const firstDay = range.firstDay.getTime();
  const lastDay = range.lastDay.getTime();
  const totalTime = lastDay - firstDay;

  const rStart = work.start ? roundDownStart(work.start, roundTo)?.getTime() : null;
  const rDue = work.due ? roundUpEnd(work.due, roundTo)?.getTime() : null;

  if (rStart == null && rDue == null) {
    return {
      isEmpty: true,
      startExtends: false,
      endExtends: false,
      endIsBeforeFirstDay: false,
      startIsAfterLastDay: false,
      widthPercent: 0,
      marginLeftPercent: 0,
    };
  }
  const start = Math.max(firstDay, rStart ?? firstDay);
  const end = Math.min(lastDay, rDue ?? lastDay);
  return {
    isEmpty: false,
    startExtends: (rStart ?? firstDay) < firstDay,
    endExtends: (rDue ?? lastDay) > lastDay,
    endIsBeforeFirstDay: rDue != null && rDue <= firstDay,
    startIsAfterLastDay: rStart != null && rStart >= lastDay,
    widthPercent: Math.max(((end + DAY_MS - start) / totalTime) * 100, 0),
    marginLeftPercent: ((start - firstDay) / totalTime) * 100, // component applies max(_, 1px)
  };
};
```

- `roundDownStart` / `roundUpEnd` compose the pure `roundDate[roundTo]` table (start rounds down,
  end rounds up) — **not** the global-reading `roundDateByRoundToParam` (same fix the scatter
  rewrite made, logic.md §2.2 there).
- The `+ DAY_MS` "occupy the final day" convention and `Math.max(_, 0)` clamp are preserved.

**Replaces**: [gantt-grid.js#L675-L716](src/canjs/reports/gantt-grid.js#L675-L716).

**Test cases**: fully-inside bar; clip-left (`startExtends`); clip-right (`endExtends`);
entirely-past (`endIsBeforeFirstDay`); both-null → `isEmpty`; single-day width; rounding by week/month.

---

### 3.5 Bar corner & border classes

#### `barCornerClass({ startExtends, endExtends }): string` and `barBorderClasses({ startExtends, endExtends }): string[]`

**Purpose**: Tailwind rounding/border sides that make a clipped bar read as "continues off-screen".

**Logic** (ports [gantt-grid.js#L632-L652](src/canjs/reports/gantt-grid.js#L632-L652)):

```typescript
export const barCornerClass = ({ startExtends, endExtends }: Extends): string =>
  !startExtends && !endExtends
    ? 'rounded'
    : startExtends && endExtends
      ? 'rounded-none'
      : startExtends
        ? 'rounded-r'
        : 'rounded-l';

export const barBorderClasses = ({ startExtends, endExtends }: Extends): string[] =>
  !startExtends && !endExtends
    ? ['border']
    : startExtends && endExtends
      ? ['border-0']
      : startExtends
        ? ['border-r', 'border-y']
        : ['border-l', 'border-y'];
```

**Why pure**: total functions over two booleans. Trivially exhaustively tested (4 cases each).

---

### 3.6 Percent complete

#### `computePercentComplete(issue): number | null`

**Purpose**: Single source of truth for the % complete value, with the divide-by-zero guard.

**Logic** (unifies `columnsToShow.getValue` + `getPercentComplete`
[gantt-grid.js#L209-L242](src/canjs/reports/gantt-grid.js#L209-L242),
[L270-L279](src/canjs/reports/gantt-grid.js#L270-L279)):

```typescript
export const computePercentComplete = (issue: IssueOrRelease): number | null => {
  const { completedWorkingDays, totalWorkingDays } = issue.completionRollup;
  if (!totalWorkingDays) return null; // guard: was NaN in legacy (plan §Known issues #3)
  return Math.round((completedWorkingDays * 100) / totalWorkingDays);
};
```

The cell renderer formats `null` as **`—`** (em dash — the app's missing-number convention;
plan §Known issues #3) and a number as `${n}%`.

**Replaces**: the duplicated percent logic; the cell + modal both call this one helper.

---

### 3.7 Work-type presence (breakdown mode)

#### `computeWorkTypesWithWork(issues): { type: string; hasWork: boolean }[]`

**Purpose**: Which of `workTypes` (dev/qa/uat/…) actually have work across the primary issues —
drives which breakdown bars to draw.

**Logic** (ports `hasWorkTypes` [gantt-grid.js#L591-L604](src/canjs/reports/gantt-grid.js#L591-L604)):

```typescript
export const computeWorkTypesWithWork = (issues: IssueOrRelease[]) =>
  workTypes.map((type) => ({
    type,
    hasWork: issues.some((i) => i.rollupStatuses[type]?.issueKeys.length),
  }));
```

---

### 3.8 Density (Gantt variant)

#### `computeDensity(issueCount, isBreakdown): boolean`

**Purpose**: `lotsOfIssues`, but forced **false** in breakdown mode (Gantt-specific).

```typescript
export const computeDensity = (issueCount: number, isBreakdown: boolean): boolean =>
  !isBreakdown && shouldUseDensityOptimizations(issueCount); // shared helper = count > 20
```

**Replaces**: `lotsOfIssues` getter ([gantt-grid.js#L206-L208](src/canjs/reports/gantt-grid.js#L206-L208)).
Also exposes the derived class tokens (`textSize`, `bigBarSize`, `shadowBarSize`, `expandPadding`)
as a small `densityClasses(isDense)` map so the component stays declarative.

> **Note**: legacy circle-size classes were a no-op (`fewerIssuesClasses === lotsOfIssueClasses`).
> The port keeps circle sizing identical (plan §Known issues #5); only text/bar sizes vary.

---

### 3.9 Special-status text color

#### `specialStatusTextClass(status): string`

**Purpose**: `complete`/`blocked`/`warning` labels get `color-text-{status}`; everything else empty.

**Logic** (ports `classForSpecialStatus`, dropping the unused `issue` param
[gantt-grid.js#L314-L320](src/canjs/reports/gantt-grid.js#L314-L320)):

```typescript
const SPECIAL = new Set(['complete', 'blocked', 'warning']);
export const specialStatusTextClass = (status: string): string => (SPECIAL.has(status) ? `color-text-${status}` : '');
```

---

### 3.10 Today-line offset

Reuse the shared **`calculateTodayMargin(today, firstDay, lastDay)`** (scatter `positioning.ts`) —
it already subtracts the same 2-day nudge the Gantt uses
([gantt-grid.js#L346-L350](src/canjs/reports/gantt-grid.js#L346-L350)). No new helper needed.

---

### 3.11 Dates-tooltip data

#### `buildDatesTooltip(issue): { startPill?: string; durationPill?: string; endPill?: string }`

**Purpose**: The three pills shown on bar hover — pure data, rendered by the Popup component.

**Logic** (ports `datesTooltipStache` + `makeDateAndDiff`
[gantt-grid.js#L45-L57](src/canjs/reports/gantt-grid.js#L45-L57),
[L661-L673](src/canjs/reports/gantt-grid.js#L661-L673)):

```typescript
export const buildDatesTooltip = (issue: IssueOrRelease) => {
  const { start, due } = issue.rollupDates;
  const last = issue.issueLastPeriod?.rollupDates;
  return {
    startPill: formatDateAndDiff(start, last?.start),
    endPill: formatDateAndDiff(due, last?.due),
    durationPill: start && due ? timeRangeShorthand(daysBetween(due, start)) : undefined,
  };
};
```

`formatDateAndDiff(date, lastDate)` formats via `Intl.DateTimeFormat` and appends a signed
`+/-<shorthand>` diff when the two differ (pure; extract the formatter as a module constant).

---

## 4. React Component Architecture (top-down)

### 4.1 Component tree & call graph

```
<GanttGrid>                              ── container: reads observables, owns expand state,
  │                                          calls helpers, renders the CSS grid
  ├─ computeAxisRange → computeQuartersAndMonths → computeGridTemplateColumns   (helpers)
  ├─ buildGanttRows(…) → flattenIssueRows / groupIssues                          (helpers)
  │
  ├─ <QuarterAndMonthHeaders columnOffset={gutter}/>   ── shared/timeline
  ├─ <TodayLine columnOffset marginLeftPercent/>       ── shared/timeline (calculateTodayMargin)
  ├─ <GridLines columnOffset/>                          ── shared/timeline
  │
  └─ rows.map(row =>
        row.type === 'group'
          ? <GroupRow>                     ── group header + issue tooltip
              └─ <IssueTooltip> (Atlaskit Popup)
          : <IssueRow>                     ── one issue: label + optional % cell + timeline
              ├─ <LabelCell>               ── chevron (expand/collapse) + Jira link
              ├─ <PercentCompleteCell>     ── computePercentComplete → "—"/"n%"; opens modal
              └─ <TimelineCell>
                    └─ <TimelineBar>       ── computeBarPosition + barCornerClass/barBorderClasses
                          ├─ current-period bar   (rollup mode)
                          ├─ work-type bars       (breakdown mode: computeWorkTypesWithWork)
                          ├─ last-period shadow    (<ShadowBar>)
                          ├─ empty-set circles     (<StatusCircle> ← / ∅ / empty-set.svg)
                          └─ <DatesTooltip> (Atlaskit Popup, buildDatesTooltip)
     )
  └─ <PercentCompleteModal> (Atlaskit, rendered when a % cell is clicked)
```

### 4.2 `GanttGrid` (container)

**Props** (individual `*Obs` per repo convention, mounted from `timeline-report.js`):

```typescript
interface GanttGridProps {
  primaryIssuesOrReleasesObs: CanObservable<IssueOrRelease[]>;
  allIssuesOrReleasesObs: CanObservable<IssueOrRelease[]>;
  groupByObs: CanObservable<'' | 'parent' | 'team' | 'project'>;
  primaryIssueTypeObs: CanObservable<string>;
  roundToObs: CanObservable<string>;
  breakdownObs: CanObservable<boolean>; // routeData.primaryReportBreakdown
  showPercentCompleteObs: CanObservable<boolean>; // single source of truth (plan §Known issues #4)
}
```

**Responsibilities**:

1. Read observables via `useCanObservable`.
2. Own expand state: `const [expandedKeys, setExpanded] = useState<Set<string>>(new Set())`;
   `isExpanded = (k) => expandedKeys.has(k)`; `toggle(key)` flips membership (only when the issue
   has children).
3. Derive (all pure, memoized with `useMemo` keyed on the relevant inputs):
   - `getChildren = useMemo(() => makeGetChildrenFromReportingIssues(allIssues), [allIssues])`
   - `{ axisStart, axisEnd } = computeAxisRange(primaryIssues)`
   - `qam = computeQuartersAndMonths(axisStart, axisEnd)`
   - `isDense = computeDensity(primaryIssues.length, breakdown)`
   - `extraColumns = showPercentComplete ? 1 : 0`; `gutter = 2 + extraColumns`
   - `gridTemplateColumns = computeGridTemplateColumns(qam.months, extraColumns)`
   - `rows = buildGanttRows({ primaryIssues, allIssues, groupBy, primaryIssueType, isExpanded, getChildren })`
   - `todayMargin = calculateTodayMargin(new Date(), qam.firstDay, qam.lastDay)`
   - `workTypes = breakdown ? computeWorkTypesWithWork(primaryIssues) : []`
4. Render the CSS grid: shared headers/today-line/grid-lines (with `columnOffset={gutter}`), then
   map `rows` to `GroupRow`/`IssueRow`.
5. Hold modal state: `const [modalIssue, setModalIssue] = useState<IssueOrRelease | null>(null)`;
   render `<PercentCompleteModal>` when set.

**Note**: no container width measurement is required (bars are date-positioned, not text-measured),
so the Gantt has no `useMeasuredTextWidths` equivalent — simpler than the scatter container.

### 4.3 `IssueRow`

- Renders three (or four) grid children on the same grid row:
  1. **`LabelCell`** — chevron button (uses `isShowingChildren`, `hasChildren`, `depth*4` indent,
     `showExpandChildrenIcon` visibility rule) + `<a href={issue.url} target="_blank">` with
     `specialStatusTextClass(status)` + `densityClasses.textSize`.
  2. **`PercentCompleteCell`** (only when `showPercentComplete`) — `computePercentComplete(issue)`
     rendered as `—`/`n%`; `onClick` → `setModalIssue(issue)`.
  3. **`TimelineCell`** → **`TimelineBar`**.
- Row background stripe: alternating `bg-neutral-20`. Its column span widens to the full grid when
  `anyExpanded` (ports `somePrimaryIssuesAreExpanded` / `alignLeft`
  [gantt-grid.js#L446-L456](src/canjs/reports/gantt-grid.js#L446-L456)); passed down as a prop from
  the container so it's computed once.

### 4.4 `TimelineBar`

Pure-data-driven; **no imperative DOM**. Given `barPosition = computeBarPosition(range, rollup, roundTo)`:

- If `issue.rollupStatuses.rollup.start && .due` missing → `<StatusCircle variant="empty-set-current"/>`.
- Else if `barPosition.endIsBeforeFirstDay` → `<StatusCircle status arrow="←"/>`.
- Else render the **current bar**: absolute-positioned div, `width`/`marginLeft` from
  `barPosition` (with `max(_, 1px)`), `getStatusColorClass(status)`, `barCornerClass(...)`,
  `bigBarSize`, wrapped in an Atlaskit `Popup` trigger showing `buildDatesTooltip(issue)`.
- **Breakdown mode**: instead of the single rollup bar, map `workTypes.filter(w => w.hasWork)` to a
  thin `type_time` bar each (`h-[6px]`) colored by `rollupStatuses[type].status`, plus its shadow.
- **Last-period shadow** (`<ShadowBar>`): when `rollup.lastPeriod` has both dates and differs from
  current → blurred bordered bar (`barBorderClasses`, `barCornerClass`, `shadowBarSize`); when the
  last period exists but current lost dates → `<StatusCircle variant="empty-set-past"/>` (`∅`);
  skipped when identical to current.

### 4.5 `GroupRow`

- Group header label (bold, `specialStatusTextClass`), spanning the label gutter.
- Click → Atlaskit `Popup` **`IssueTooltip`** (rebuilt; plan §Tooltips) showing the linked title,
  a "Show Children" explore link, and per-work-part rollup/dev/qa/uat sections (ports
  [issue-tooltip.js](src/canjs/controls/issue-tooltip.js#L44-L181)).
- Group background stripe spans the full grid width.

### 4.6 `PercentCompleteModal`

- Rebuilt Atlaskit modal (plan §PercentComplete) replacing
  [src/react/reports/GanttReport/PercentComplete](src/react/reports/GanttReport/PercentComplete/PercentComplete.tsx).
- Receives `issue`, `childIssues = getChildren(issue)`, `allIssues`. Shows the same
  self/average/children calculation breakdown documented in behavior.md.

### 4.7 Mounting (`timeline-report.js`)

- Add `'start-due': GanttGrid` to `urlParamValuesToReactComponents`; remove the `<gantt-grid>`
  Stache block and its import (plan Phase 4).
- `renderReactReport` passes the observables above via `value.from(this, …)` / `value.bind(routeData, …)`,
  wrapped in `QueryClientProvider` + `JiraProvider` (same as the scatter mount).

---

## 5. Data Types

```typescript
// Extends the shared IssueOrRelease slice with Gantt-only fields.
interface IssueOrRelease {
  key: string;
  summary: string;
  url?: string;
  parentKey?: string | null;
  projectKey?: string;
  rank?: string | null;
  team?: { name: string } | null;
  names?: { shortVersion?: string | null };
  rollupDates: { start?: Date | null; due?: Date | null; dueTo?: Date | null };
  rollupStatuses: {
    rollup: RollupStatus;
    dev?: RollupStatus;
    qa?: RollupStatus;
    uat?: RollupStatus; // work types
    [workType: string]: RollupStatus | undefined;
  };
  completionRollup: { completedWorkingDays: number; totalWorkingDays: number };
  reportingHierarchy: { depth: number; childKeys: string[] };
  issueLastPeriod?: { rollupDates?: { start?: Date | null; due?: Date | null } };
}

interface RollupStatus {
  status: string;
  start?: Date | null;
  due?: Date | null;
  issueKeys: string[];
  lastPeriod?: { start?: Date | null; due?: Date | null } | null;
}

type GanttRow =
  | { type: 'issue'; issue: IssueOrRelease; isShowingChildren: boolean; depth: number }
  | { type: 'group'; issue: GroupHeader; depth: 0 };

interface GroupHeader {
  key: string;
  summary: string;
  status?: string | null;
}

interface BarPosition {
  isEmpty: boolean;
  startExtends: boolean;
  endExtends: boolean;
  endIsBeforeFirstDay: boolean;
  startIsAfterLastDay: boolean;
  widthPercent: number;
  marginLeftPercent: number;
}

// Quarter, Month, QuartersAndMonths — reused from shared/timeline (compute-quarters-and-months).
```

---

## 6. Proposed File Layout

```
src/react/reports/GanttReport/GanttGrid/
├── GanttGrid.tsx
├── GanttGrid.stories.tsx
├── GanttGrid.test.tsx
├── index.ts
├── types.ts
├── fixtures.ts
├── helpers/
│   ├── computeAxisRange.ts            (+ .test)
│   ├── gridColumns.ts                 (computeGridTemplateColumns) (+ .test)
│   ├── rows.ts                        (flattenIssueRows, buildGanttRows) (+ .test)
│   ├── barPosition.ts                 (computeBarPosition) (+ .test)
│   ├── barClasses.ts                  (barCornerClass, barBorderClasses) (+ .test)
│   ├── percentComplete.ts             (computePercentComplete) (+ .test)
│   ├── workTypes.ts                   (computeWorkTypesWithWork) (+ .test)
│   ├── density.ts                     (computeDensity, densityClasses) (+ .test)
│   ├── status.ts                      (specialStatusTextClass) (+ .test)
│   ├── datesTooltip.ts                (buildDatesTooltip, formatDateAndDiff) (+ .test)
│   └── index.ts
└── components/
    ├── IssueRow/
    ├── GroupRow/
    ├── LabelCell/
    ├── PercentCompleteCell/
    ├── TimelineCell/
    ├── TimelineBar/
    ├── ShadowBar/
    ├── StatusCircle/
    ├── DatesTooltip/          (Atlaskit Popup)
    ├── IssueTooltip/          (Atlaskit Popup)
    └── PercentCompleteModal/  (Atlaskit modal)

src/react/reports/shared/timeline/     (plan Phase 0 — reused by both reports)
├── helpers/ { groupIssues, status, density }
├── components/ { QuarterAndMonthHeaders, TodayLine, GridLines, StatusLegend }
└── types.ts
```

---

## 7. Testing Strategy

- **Pure helpers (bulk of effort)**: exhaustive unit tests per §3 — axis defaults/clamp, row
  flatten + grouping (incl. teamless issue, Release ignores groupBy, expand inserts children), bar
  positioning (inside/clip-left/clip-right/past/empty/rounding), corner & border tables (4 cases
  each), percent-complete divide-by-zero → `—`, work-type presence, density (breakdown forces
  false), dates-tooltip pills & signed diffs.
- **Component tests**: mock helpers/observables; assert header/today-line/grid-line rendering,
  chevron expand/collapse toggles rows, `columnOffset` shifts shared components, % cell opens
  modal, breakdown renders per-work-type bars, empty-set circles for undated issues, grouped vs
  ungrouped layout.
- **Stories** (`GanttGrid.stories.tsx`): grouping (parent/team/project), breakdown, density
  (>20), undated issues, expand/collapse, past-due (`←`), bars extending both edges,
  last-period shadow.
- **Parity check**: after Phase 0, existing ScatterTimeline tests + stories must still pass
  (validates the shared-module extraction) — plan §Verification.

```

```

# Scatter Timeline Report — React Rewrite Logic & Architecture

**Status**: Architecture Design
**Report Key**: `'due'` (Scatter Plot)
**Feature Flag**: `scatterPlot`
**Target**: Pure functions + React components following repo conventions

---

## 1. Design Philosophy

The scatter timeline rewrite prioritizes **testability through separation of concerns**:

### Pure Computation

- **Date range & calendar math**: Quarter/month headers, grid column sizing → pure functions with date inputs
- **Positioning calculations**: Due date → grid percentages, collision detection → pure functions taking measured widths as parameters
- **Status mapping**: Status string → CSS color class → pure lookup functions
- **Row packing algorithm**: Issue list + widths → optimal non-overlapping rows → pure function with no side effects

**Why pure?**

- Exhaustive unit test coverage (no DOM, no globals, no async)
- Deterministic: same inputs always produce same outputs
- Reusable: can be called from React, server-side pre-rendering, or debugging tools
- Easy to optimize and profile

### Measurement Isolation

Text width measurement is an **impurity** (requires DOM). We isolate it:

- Measurement becomes a **parameter** to pure functions, not an internal dependency
- A single batched-measurement function + React hook handles the DOM side effects
- Pure row-packing algorithm receives widths as input array

### React Layer

- **Presentation logic only**: component receives calculated row/position data, renders it
- **State management**: hover, selection, tooltips → React state (not in pure functions)
- **CanJS bridge**: `useCanObservable` hook subscribes to observable data
- **Suspense/Error boundaries**: Mount from `timeline-report.js` with proper boundaries

### Test Pyramid

- **Unit tests** (pure functions, exhaustive): 80% of effort
- **Component tests** (rendering, interactions, mocked data): 15%
- **E2E tests** (flow through UI): 5%

---

## 2. Pure Functions

### 2.1 Date Range & Calendar Computation

#### `computeQuartersAndMonths(startDate: Date, endDate: Date): QuartersAndMonths`

**Purpose**: Compute quarter and month headers spanning a date range.

**Inputs**:

- `startDate: Date` — earliest date to include
- `endDate: Date` — latest date to include

**Output**:

```typescript
interface Month {
  date: Date;
  name: string; // 'Jan', 'Feb', etc.
  daysInMonth: number; // for grid column width calculation
  number: number; // 0-11
  first?: boolean; // true if first month of quarter
  last?: boolean; // true if last month of quarter
}

interface Quarter {
  name: string; // 'Q1', 'Q2', etc.
  number: number; // 1-4
  monthIndices: [number, number, number]; // which months in the months array
}

interface QuartersAndMonths {
  quarters: Quarter[];
  months: Month[];
  firstDay: Date; // start of first quarter (midnight)
  lastDay: Date; // end of last quarter (midnight)
}
```

**Logic**:

1. Round `startDate` down to start of its quarter (first day of month 0, 3, 6, or 9)
2. Round `endDate` up to end of its quarter (day after last day of month 2, 5, 8, or 11)
3. For each quarter between rounded dates, create quarter header
4. For each month, compute name, days, ordinal position
5. Return complete grid structure

**Why pure**:

- No DOM access, no global state reads
- All date math via `Date` constructors and `getMonth()`, `getFullYear()`
- Easy to unit-test: pass various date ranges, verify month/quarter count and names

**Test cases**:

```typescript
describe('computeQuartersAndMonths', () => {
  test('single month (January)', () => {
    const result = computeQuartersAndMonths(new Date('2025-01-15'), new Date('2025-01-20'));
    // Should expand to Q1 2025 (Jan–Mar)
    expect(result.months).toHaveLength(3);
    expect(result.months[0].name).toBe('Jan');
    expect(result.months[0].daysInMonth).toBe(31);
    expect(result.quarters).toHaveLength(1);
  });

  test('multi-quarter range (Q1-Q2)', () => {
    const result = computeQuartersAndMonths(new Date('2025-02-01'), new Date('2025-05-31'));
    expect(result.quarters).toHaveLength(2);
    expect(result.months).toHaveLength(6);
  });

  test('handles leap year February correctly', () => {
    const result = computeQuartersAndMonths(new Date('2024-01-01'), new Date('2024-12-31'));
    const febMonth = result.months[1];
    expect(febMonth.name).toBe('Feb');
    expect(febMonth.daysInMonth).toBe(29); // leap year
  });

  test('non-leap year February', () => {
    const result = computeQuartersAndMonths(new Date('2025-01-01'), new Date('2025-12-31'));
    const febMonth = result.months[1];
    expect(febMonth.daysInMonth).toBe(28);
  });
});
```

**Replaces**: [scatter-timeline.js:66–81](src/canjs/reports/scatter-timeline.js#L66-L81) (`quartersAndMonths` getter)

---

#### `computeGridColumnCSS(months: Month[]): string`

**Purpose**: Convert month definitions to CSS Grid `grid-template-columns` string.

**Input**: `months: Month[]` — output of `computeQuartersAndMonths`

**Output**: `string` — CSS like `"31fr 28fr 31fr 30fr ..."` (days per month as fractions)

**Logic**:

- Map each month: `"${month.daysInMonth}fr"`
- Join with space

**Why pure**: Zero side effects, simple string join

**Test cases**:

```typescript
test('computeGridColumnCSS', () => {
  const months: Month[] = [
    { date: new Date('2025-01-01'), daysInMonth: 31, name: 'Jan', number: 0 },
    { date: new Date('2025-02-01'), daysInMonth: 28, name: 'Feb', number: 1 },
    { date: new Date('2025-03-01'), daysInMonth: 31, name: 'Mar', number: 2 },
  ];
  expect(computeGridColumnCSS(months)).toBe('31fr 28fr 31fr');
});
```

> **Leap-year / century-year correctness (plan §Questions #6):** `computeGridColumnCSS`
> reads `month.daysInMonth` straight from `computeQuartersAndMonths` and never recomputes
> days, so it inherits the correct value. When `computeQuartersAndMonths` computes
> `daysInMonth`, use `getFullYear()` (or the existing `getDaysInMonth(year, month)` helper
> with a full year) — **not** the legacy `date.getYear()` (year−1900), which is wrong for
> century years like 2000. Parity tests target the corrected behavior; the legacy
> `getYear()` bug is intentionally fixed.

**Replaces**: [scatter-timeline.js:83–91](src/canjs/reports/scatter-timeline.js#L83-L91) (`gridColumnsCSS` getter)

---

#### `computeDateRange(issues: IssueOrRelease[]): { firstEndDate: Date; endDate: Date }`

**Purpose**: Compute the `[start, end]` window fed into `computeQuartersAndMonths`,
reproducing the legacy getter's behavior — including its empty / all-missing-date fallback.

**Input**: `issues: IssueOrRelease[]` — the primary issues/releases

**Output**: `{ firstEndDate, endDate }` — the expanded range (start − 30d, due + 30d)

**Logic** (mirrors [scatter-timeline.js:66–81](src/canjs/reports/scatter-timeline.js#L66-L81)):

```typescript
import { mergeStartAndDueData } from '../../../../jira/rollup/dates/dates';

const DAY_MS = 24 * 60 * 60 * 1000;

export const computeDateRange = (issues: IssueOrRelease[]): { firstEndDate: Date; endDate: Date } => {
  const now = new Date();
  const endDates = issues.map((issue) => ({
    start: issue.rollupDates.due,
    startFrom: issue.rollupDates.dueTo,
    due: issue.rollupDates.due,
    dueTo: issue.rollupDates.dueTo,
  }));
  const { start, due } = mergeStartAndDueData(endDates);
  return {
    firstEndDate: new Date((start ?? now).getTime() - DAY_MS * 30),
    endDate: due ?? new Date(now.getTime() + DAY_MS * 30),
  };
};
```

> **Why not `Math.min/Math.max`?** `Math.min(...[])` is `Infinity` (and `Math.max` is
> `-Infinity`), so an empty issue list — or one where every `due` is missing — would produce
> an Invalid Date and break the grid. Reusing `mergeStartAndDueData` + the `?? now` fallbacks
> keeps the empty and all-missing cases producing a valid now ± 30-day window
> (behavior.md Edge Case #1; plan §Questions #3).

**Why pure**: Composes the pure `mergeStartAndDueData`; `now` is the only ambient read and
can be injected as an optional param in tests if determinism is needed.

**Test cases**:

```typescript
test('computeDateRange with issues uses min start − 30d and max due + 30d', () => {
  const issues = [
    { rollupDates: { due: new Date('2025-03-01') } },
    { rollupDates: { due: new Date('2025-05-01') } },
  ] as any;
  const { firstEndDate, endDate } = computeDateRange(issues);
  expect(firstEndDate.getTime()).toBe(new Date('2025-03-01').getTime() - 30 * 24 * 60 * 60 * 1000);
  expect(endDate).toEqual(new Date('2025-05-01'));
});

test('computeDateRange empty list falls back to now ± 30d (no Invalid Date)', () => {
  const { firstEndDate, endDate } = computeDateRange([]);
  expect(Number.isNaN(firstEndDate.getTime())).toBe(false);
  expect(Number.isNaN(endDate.getTime())).toBe(false);
});
```

**Replaces**: the range math inside [scatter-timeline.js:66–81](src/canjs/reports/scatter-timeline.js#L66-L81) (`quartersAndMonths` getter)

---

#### `calculateTodayMargin(today: Date, firstDay: Date, lastDay: Date): number`

**Purpose**: Compute the left margin (percentage) for the "today" indicator line.

**Inputs**:

- `today: Date` — current date
- `firstDay: Date` — start of timeline grid
- `lastDay: Date` — end of timeline grid

**Output**: `number` — percentage (0–100, may exceed bounds)

**Logic**:

```typescript
const totalTime = lastDay.getTime() - firstDay.getTime();
const offset = today.getTime() - firstDay.getTime() - 2 * 24 * 60 * 60 * 1000; // subtract 2 days (visual centering)
return (offset / totalTime) * 100;
```

**Why pure**: Date arithmetic only, no DOM/globals

**Test cases**:

```typescript
test('calculateTodayMargin', () => {
  const firstDay = new Date('2025-01-01');
  const lastDay = new Date('2025-03-31');
  const today = new Date('2025-02-15');
  const margin = calculateTodayMargin(today, firstDay, lastDay);
  // Q1 is ~90 days, mid-point ~45 days in = ~50%
  expect(margin).toBeCloseTo(50, 0);
});

test('today before timeline', () => {
  const firstDay = new Date('2025-02-01');
  const lastDay = new Date('2025-03-31');
  const today = new Date('2025-01-15'); // before
  const margin = calculateTodayMargin(today, firstDay, lastDay);
  expect(margin).toBeLessThan(0);
});
```

**Replaces**: [scatter-timeline.js:94–101](src/canjs/reports/scatter-timeline.js#L94-L101) (`todayMarginLeft` getter)

---

#### `roundAndShiftDueDate(dueDate: Date, roundTo: string): Date`

**Purpose**: Apply rounding function and shift due date by one day (convention: due dates display at end of day).

**Inputs**:

- `dueDate: Date` — issue's raw due date
- `roundTo: string` — rounding strategy key (e.g. `'day'`, `'week'`, `'month'`, `'quarter'`, `'halfQuarter'`, from the `roundDate` table in [src/utils/date/round.js](src/utils/date/round.js#L141))

**Output**: `Date` — rounded date, shifted +1 day

**Logic**:

```typescript
import { roundDate } from '../../../../utils/date/round.js';
import { oneDayLater } from '../../../../utils/date/date-helpers.js';

export const roundAndShiftDueDate = (dueDate: Date, roundTo: string): Date => {
  // roundDate is keyed by strategy; each entry is { start, end }. `day` end is identity.
  const rounder = roundDate[roundTo]?.end ?? roundDate.day.end;
  return oneDayLater(rounder(dueDate));
};
```

> **Important**: Compose the low-level `roundDate` table (keyed by strategy string) from
> [src/utils/date/round.js](src/utils/date/round.js#L141), **not** > `roundDateByRoundToParam` from
> [src/canjs/routing/utils/round.ts](src/canjs/routing/utils/round.ts). The latter is an
> object of `{ start, end }` methods that read the **global** `routeData.roundTo` internally
> — it is _not_ keyed by a `roundTo` string, so `roundDateByRoundToParam[roundTo]` is
> always `undefined`. Passing `roundTo` in as a parameter keeps this function pure; the
> container reads `routeData.roundTo` and passes it. Reuse the existing `oneDayLater` from
> [src/utils/date/date-helpers.js](src/utils/date/date-helpers.js) for the +1-day shift
> rather than adding raw milliseconds (avoids DST drift).

**Why pure**: Pure function composition over the imported `roundDate` lookup and `oneDayLater`; `roundTo` is an explicit parameter, so no global reads.

**Test cases**:

```typescript
test('roundAndShiftDueDate with day rounding', () => {
  const dueDate = new Date('2025-02-15T14:30:00');
  const result = roundAndShiftDueDate(dueDate, 'day');
  // day.end is identity, then +1 day via oneDayLater
  expect(result).toEqual(oneDayLater(new Date('2025-02-15T14:30:00')));
});

test('roundAndShiftDueDate with week rounding', () => {
  const dueDate = new Date('2025-02-15'); // Saturday
  const result = roundAndShiftDueDate(dueDate, 'week');
  // week.end aligns to Friday, then +1 day
  expect(result.getTime()).toBeGreaterThan(dueDate.getTime());
});

test('roundAndShiftDueDate falls back to identity for unknown key', () => {
  const dueDate = new Date('2025-02-15');
  expect(roundAndShiftDueDate(dueDate, 'bogus')).toEqual(oneDayLater(dueDate));
});
```

**Replaces**: [scatter-timeline.js:257–260](src/canjs/reports/scatter-timeline.js#L257-L260) (`oneDayLater()` + `roundDateByRoundToParam.end()`)

---

### 2.3 Issue Positioning Calculations

#### `calculatePositionPercentages(config: PositionConfig): IssuePosition`

**Purpose**: Compute left/right percentages for an issue on the timeline grid.

**Inputs**:

```typescript
interface PositionConfig {
  roundedDueDate: Date; // already rounded + shifted
  textWidth: number; // measured width in pixels
  widthOfArea: number; // grid container width in pixels
  firstDay: Date;
  lastDay: Date;
}
```

**Output**:

```typescript
interface IssuePosition {
  leftPercentStart: number; // CSS "left" or reference point (%)
  rightPercentEnd: number; // percentage from left edge (%)
  endPercentFromRight: number; // percentage from right edge (%)
  widthInPercent: number; // issue width (%)
}
```

**Logic**:

```typescript
const totalTime = lastDay.getTime() - firstDay.getTime();
const widthInPercent = (textWidth * 100) / widthOfArea;
const rightPercentEnd = ((roundedDueDate.getTime() - firstDay.getTime()) / totalTime) * 100;
const endPercentFromRight = ((totalTime - (roundedDueDate.getTime() - firstDay.getTime())) / totalTime) * 100;
const leftPercentStart = rightPercentEnd - widthInPercent;

return {
  leftPercentStart,
  rightPercentEnd,
  endPercentFromRight,
  widthInPercent,
};
```

**Why pure**: Pure math, no DOM/measurement calls (measurement is a parameter)

**Test cases**:

```typescript
test('calculatePositionPercentages basic', () => {
  const config: PositionConfig = {
    roundedDueDate: new Date('2025-02-15'),
    textWidth: 100, // pixels
    widthOfArea: 1000, // pixels
    firstDay: new Date('2025-01-01'),
    lastDay: new Date('2025-03-31'),
  };
  const pos = calculatePositionPercentages(config);
  expect(pos.widthInPercent).toBe(10);
  expect(pos.rightPercentEnd).toBeCloseTo(45.4, 1); // rough midpoint of Q1
  expect(pos.leftPercentStart).toBeCloseTo(35.4, 1); // 10% to the left
});

test('issue at start of timeline', () => {
  const config: PositionConfig = {
    roundedDueDate: new Date('2025-01-02'), // just after start
    textWidth: 100,
    widthOfArea: 1000,
    firstDay: new Date('2025-01-01'),
    lastDay: new Date('2025-03-31'),
  };
  const pos = calculatePositionPercentages(config);
  expect(pos.rightPercentEnd).toBeCloseTo(1.1, 1); // ~1% in
});

test('issue at end of timeline', () => {
  const config: PositionConfig = {
    roundedDueDate: new Date('2025-03-31'),
    textWidth: 100,
    widthOfArea: 1000,
    firstDay: new Date('2025-01-01'),
    lastDay: new Date('2025-03-31'),
  };
  const pos = calculatePositionPercentages(config);
  expect(pos.rightPercentEnd).toBeCloseTo(100, 1);
  expect(pos.endPercentFromRight).toBeCloseTo(0, 1);
});
```

**Replaces**: [scatter-timeline.js:257–270](src/canjs/reports/scatter-timeline.js#L257-L270)

---

### 2.4 Collision Detection & Row Assignment

#### `intersect(range1: Range, range2: Range): boolean`

**Purpose**: Detect if two 1D ranges overlap.

**Inputs**:

```typescript
interface Range {
  start: number;
  end: number;
}
```

**Output**: `boolean`

**Logic**: `range1.start < range2.end && range2.start < range1.end`

**Why pure**: Elementary range math

**Test cases**:

```typescript
test('intersect overlapping', () => {
  expect(intersect({ start: 10, end: 30 }, { start: 20, end: 40 })).toBe(true);
  expect(intersect({ start: 20, end: 40 }, { start: 10, end: 30 })).toBe(true);
});

test('intersect touching boundaries', () => {
  expect(intersect({ start: 10, end: 30 }, { start: 30, end: 50 })).toBe(false); // no overlap at boundary
});

test('intersect contained', () => {
  expect(intersect({ start: 10, end: 50 }, { start: 20, end: 30 })).toBe(true);
});
```

**Replaces**: [scatter-timeline.js:305–307](src/canjs/reports/scatter-timeline.js#L305-L307)

---

#### `packIssuesIntoRows(issues: PlottedIssue[]): Row[]`

**Purpose**: Assign issues to non-overlapping rows using a greedy first-fit algorithm.

**Inputs**:

```typescript
interface PlottedIssue {
  key: string;
  issue: IssueOrRelease; // raw data for rendering
  leftPercentStart: number;
  rightPercentEnd: number;
  widthInPercent: number;
  // ... other positioning metadata
}
```

**Output**:

```typescript
interface Row {
  items: PlottedIssue[];
}
```

**Logic**:

1. For each issue (assumed pre-sorted by `leftPercentStart` ascending):

   - Try to fit in existing rows (iterate from row 0 onwards)
   - For each row, check if any item in the row intersects with the new issue
   - If no intersection, add issue to that row and proceed to next issue
   - If no compatible row found, create a new row with this issue

2. Return array of rows

**Why pure**:

- No DOM, no side effects
- Input list is pre-sorted (caller responsibility)
- Greedy algorithm is deterministic given sorted input
- Easy to test and debug

**Test cases**:

```typescript
test('packIssuesIntoRows single row', () => {
  const issues: PlottedIssue[] = [
    { leftPercentStart: 10, rightPercentEnd: 20, key: 'A' },
    { leftPercentStart: 30, rightPercentEnd: 40, key: 'B' },
    { leftPercentStart: 50, rightPercentEnd: 60, key: 'C' },
  ];
  const rows = packIssuesIntoRows(issues);
  expect(rows).toHaveLength(1);
  expect(rows[0].items).toHaveLength(3);
});

test('packIssuesIntoRows multiple rows due to collision', () => {
  const issues: PlottedIssue[] = [
    { leftPercentStart: 10, rightPercentEnd: 30, key: 'A' },
    { leftPercentStart: 20, rightPercentEnd: 40, key: 'B' }, // overlaps A
    { leftPercentStart: 50, rightPercentEnd: 60, key: 'C' },
  ];
  const rows = packIssuesIntoRows(issues);
  expect(rows).toHaveLength(2);
  expect(rows[0].items).toHaveLength(2); // A and C
  expect(rows[1].items).toHaveLength(1); // B
});

test('packIssuesIntoRows complex nested collisions', () => {
  const issues: PlottedIssue[] = [
    { leftPercentStart: 10, rightPercentEnd: 40, key: 'A' },
    { leftPercentStart: 20, rightPercentEnd: 35, key: 'B' }, // inside A
    { leftPercentStart: 25, rightPercentEnd: 50, key: 'C' }, // overlaps A and B
  ];
  const rows = packIssuesIntoRows(issues);
  expect(rows).toHaveLength(3); // all three must be separate
});
```

**Replaces**: [scatter-timeline.js:273–283](src/canjs/reports/scatter-timeline.js#L273-L283) (`addToRow()` function)

---

### 2.5 Status to Color Mapping

#### `getStatusColorClass(status: string): string`

**Purpose**: Map a rollup status to a CSS color class name.

**Input**: `status: string` — issue status (e.g., `'complete'`, `'ontrack'`, `'behind'`, `'warning'`, `'blocked'`)

**Output**: `string` — CSS class name (e.g., `'color-text-and-bg-complete'`)

**Logic**:

```typescript
const statusToCssMap: Record<string, string> = {
  complete: 'color-text-and-bg-complete',
  ontrack: 'color-text-and-bg-ontrack',
  behind: 'color-text-and-bg-behind',
  warning: 'color-text-and-bg-warning',
  blocked: 'color-text-and-bg-blocked',
  unknown: 'color-text-and-bg-unknown',
  notstarted: 'color-text-and-bg-notstarted',
  ahead: 'color-text-and-bg-ahead',
  new: 'color-text-and-bg-new',
  // handle any historical variants
  'behind-last-period': 'color-text-and-bg-behind-last-period',
  'ahead-last-period': 'color-text-and-bg-ahead-last-period',
  'warning-last-period': 'color-text-and-bg-warning-last-period',
  'blocked-last-period': 'color-text-and-bg-blocked-last-period',
};

return statusToCssMap[status] ?? 'color-text-and-bg-unknown'; // fallback
```

**Why pure**: Lookup table, deterministic, no side effects

**Test cases**:

```typescript
test('getStatusColorClass known statuses', () => {
  expect(getStatusColorClass('complete')).toBe('color-text-and-bg-complete');
  expect(getStatusColorClass('ontrack')).toBe('color-text-and-bg-ontrack');
  expect(getStatusColorClass('behind')).toBe('color-text-and-bg-behind');
});

test('getStatusColorClass unknown status', () => {
  expect(getStatusColorClass('invalid-status')).toBe('color-text-and-bg-unknown');
});

test('getStatusColorClass historical variants', () => {
  expect(getStatusColorClass('behind-last-period')).toBe('color-text-and-bg-behind-last-period');
});
```

**Replaces**: [scatter-timeline.js:248–249](src/canjs/reports/scatter-timeline.js#L248-L249) (dynamic CSS class building)

---

### 2.6 Density Decision

#### `shouldUseDensityOptimizations(issueCount: number): boolean`

**Purpose**: Decide whether to apply "lots of issues" optimizations (smaller text, markers, rows).

**Inputs**:

- `issueCount: number` — `primaryIssuesOrReleases.length`

**Output**: `boolean` — true if optimizations should apply

**Logic**:

```typescript
return issueCount > 20;
```

> **Note**: The legacy getter is `length > 20 && !this.breakdown`, but `this.breakdown` is
> never defined on `<scatter-timeline>` (no attribute passed; no getter — unlike
> [gantt-grid.js](src/canjs/reports/gantt-grid.js#L161-L162)), so `!this.breakdown` is always
> `true` and the effective behavior is just `length > 20`. We port that exact runtime
> behavior and **omit** the `breakdown` parameter entirely (see plan §Questions #4). If we
> later want gantt-style breakdown-aware density, add it as an intentional follow-up.

**Why pure**: Simple threshold logic

**Test cases**:

```typescript
test('shouldUseDensityOptimizations', () => {
  expect(shouldUseDensityOptimizations(15)).toBe(false);
  expect(shouldUseDensityOptimizations(20)).toBe(false); // boundary: not > 20
  expect(shouldUseDensityOptimizations(21)).toBe(true);
  expect(shouldUseDensityOptimizations(100)).toBe(true);
});
```

**Replaces**: [scatter-timeline.js:103–105](src/canjs/reports/scatter-timeline.js#L103-L105) (`lotsOfIssues` getter)

---

### 2.7 Text Width Pre-Filtering

#### `filterIssuesWithDates(issues: IssueOrRelease[]): IssueOrRelease[]`

**Purpose**: Remove issues that lack a due date (cannot be plotted).

**Input**: `issues: IssueOrRelease[]`

**Output**: `IssueOrRelease[]` — only issues with `rollupStatuses.rollup.due` set

**Logic**:

```typescript
return issues.filter((issue) => issue.rollupStatuses?.rollup?.due != null);
```

> **Filter + positioning use the same field.** The legacy code filters on `rollupDates.due`
> but _positions_ using `rollupStatuses.rollup.due` (see
> [scatter-timeline.js](src/canjs/reports/scatter-timeline.js#L253)). We standardize on
> `rollupStatuses.rollup.due` for **both** the filter here and the positioning in
> `roundAndShiftDueDate` / `calculatePositionPercentages`, guaranteeing every plotted issue
> has a non-null positioning date (no Invalid-Date markers). behavior.md §Step 1 is updated
> to match (see plan §Questions #2).

**Why pure**: Simple filter, no side effects

**Test cases**:

```typescript
test('filterIssuesWithDates', () => {
  const issues = [
    { key: 'A', rollupStatuses: { rollup: { due: new Date() } } },
    { key: 'B', rollupStatuses: { rollup: { due: null } } },
    { key: 'C', rollupStatuses: { rollup: {} } },
  ];
  const result = filterIssuesWithDates(issues as any);
  expect(result).toHaveLength(1);
  expect(result[0].key).toBe('A');
});
```

**Replaces**: [scatter-timeline.js:235–237](src/canjs/reports/scatter-timeline.js#L235-L237)

---

### 2.8 Issue Sorting for Packing

#### `sortIssuesByLeftPosition(issues: PlottedIssue[]): PlottedIssue[]`

**Purpose**: Sort issues left-to-right for optimal row packing.

**Input**: `issues: PlottedIssue[]` — with `leftPercentStart` computed

**Output**: `PlottedIssue[]` — sorted (non-mutating)

**Logic**:

```typescript
return [...issues].sort((a, b) => a.leftPercentStart - b.leftPercentStart);
```

**Why pure**: Non-mutating sort, deterministic

**Test cases**:

```typescript
test('sortIssuesByLeftPosition', () => {
  const issues = [
    { leftPercentStart: 50, key: 'C' },
    { leftPercentStart: 10, key: 'A' },
    { leftPercentStart: 30, key: 'B' },
  ];
  const sorted = sortIssuesByLeftPosition(issues as any);
  expect(sorted.map((i) => i.key)).toEqual(['A', 'B', 'C']);
  expect(issues).toEqual([
    // original unchanged
    { leftPercentStart: 50, key: 'C' },
    { leftPercentStart: 10, key: 'A' },
    { leftPercentStart: 30, key: 'B' },
  ]);
});
```

**Replaces**: [scatter-timeline.js:239–243](src/canjs/reports/scatter-timeline.js#L239-L243)

---

## 3. Text Width Measurement Strategy

Text width is the **only impurity** in the positioning logic. We isolate it via a **measurement hook**.

**Decision** (see [measurement-batching.md](spec/003-scatter-timeline-rewrite/measurement-batching.md)): We **do not estimate** widths from character count — proportional fonts make estimation inaccurate (wide `WWWW` vs. narrow `iiii` glyphs), which would break the packing algorithm. We keep **true DOM measurement** but eliminate the current per-issue layout thrashing by using **Option A — batched read/write** (all DOM writes first, then all reads, so layout flushes once instead of once per issue). We do **not** use the Canvas `measureText()` approach.

### Batched Measurement Function (Isolated Impurity)

The measurement itself is a small, isolated function that performs the batched DOM writes-then-reads. It is the only DOM-touching piece; the packing/positioning stays pure by receiving the resulting widths as input.

```typescript
interface MeasureConfig {
  texts: string[]; // issue labels to measure (shortVersion || summary)
  isLotsOfIssues: boolean; // affects font size / class
}

// Batches all appends before any reads → single layout flush (Option A).
// Returns text → measured width (px), including the +3px margin convention.
export const measureTextWidths = (config: MeasureConfig): Map<string, number> => {
  const container = document.createElement('div');
  // Off-screen, but still laid out so measurement is accurate.
  Object.assign(container.style, {
    position: 'absolute',
    visibility: 'hidden',
    left: '-9999px',
    top: '0',
    whiteSpace: 'nowrap',
  });

  const textClass = config.isLotsOfIssues ? 'text-xs' : '';
  const uniqueTexts = [...new Set(config.texts)];

  // 1. WRITES ONLY — build all elements and append to the container.
  const elements = uniqueTexts.map((text) => {
    const el = document.createElement('div');
    el.className = `truncate ${textClass} px-0.5 py-0.5`.trim();
    el.textContent = text;
    container.appendChild(el);
    return { text, el };
  });

  // 2. ONE ATTACH — single insertion into the document.
  document.body.appendChild(container);

  // 3. READS ONLY — measure every element (layout flushes once).
  const widths = new Map<string, number>();
  for (const { text, el } of elements) {
    widths.set(text, el.getBoundingClientRect().width + 3); // +3px margin
  }

  // 4. CLEANUP.
  document.body.removeChild(container);
  return widths;
};
```

### React Hook: `useMeasuredTextWidths` (Option C caching + Option A pass)

The hook runs the batched measurement in a `useLayoutEffect` (after DOM layout, before paint) and caches the result, re-measuring only when the label set or font/density changes.

```typescript
interface TextWidthMeasurements {
  widthsByText: Map<string, number>; // text → width in pixels
  isMeasured: boolean;
}

export const useMeasuredTextWidths = (config: MeasureConfig): TextWidthMeasurements => {
  const [widthsByText, setWidthsByText] = useState<Map<string, number>>(new Map());
  const [isMeasured, setIsMeasured] = useState(false);

  // Stable cache key so we only re-measure when labels or density change.
  const cacheKey = useMemo(
    () => `${config.isLotsOfIssues}|${config.texts.join('\u0000')}`,
    [config.texts, config.isLotsOfIssues],
  );

  useLayoutEffect(() => {
    setWidthsByText(measureTextWidths(config));
    setIsMeasured(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return { widthsByText, isMeasured };
};
```

**Why this approach?**

- **True measured widths** — accurate for proportional fonts (no estimation).
- **Single reflow** — batched writes-then-reads (Option A) instead of O(n) forced reflows.
- **Cached** — re-measure only when labels/density change (Option C).
- **Testable** — `measureTextWidths` is a small, isolated function; the pure positioning/packing functions receive widths as input and can be tested with a plain `Map`. In jsdom, `getBoundingClientRect().width` is `0`, so mock `measureTextWidths` (or the hook) in component tests and inject known widths.

**Measurement not ready**: On the first render `isMeasured` is `false` and `widthsByText` is empty. The container should render nothing (or a skeleton) until measurement completes, then compute rows — mirroring the CanJS behavior where `rows` is `[]` until `visibleWidth` is known.

**Usage in component**:

```typescript
const issueTexts = filteredIssues.map((i) => i.names?.shortVersion || i.summary);
const { widthsByText, isMeasured } = useMeasuredTextWidths({ texts: issueTexts, isLotsOfIssues });

const plottedIssues = isMeasured
  ? filteredIssues.map((issue) => {
      const label = issue.names?.shortVersion || issue.summary;
      const textWidth = widthsByText.get(label) ?? 0;
      const positions = calculatePositionPercentages({
        roundedDueDate: roundAndShiftDueDate(issue.rollupStatuses.rollup.due, roundTo),
        textWidth,
        widthOfArea: containerWidth,
        firstDay,
        lastDay,
      });
      return { ...issue, ...positions };
    })
  : [];
```

---

## 4. React Component Architecture

### Component Tree

```
<ScatterTimeline> (FC container)
  ├─ Layout: Grid container + headers
  ├─ <QuarterAndMonthHeaders> (presentational)
  ├─ <TodayLine> (presentational)
  ├─ <GridLines> (presentational)
  ├─ <IssueRowsContainer>
  │  └─ {rows.map(row => <Row key={rowId}>
  │       {row.items.map(item => <IssueMarker key={item.key} />)}
  │     </Row>)}
  └─ Suspense/ErrorBoundary wrapper (from timeline-report.js)
```

### `ScatterTimeline` (Main Container)

```typescript
interface ScatterTimelineProps {
  // Individual `*Obs` props per the repo pattern (see FlowMetrics.tsx). Each is read with
  // its own useCanObservable — no bundled `routeData` observable (plan §Questions #5).
  primaryIssuesOrReleasesObs: CanObservable<IssueOrRelease[]>;
  allIssuesOrReleasesObs: CanObservable<IssueOrRelease[]>; // unused; kept for base-prop parity
  roundToObs: CanObservable<string>;                       // routeData.roundTo
  // NOTE: no primaryReportBreakdownObs — density is `length > 20` only (plan §Questions #4).
}

export const ScatterTimeline: React.FC<ScatterTimelineProps> = (props) => {
  // Subscribe to observables
  const issues = useCanObservable(props.primaryIssuesOrReleasesObs);
  const roundTo = useCanObservable(props.roundToObs);

  // Container width
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    setContainerWidth(containerRef.current.offsetWidth);

    const handleResize = () => {
      setContainerWidth(containerRef.current?.offsetWidth ?? 0);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Computed data (pure functions)
  const isLotsOfIssues = shouldUseDensityOptimizations(issues.length);
  // Date range: reuse the legacy mergeStartAndDueData + now±30d fallback via a pure helper.
  // Do NOT use Math.min/Math.max over issues — that returns Infinity → Invalid Date when
  // the list is empty or all due dates are missing (plan §Questions #3, Edge Case #1).
  const { firstEndDate, endDate } = computeDateRange(issues); // pure; see below
  const quartersAndMonths = computeQuartersAndMonths(firstEndDate, endDate);
  const gridColumnsCSS = computeGridColumnCSS(quartersAndMonths.months);
  const todayMargin = calculateTodayMargin(new Date(), quartersAndMonths.firstDay, quartersAndMonths.lastDay);

  // Measure text widths
  // Measure text widths (batched DOM measurement, cached — see section 3)
  const filteredIssues = filterIssuesWithDates(issues);
  const issueTexts = filteredIssues.map(i => i.names?.shortVersion || i.summary);
  const { widthsByText, isMeasured } = useMeasuredTextWidths({ texts: issueTexts, isLotsOfIssues });

  // Compute positions and pack into rows (only once widths are measured)
  const plottedIssues = isMeasured
    ? filteredIssues.map(issue => {
        const label = issue.names?.shortVersion || issue.summary;
        const textWidth = widthsByText.get(label) ?? 0;
        const positions = calculatePositionPercentages({
          roundedDueDate: roundAndShiftDueDate(issue.rollupStatuses.rollup.due, roundTo),
          textWidth,
          widthOfArea: containerWidth || 1230, // default width
          firstDay: quartersAndMonths.firstDay,
          lastDay: quartersAndMonths.lastDay,
        });
        return {
          key: issue.key,
          issue,
          ...positions,
          // Flip the label to the right of the marker when it would clip off the left edge
          // (plan §Questions → Off-left-edge overflow). The marker stays on the due date.
          overflowsLeft: positions.leftPercentStart < 0,
          statusColorClass: getStatusColorClass(issue.rollupStatuses.rollup.status),
          textSize: isLotsOfIssues ? 'text-xs' : '',
          markerRadius: isLotsOfIssues ? 6 : 8,
        };
      })
    : [];

  const sortedIssues = sortIssuesByLeftPosition(plottedIssues);
  const rows = packIssuesIntoRows(sortedIssues);

  return (
    <div ref={containerRef} className="p-2 mb-10 overflow-x-auto">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridColumnsCSS,
          gridTemplateRows: `auto auto repeat(${rows.length}, auto)`,
        }}
        className="gap-0"
      >
        {/* Quarter headers */}
        {quartersAndMonths.quarters.map(q => (
          <div key={q.name} style={{ gridColumn: 'span 3' }} className="text-center font-semibold">
            {q.name}
          </div>
        ))}

        {/* Month headers */}
        {quartersAndMonths.months.map((m, idx) => (
          <div key={idx} className="border-b border-neutral-80 text-center text-sm">
            {m.name}
          </div>
        ))}

        {/* Today line */}
        <div
          style={{
            gridColumn: `1 / span ${quartersAndMonths.months.length}`,
            gridRow: `2 / span ${rows.length + 1}`,
          }}
          className="relative z-0"
        >
          <div
            style={{
              position: 'absolute',
              left: `${todayMargin}%`,
              height: '100%',
              width: '1px',
              backgroundColor: 'orange',
              zIndex: 0,
            }}
          />
        </div>

        {/* Vertical grid lines */}
        {quartersAndMonths.months.map((m, idx) => (
          <div
            key={`grid-${idx}`}
            style={{
              gridColumn: `${idx + 1} / span 1`,
              gridRow: `3 / span ${rows.length}`,
            }}
            className={`border-l border-b border-neutral-80 ${
              idx === quartersAndMonths.months.length - 1 ? 'border-r' : ''
            }`}
          />
        ))}

        {/* Issue rows */}
        {rows.map((row, rowIdx) => (
          <div
            key={rowIdx}
            style={{
              gridColumn: `1 / span ${quartersAndMonths.months.length}`,
              gridRow: `${rowIdx + 3} / span 1`,
            }}
            className={`relative ${isLotsOfIssues ? 'h-7' : 'h-10'}`}
          >
            {row.items.map(item => (
              <IssueMarker
                key={item.key}
                item={item}
                markerRadius={item.markerRadius}
                textSize={item.textSize}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
```

### `IssueMarker` (Presentational)

```typescript
interface IssueMarkerProps {
  item: PlottedIssue & { statusColorClass: string; textSize: string; markerRadius: number };
  markerRadius: number;
  textSize: string;
}

export const IssueMarker: React.FC<IssueMarkerProps> = ({ item, markerRadius, textSize }) => {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div
      style={{
        position: 'absolute',
        right: `${item.endPercentFromRight}%`,
        top: '4px',
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
        zIndex: 100,
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Text label */}
      <div
        className={`truncate ${textSize} bg-neutral-41 rounded px-0.5 py-0.5`}
        style={{
          maxWidth: item.widthInPercent > 30 ? '300px' : '260px',
          paddingLeft: `${markerRadius}px`,
          paddingRight: `${markerRadius * 1.5}px`,
        }}
        title={item.issue.names?.shortVersion || item.issue.summary}
      >
        {item.issue.names?.shortVersion || item.issue.summary}
      </div>

      {/* Status marker (circular) */}
      <div
        className={`${item.statusColorClass} rounded-full border border-white flex-shrink-0`}
        style={{
          width: `${markerRadius * 2}px`,
          height: `${markerRadius * 2}px`,
          minWidth: `${markerRadius * 2}px`,
        }}
      />

      {/* Tooltip on hover (optional, future enhancement) */}
      {isHovering && (
        <div className="absolute bottom-full mb-2 bg-neutral-900 text-white text-xs rounded p-2 whitespace-nowrap z-50">
          <div><strong>{item.issue.key}</strong></div>
          <div>{item.issue.status}</div>
          <div>{item.issue.rollupDates.due?.toLocaleDateString()}</div>
        </div>
      )}
    </div>
  );
};
```

---

## 5. Data Types

### Type Definitions

```typescript
// Inputs from parent
interface IssueOrRelease {
  key: string;
  summary: string;
  names?: {
    shortVersion?: string;
    semver?: string;
    name?: string;
  };
  rollupDates: {
    start?: Date;
    due?: Date;
    dueTo?: Date;
  };
  rollupStatuses: {
    rollup: {
      status: string;
      due?: Date;
      start?: Date;
    };
    children?: { issueKeys: string[] };
    [workType: string]: any;
  };
  status?: string;
  team?: { name: string };
  parentKey?: string;
  type?: string;
  reportingHierarchy?: {
    childKeys: string[];
    parentKeys: string[];
    depth: number;
  };
  issueLastPeriod?: any;
}

// RouteData snapshot
interface RouteDataSnapshot {
  roundTo: string; // 'day', 'week', 'month', etc.
  primaryReportBreakdown: boolean;
  compareTo?: number | Date;
  sortByDueDate?: boolean;
}

// Computed intermediate types
interface Month {
  date: Date;
  name: string;
  daysInMonth: number;
  number: number;
  first?: boolean;
  last?: boolean;
}

interface Quarter {
  name: string;
  number: number;
  monthIndices: [number, number, number];
}

interface QuartersAndMonths {
  quarters: Quarter[];
  months: Month[];
  firstDay: Date;
  lastDay: Date;
}

interface Range {
  start: number;
  end: number;
}

interface PositionConfig {
  roundedDueDate: Date;
  textWidth: number;
  widthOfArea: number;
  firstDay: Date;
  lastDay: Date;
}

interface IssuePosition {
  leftPercentStart: number;
  rightPercentEnd: number;
  endPercentFromRight: number;
  widthInPercent: number;
}

interface PlottedIssue extends IssuePosition {
  key: string;
  issue: IssueOrRelease;
}

interface Row {
  items: PlottedIssue[];
}

interface TextWidthMeasurements {
  widthsByText: Map<string, number>;
  isMeasured: boolean;
}
```

---

## 6. File/Module Layout

```
src/react/reports/ScatterTimeline/
├── index.ts                          # Barrel export
├── ScatterTimeline.tsx               # Main container component
├── IssueMarker.tsx                   # Presentational component for issue markers
├── ScatterTimeline.test.tsx          # Component tests (rendering, interactions)
├── hooks/
│   ├── useMeasuredTextWidths.ts      # Text width measurement hook
│   ├── useMeasuredTextWidths.test.ts # Hook tests
│   └── index.ts
├── logic/
│   ├── positioning.ts                # Pure functions: positions & percentages
│   ├── positioning.test.ts
│   ├── collision.ts                  # Pure functions: collision detection, packing
│   ├── collision.test.ts
│   ├── calendar.ts                   # Pure functions: quarters, months, grid CSS
│   ├── calendar.test.ts
│   ├── status.ts                     # Pure functions: status → color mapping
│   ├── status.test.ts
│   ├── density.ts                    # Pure functions: optimization decision
│   ├── density.test.ts
│   └── index.ts                      # Barrel export
├── types.ts                          # Shared TypeScript interfaces
└── README.md                         # Component documentation
```

**Each pure logic file should be small and focused:**

- `positioning.ts`: `calculatePositionPercentages`, `roundAndShiftDueDate`, `calculateTodayMargin`, `computeGridColumnCSS`
- `collision.ts`: `intersect`, `packIssuesIntoRows`, `sortIssuesByLeftPosition`, `filterIssuesWithDates`
- `calendar.ts`: `computeQuartersAndMonths`
- `status.ts`: `getStatusColorClass`
- `density.ts`: `shouldUseDensityOptimizations`

---

## 7. Testing Strategy

### Unit Tests (Pure Functions)

**Location**: Colocated with logic files (`*.test.ts`)

**Approach**: Exhaustive test coverage with realistic data

**Example test file structure** (`positioning.test.ts`):

```typescript
import { describe, test, expect } from 'vitest';
import {
  calculatePositionPercentages,
  roundAndShiftDueDate,
  calculateTodayMargin,
  computeGridColumnCSS,
} from './positioning';

describe('positioning', () => {
  // ... tests (see section 2.3 for examples)
});
```

**Coverage targets**:

- Happy path: basic calculations
- Edge cases: dates at boundaries, zero width, very large areas
- Rounding: ensure tie-breaking is consistent
- Error handling: invalid inputs gracefully return defaults

### Component Tests (React)

**Location**: Colocated with component (`ScatterTimeline.test.tsx`)

**Approach**:

- Mock CanJS observables with test data
- Render with Suspense/ErrorBoundary
- Assert UI structure (grid headers, rows, markers)
- Verify CSS classes and positioning attributes
- Test hover/interaction state changes

**Example**:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { ScatterTimeline } from './ScatterTimeline';

describe('ScatterTimeline', () => {
  test('renders quarter and month headers', () => {
    const mockIssues = [
      { key: 'A-1', rollupDates: { due: new Date('2025-02-15') }, ... }
    ];
    const mockObservable = { value: mockIssues, on: vi.fn(), off: vi.fn() };

    render(
      <Suspense fallback="loading">
        <ScatterTimeline primaryIssuesOrReleases={mockObservable} ... />
      </Suspense>
    );

    expect(screen.getByText('Q1')).toBeInTheDocument();
    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('Feb')).toBeInTheDocument();
  });

  test('renders issue markers', () => {
    // ...
    expect(screen.getByText(/issue-summary/)).toBeInTheDocument();
  });

  test('handles hover state', async () => {
    // ...
    const marker = screen.getByRole('...');
    await userEvent.hover(marker);
    expect(screen.getByRole('tooltip')).toBeVisible();
  });
});
```

### E2E Tests (Playwright)

**Location**: `playwright/authenticated/scatter-timeline.spec.ts` (new file)

**Coverage**:

- Navigate to scatter timeline report
- Verify data loads (check grid is populated)
- Interact: hover over marker, check tooltip
- Resize window, verify reflow
- Change roundTo/breakdown settings via URL params, verify re-render

---

## 8. Migration / Integration Plan

### Phase 1: Build & Test Pure Functions (No Changes to Existing Code)

1. Create `src/react/reports/ScatterTimeline/logic/` directory with pure functions
2. Write exhaustive unit tests (see section 7)
3. Verify all logic matches current CanJS behavior via test cases
4. No changes to `src/canjs/reports/scatter-timeline.js` yet

**Deliverables**: All `.test.ts` files pass, >95% coverage of logic

### Phase 2: Build React Components

1. Create `src/react/reports/ScatterTimeline/ScatterTimeline.tsx`
2. Create `src/react/reports/ScatterTimeline/hooks/useMeasuredTextWidths.ts`
3. Create `src/react/reports/ScatterTimeline/IssueMarker.tsx`
4. Write component tests (see section 7)
5. **Do NOT wire into `timeline-report.js` yet**

**Deliverables**: Component tests pass, component renders with test data

### Phase 3: Feature Flag & Conditional Mount

1. Add feature flag entry in `src/configuration/reports.ts` if not already present:

   ```typescript
   {
     key: 'due',
     name: 'Scatter Plot',
     featureFlag: 'scatterPlotReact', // NEW flag to distinguish React version
     onByDefault: false, // start disabled
   }
   ```

2. Modify `src/timeline-report.js` to conditionally mount React version:

   ```
   {{# eq(this.routeData.primaryReportType, "due") }}
     {{# if(this.isReactScatterPlot()) }}
       <div id='scatter-timeline-react'
         on:inserted='this.attachScatterTimeline()'
         on:removed='this.detachScatterTimeline()'></div>
     {{else}}
       <scatter-timeline
         primaryIssuesOrReleases:from="this.primaryIssuesOrReleases"
         allIssuesOrReleases:from="this.rolledupAndRolledBackIssuesAndReleases"></scatter-timeline>
     {{/if}}
   {{/ eq }}
   ```

3. Add mount logic in `TimelineReport`:

   ```typescript
   attachScatterTimeline() {
     const container = document.getElementById('scatter-timeline-react');
     const root = createRoot(container);
     root.render(
       <Suspense fallback={<div>Loading...</div>}>
         <ErrorBoundary>
           <QueryClientProvider client={queryClient}>
             <ScatterTimeline
               primaryIssuesOrReleases={this.primaryIssuesOrReleases}
               allIssuesOrReleases={this.rolledupAndRolledBackIssuesAndReleases}
             />
           </QueryClientProvider>
         </ErrorBoundary>
       </Suspense>
     );
   }

   detachScatterTimeline() {
     // cleanup
   }

   isReactScatterPlot() {
     return this.routeData.primaryReportType === 'due' && window.featureFlags?.scatterPlotReact;
   }
   ```

**Deliverables**: Both CanJS and React versions render side-by-side (feature-gated)

### Phase 4: Validation & Testing

1. Run unit tests for all pure functions
2. Run component tests for React components
3. Run E2E tests (Playwright) for both versions
4. Manual QA: compare visual output, interactions, edge cases (no issues with due dates, many issues, etc.)
5. Performance profiling: measure render time, re-render frequency

**Deliverables**: All tests pass, no visual/functional regressions

### Phase 5: Migrate Default & Cleanup

1. Switch feature flag default: `scatterPlotReact: true`
2. Remove feature flag check (all users on React)
3. Delete `src/canjs/reports/scatter-timeline.js`
4. Remove CanJS mount from `timeline-report.js`
5. Update documentation

**Deliverables**: React version is default, CanJS version removed

### Feature Flag Usage (Development)

**Enable React version in browser console**:

```javascript
window.featureFlags.scatterPlotReact = true;
```

**Disable React version (fall back to CanJS)**:

```javascript
window.featureFlags.scatterPlotReact = false;
```

---

## 9. Open Questions & Future Enhancements

### From Behavior Spec (Unresolved)

1. **Breakdown Mode Integration**:

   - How is `this.breakdown` passed to scatter-timeline? Currently undefined in props.
   - **Design choice**: Receive as prop from parent, read via `useCanObservable` if observable

2. **Incomplete `miroData()` Function**:

   - Is this debug code or a feature? No export mechanism currently.
   - **Design choice**: Move to a separate service/utility if needed; not prioritized for React version

3. **Row Packing Optimality**:
   - Greedy first-fit algorithm may not minimize rows in all cases.
   - **Design choice**: Keep current algorithm (fast, simple); can optimize later with interval scheduling if needed

### New Questions for React Implementation

4. **Historical Comparison Visualization**:

   - Behavior spec mentions `issueLastPeriod` data but scatter-timeline doesn't use it.
   - Should React version show dual dates for "compare to" baseline?
   - **Decision pending**: Clarify with product owner

5. **Tooltip/Hover Content**:

   - Current CanJS has no tooltip. Should React version add one?
   - Proposed: Show `key`, `status`, `due date`, `duration` on hover
   - **Decision pending**: Confirm scope

6. **Interaction Points**:

   - Click to drill down or navigate to Jira?
   - Right-click context menu?
   - **Decision pending**: Define interaction model

7. **Accessibility**:

   - ARIA labels for markers and grid?
   - Keyboard navigation (Tab, arrow keys)?
   - **Decision pending**: Define a11y requirements

8. **Performance with Hundreds of Issues**:

   - Original per-issue clone-and-measure caused **layout thrashing** (O(n) forced reflows)
   - **Resolved**: batched DOM measurement (Option A) writes all elements first, then reads once — single reflow; results are cached (Option C). See [measurement-batching.md](spec/003-scatter-timeline-rewrite/measurement-batching.md)
   - May need virtualization for very large lists (future)
   - **Decision pending**: Performance targets and constraints

9. **Scrolling & Overflow**:

   - No horizontal scrolling in current design; assumes container is wide enough
   - Should React version add scroll handling?
   - **Decision pending**: UX spec for narrow viewports

10. **Status Color Maintenance**:
    - Color classes defined in `src/css/colors.css`
    - Ensure all statuses from `work-status.ts` have corresponding CSS classes
    - **Action**: Verify color definitions before component launch

---

## Migration Checklist

- [ ] All pure function unit tests written and passing
- [ ] All pure function tests have >95% coverage
- [ ] React component tests written
- [ ] Component renders correctly with test data
- [ ] Feature flag added to `src/configuration/reports.ts`
- [ ] Conditional mount logic added to `timeline-report.js`
- [ ] Side-by-side testing passes (CanJS and React)
- [ ] E2E tests written and passing
- [ ] Visual regression testing completed
- [ ] Performance profiling shows acceptable render times
- [ ] Accessibility audit completed (if required)
- [ ] Documentation updated
- [ ] CanJS version cleaned up/deleted
- [ ] Feature flag defaults switched to React
- [ ] Product owner sign-off on feature completeness

---

## References

**Existing Code**:

- [Current CanJS Implementation](src/canjs/reports/scatter-timeline.js)
- [Behavior Specification](spec/003-scatter-timeline-rewrite/behavior.md)
- [React Report Examples](src/react/reports/FlowMetrics/FlowMetrics.tsx)
- [useCanObservable Hook](src/react/hooks/useCanObservable/)
- [Status Color CSS](src/css/colors.css)
- [Date Utilities](src/utils/date/)
- [RouteData Configuration](src/canjs/routing/route-data/route-data.js)

**Patterns to Follow**:

- [Service Layer Pattern](src/react/services/)
- Testing Conventions — colocated `*.test.ts` under `src/jira/`
- [Component Structure](src/react/reports/FlowMetrics/)

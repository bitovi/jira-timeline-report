# Scatter Timeline Report — Behavior Specification

## Overview

The Scatter Timeline is a CanJS-based timeline visualization report that plots issues and releases on a two-dimensional timeline. The primary axis (horizontal) represents **dates** (quarters and months), and the vertical axis represents **issue lanes** (rows arranged to avoid overlapping). Each issue is rendered as a named element with a status-colored circular marker, positioned at its due date. The report visualizes schedule status, delivery timelines, and relative timing across a portfolio of work.

**Key purpose**: Allow users to see at a glance which issues are due when, with visual indicators of their status (on-track, behind, blocked, complete, warning, etc.).

**Report key**: `'due'` (wired as primary report type when `primaryReportType === 'due'`)
**Feature flag**: `scatterPlot` (enabled by default)
**Registration**: [src/configuration/reports.ts](src/configuration/reports.ts#L10-L14)

---

## Visual Layout

### Overall Structure

The report uses **CSS Grid** with:

- **Row 1**: Quarter headers (e.g., "Q1", "Q2") spanning 3 months each
- **Row 2**: Month headers (e.g., "Jan", "Feb", "Mar") with month-specific column widths
- **Row 3+**: Issue rows, each with variable height depending on density
- **Background elements**:
  - Orange vertical line marking "today" (current date)
  - Vertical grid lines separating months
  - Border lines for grid structure

### Issue Element Structure

Each issue is rendered as a flex container with:

1. **Text label** (left-aligned, truncated):

   - Content: `release?.names?.shortVersion || release.summary`
   - Background: neutral-41 (light gray)
   - Font size: `text-xs` or default (scales with `lotsOfIssues` flag)
   - Max-width: 260px (many issues) or 300px (few issues)
   - Padding: `px-0.5` horizontally, 2px vertically
   - Border-radius: rounded corners

2. **Status marker** (right-aligned, circular):
   - Position: absolute, right-aligned
   - Size: diameter = `radius * 2` pixels (radius = 6 or 8)
   - Color: dynamically set via `color-text-and-bg-{status}` CSS class
   - Border: white, 1px solid
   - Centered vertically within row (top: 50%, margin-top: -radius)

### Grid Column Widths

Columns are sized proportionally to the **number of days in each month**:

```
gridColumnsCSS = month1.daysInMonth + 'fr ' + month2.daysInMonth + 'fr ' + ...
```

This ensures accurate date positioning (e.g., February gets 28–29 `fr`, March gets 31 `fr`).

### Row Heights

- **Many issues** (`lotsOfIssues = true`): `h-7` (28px) per row
- **Few issues** (`lotsOfIssues = false`): `h-10` (40px) per row
- Threshold: `primaryIssuesOrReleases.length > 20` && no breakdown mode

### "Today" Indicator

- Thin orange vertical line (`background-color: orange`)
- Position: left margin = `todayMarginLeft` percentage
- Calculation:
  ```javascript
  todayMarginLeft = ((new Date() - firstDay - 2 days) / totalTime) * 100
  ```
  (2-day offset appears to be for visual centering)

---

## Inputs & Data Sources

### Props (Received from Parent)

**[src/timeline-report.js](src/timeline-report.js#L73-L76)**:

```html
<scatter-timeline
  primaryIssuesOrReleases:from="this.primaryIssuesOrReleases"
  allIssuesOrReleases:from="this.rolledupAndRolledBackIssuesAndReleases"
></scatter-timeline>
```

1. **`primaryIssuesOrReleases`** (Array):

   - Filtered, rolled-up issues/releases at the primary hierarchy level
   - Source: [timeline-report.js get primaryIssuesOrReleases](src/timeline-report.js#L411-L487)
   - Structure: Each item has `rollupDates`, `rollupStatuses`, `summary`, `names`, etc.
   - Pre-filtered by:
     - Planning statuses
     - Release selections
     - Semantic version filter (if enabled)
     - Status inclusion/exclusion (statusesToShow, statusesToRemove)
     - Unknown initiatives filter (hideUnknownInitiatives)
   - Optionally sorted by due date if `routeData.sortByDueDate` is true

2. **`allIssuesOrReleases`** (Array):
   - All rolled-up and rolled-back data across all hierarchy levels
   - Used for hierarchy lookups (finding children via `makeGetChildrenFromReportingIssues`)
   - Source: [timeline-report.js get rolledupAndRolledBackIssuesAndReleases](src/timeline-report.js#L364-L378)
   - Includes rolled-up data from previous periods (for "compare to" baseline)

### Data Structures

**Issue/Release object** (simplified):

```typescript
{
  key: string;                          // Jira issue key (e.g., "PROJ-123")
  summary: string;                      // Issue title
  names: {
    shortVersion?: string;              // Release short name (e.g., "1.2.0")
    semver?: string;                    // Semantic version (if Release)
    name?: string;                      // Full name
  };
  rollupDates: {
    start?: Date;                       // Start date (rolled up from children or own data)
    startFrom?: Date;                   // Start range marker
    due?: Date;                         // Due date (critical for positioning)
    dueTo?: Date;                       // Due range marker
  };
  rollupStatuses: {
    rollup: {
      status: string;                   // Rollup status (complete|ontrack|behind|warning|blocked|unknown|notstarted|ahead|new)
      due?: Date;                       // Due date at rollup level
      start?: Date;                     // Start date at rollup level
    };
    children?: { issueKeys: string[] }; // Work type rollups (design, dev, qa, uat, etc.)
    [workType]?: { ... };              // e.g., design, dev, qa, uat statuses
  };
  status?: string;                      // Issue status
  team?: { name: string };              // Team assignment
  parentKey?: string;                   // Parent issue key
  type?: string;                        // Issue type (Release, Epic, Story, etc.)
  reportingHierarchy?: {                // Reporting hierarchy metadata
    childKeys: string[];
    parentKeys: string[];
    depth: number;
  };
  issueLastPeriod?: {...};              // Previous period data (for "compare to")
}
```

### RouteData Observables

The component reads these from [route-data.js](src/canjs/routing/route-data/route-data.js):

- **`roundTo`** (string): How to round date endpoints. Default: `'day'`. Options: `'day'`, plus keys from [src/utils/date/round.js](src/utils/date/round.js). Affects positioning math.
- **`compareTo`** (number or Date): Baseline for comparison (historical data). Default: 15 days ago. Used when displaying previous period data.
- **`primaryReportBreakdown`** (boolean): If true, disables the `lotsOfIssues` optimization (keeps text larger even with many items).
- **`statusesToExclude`** (Array<string>): Statuses to filter out before rendering. Filtering happens in timeline-report, not scatter-timeline.

---

## Data Transformations

### Step 1: Filter Issues with Due Dates

```javascript
const issuesWithDates = this.primaryIssuesOrReleases.filter((issue) => issue.rollupDates.due);
```

Issues without a `due` date are not plotted (edge case handled).

> **Rewrite decision (plan §Questions #2):** The legacy code filters on `rollupDates.due`
> but _positions_ using `rollupStatuses.rollup.due`. The React rewrite standardizes on
> **`rollupStatuses.rollup.due`** for both the filter and the positioning math, so every
> plotted issue is guaranteed to have a non-null positioning date. See
> `filterIssuesWithDates` in logic.md §2.7.

### Step 2: Calculate Time Boundaries

**`quartersAndMonths` getter** ([lines 66–81](src/canjs/reports/scatter-timeline.js#L66-L81)):

1. Extract all `due` dates and optional `dueTo` range markers from `primaryIssuesOrReleases`
2. Merge them using `mergeStartAndDueData()` to find the earliest start and latest due date
3. Expand the range: `firstEndDate = (start || now) - 30 days`
4. Call `getQuartersAndMonths(firstEndDate, due || now + 30 days)` to compute:
   - `quartersAndMonths.firstDay` (start of first quarter)
   - `quartersAndMonths.lastDay` (end of last quarter)
   - `quartersAndMonths.months` (array of month objects with `date`, `name`, etc.)
   - `quartersAndMonths.quarters` (array of quarter headers)
5. Set `gridColumnsCSS` by mapping days in each month to flex fractions

### Step 3: Measure and Position Each Issue

**`calculate()` function** ([lines 227–287](src/canjs/reports/scatter-timeline.js#L227-L287)):

For each issue, compute:

```javascript
// 1. Round the due date
const roundedDueDate = oneDayLater(roundDateByRoundToParam.end(issue.rollupStatuses.rollup.due));
// - roundDateByRoundToParam.end() applies rounding based on routeData.roundTo
// - oneDayLater() adds 1 day (convention for due dates: display them as "due at end of day")

// 2. Measure text width
const element = makeElementForIssue(issue); // Creates DOM element
const width = getWidth(element) + 3; // Measure or clone into DOM, add 3px margin
const widthInPercent = (width * 100) / widthOfArea;

// 3. Calculate date-based positions (percentages)
const totalTime = lastDay - firstDay; // Total milliseconds
const rightPercentEnd = ((roundedDueDate - firstDay) / totalTime) * 100; // Right edge of issue
const endPercentFromRight = ((totalTime - (roundedDueDate - firstDay)) / totalTime) * 100; // Distance from right
const leftPercentStart = rightPercentEnd - widthInPercent; // Left edge of issue

// 4. Store metadata on element
element.setAttribute('measured-width', width);
element.setAttribute('width-p', widthInPercent);
element.setAttribute('left-p', leftPercentStart);
element.setAttribute('right-p', rightPercentEnd);
```

### Step 4: Sort by Left Position

```javascript
issueUIData.sort((a, b) => a.leftPercentStart - b.leftPercentStart);
```

Ensures earliest issues are processed first, improving row packing.

### Step 5: Collision Detection & Row Assignment

**`addToRow()` function** ([lines 273–283](src/canjs/reports/scatter-timeline.js#L273-L283)):

For each issue (in left-to-right order):

1. Try to fit in existing rows:
   - For each row, check if any existing item overlaps with the new issue
   - Use `intersect(range1, range2)` to test: `range1.start < range2.end && range2.start < range1.end`
   - If no overlap, add issue to this row and return
2. If no compatible row found, create a new row and add the issue

This greedy algorithm minimizes the number of rows while maintaining non-overlapping layout.

### Step 6: Finalize Positioning

```javascript
for (let row of rows) {
  for (let item of row.items) {
    item.element.style.right = item.endPercentFromRight + '%';
  }
}
```

Set the CSS `right` property so each issue is positioned by its right edge (due date).

---

## Interactions

### Current Implementation

The scatter timeline is a **read-only** visualization. The code has:

1. **`miroData()` method** (unused/incomplete):

   - [Lines 193–222](src/canjs/reports/scatter-timeline.js#L193-L222)
   - Appears to be debug code for exporting data to Miro
   - Not called anywhere; no interaction endpoint

2. **No explicit hover/tooltip handlers** in scatter-timeline.js itself

3. **Future interaction model** (not implemented in CanJS version):
   - Gantt Grid ([src/canjs/reports/gantt-grid.js](src/canjs/reports/gantt-grid.js)) has more sophisticated interactions:
     - Hover tooltips showing dates and business days ([lines 285–310](src/canjs/reports/gantt-grid.js#L285-L310))
     - Status indicators and child counts
   - React-based reports (newer) likely have click handlers for drill-down

### Suggested Interaction Points for React Rewrite

- **Hover**: Show tooltip with issue key, status, due date, duration
- **Click**: Navigate to issue in Jira or drill down to show children
- **Right-click/context menu**: Copy link, assign, change status, etc.

---

## Configuration & Feature Flags

### Feature Flag

**Registration**: [src/configuration/reports.ts](src/configuration/reports.ts#L10-L14)

```typescript
{
  key: 'due',
  name: 'Scatter Plot',
  featureSubtitle: '',
  featureFlag: 'scatterPlot',
  onByDefault: true,
}
```

- **Enabled by default** (`onByDefault: true`)
- Flag can be toggled in development via `localStorage` ([src/shared/feature-flag.js](src/shared/feature-flag.js))
  - Browser console: `window.featureFlags.scatterPlot = true/false`

### Configuration Options Affecting Behavior

1. **`roundTo`** (RouteData, URL param):

   - How to round date boundaries (day, week, month, etc.)
   - Controls precision of date positioning
   - Default: `'day'`
   - Impacts: `roundDateByRoundToParam.end()` in positioning math

2. **`hideUnknownInitiatives`** (RouteData, URL param):

   - Filter out issues where `start >= due` (invalid date ranges)
   - Applied in timeline-report, filters `primaryIssuesOrReleases` before passing to scatter-timeline

3. **`statusesToShow` / `statusesToRemove`** (RouteData, URL params):

   - Include/exclude issues by status
   - Applied in timeline-report, not in scatter-timeline

4. **`sortByDueDate`** (RouteData, URL param):

   - Sort primary issues by `due` date (ascending)
   - Applied in timeline-report, not in scatter-timeline

5. **`compareTo`** (RouteData, URL param):

   - Historical baseline for "compare to" visualization
   - Not directly used in scatter-timeline (no visual comparison in this report)
   - May be used for status calculations if data includes prior periods

6. **`primaryReportBreakdown`** (RouteData, URL param):
   - When true, disables row-height optimization (keeps text size consistent)
   - Affects: `lotsOfIssues` flag, text sizing, row height

---

## Edge Cases & Special Handling

### 1. No Issues or Empty Data

- If `primaryIssuesOrReleases.length === 0`:
  - `quartersAndMonths` computes a default range (now ± 30 days)
  - Render empty grid with headers and today line
  - No errors

### 2. Issues Without Due Dates

- Filtered out: `issuesWithDates = primaryIssuesOrReleases.filter(issue => issue.rollupDates.due)`
- These issues do not appear on the scatter timeline
- No validation error; they are silently omitted

### 3. Issues with Invalid Date Ranges

- If `roundedDueDate` is before `firstDay` (very old due date):
  - Results in negative or zero `leftPercentStart`
  - **Legacy behavior**: the element is anchored by its right edge and the label grows
    leftward, so a negative `leftPercentStart` clips the label off the **left** edge of the
    chart (a real, observed bug).
  - **Rewrite behavior (plan §Questions → Off-left-edge overflow):** when
    `leftPercentStart < 0` (`overflowsLeft`), the label flips to the **right** of the status
    marker so it stays in view. The marker itself remains on the correct due date. This is
    implemented via an `overflowsLeft` flag from the pure positioning layer and a
    `labelSide: 'left' | 'right'` prop on `IssueMarker`.
- If `roundedDueDate` is after `lastDay`:
  - Results in large `rightPercentEnd` (>100%)
  - Element extends beyond grid bounds

### 4. Overlapping Issues

- Collision detection ensures **no visual overlap** of issue rectangles
- Row assignment is greedy (first-fit algorithm)
- May result in many rows if many issues have similar due dates
- Performance: O(n) row assignment for n issues, O(n²) in worst case for collision checks

### 5. Wide Elements (Text + Marker)

- Minimum space needed: measured text width + marker size (~16px) + margins
- If `widthOfArea` is very narrow, elements can exceed row width
- No horizontal scrolling or overflow handling; assumes sufficient container width

### 6. Very Many Issues (`lotsOfIssues = true`)

- Reduces text size to `text-xs` (smaller font)
- Reduces marker radius to 6 (vs 8 for few issues)
- Reduces row height to `h-7` (28px vs 40px)
- Max text width capped at 260px (vs 300px)
- Optimizations prevent layout explosion but readability may suffer

### 7. `visibleWidth` Not Ready

- If component renders before `offsetWidth` is available:
  - `rows` getter returns `[]` (empty)
  - Component awaits `isElementConnected` and `resize` events
  - Once width is known, rows are computed and rendered
  - No loading state displayed; grid is initially blank

### 8. Rounded Dates at Month/Quarter Boundaries

- Rounding can shift due dates slightly (e.g., 2025-01-31 rounded to month-end might stay 31st)
- `oneDayLater()` adds exactly 1 day, which may push into next month
- Positioning is based on the final rounded date, so multi-day rounding shifts are visible

---

## Dependencies

### Libraries & Utilities

1. **CanJS Framework** ([src/can.js](src/can.js)):

   - `StacheElement` — Base class for web component
   - `type`, `ObservableObject` — Observable property system
   - `stache` — Template engine

2. **Date Utilities** ([src/utils/date/](src/utils/date/)):

   - `getQuartersAndMonths()` — Compute quarter/month headers and date ranges
   - `getDaysInMonth()` — Days in a given month (for grid column sizing)
   - `oneDayLater()` — Add 1 day to a date (due date convention)
   - `roundDateByRoundToParam` — Rounding function based on RouteData config

3. **Rollup Utilities** ([src/jira/rollup/rollup.ts](src/jira/rollup/rollup.ts)):

   - `makeGetChildrenFromReportingIssues()` — Factory to look up children in hierarchy
   - Used in `miroData()` function for debug export

4. **Date Merging** ([src/jira/rollup/dates/dates.ts](src/jira/rollup/dates/dates.ts)):
   - `mergeStartAndDueData()` — Combine start/due date arrays to find min/max

### Global State (RouteData)

All accessed via `this.routeData` or imported singleton:

- `routeData.roundTo` — Rounding strategy
- `routeData.primaryReportBreakdown` — Density/size optimization toggle. **Note:** the legacy
  `lotsOfIssues` getter references `this.breakdown`, but that value is never wired to the
  scatter component, so it has **no effect** today. The React rewrite intentionally does not
  consume it (density is `length > 20` only — see plan §Questions #4).
- `routeData.hiddenInitiatives` (inferred) — Pre-filtered in timeline-report
- `routeData.statusesToExclude` (inferred) — Pre-filtered in timeline-report

### DOM & CSS

- CSS Grid layout for positioning
- CSS classes for status colors: `.color-text-and-bg-{status}`
- Defined in [src/css/colors.css](src/css/colors.css#L88-L140):
  - `complete`, `ontrack`, `behind`, `behind-last-period`, `ahead-last-period`
  - `warning`, `warning-last-period`, `blocked`, `blocked-last-period`
  - `unknown`, `notstarted`, `ahead`, `new`
- Tailwind CSS utilities: `h-7`, `h-10`, `text-xs`, `px-0.5`, `rounded`, etc.

### HTML/DOM Manipulation

- `document.createElement()` — Build issue elements programmatically
- `cloneNode()` — Measure element width without rendering
- `getBoundingClientRect()` — Get element dimensions
- `setAttribute()` — Store metadata on DOM elements
- `Object.assign(style, {...})` — Set inline styles

---

## Component Lifecycle

1. **Constructor / Element Definition**:

   - [Line 312](src/canjs/reports/scatter-timeline.js#L312): `customElements.define('scatter-timeline', ScatterTimeline)`
   - Registers the custom element

2. **Attribute Binding** (CanJS):

   - Parent passes `primaryIssuesOrReleases` and `allIssuesOrReleases` as observable properties
   - Component subscribes automatically

3. **`connected()` Lifecycle Hook**:

   - Sets `isElementConnected = true`
   - Triggers `visibleWidth` resolution

4. **Property Getters** (Computed, Re-evaluate on Dependency Change):

   - `quartersAndMonths` → reads `primaryIssuesOrReleases.*.rollupDates`
   - `gridColumnsCSS` → depends on `quartersAndMonths`
   - `todayMarginLeft` → depends on `quartersAndMonths`
   - `lotsOfIssues` → depends on `primaryIssuesOrReleases.length`
   - `textSize` → depends on `lotsOfIssues`
   - `rows` → depends on `primaryIssuesOrReleases`, `visibleWidth`, `quartersAndMonths`

5. **Template Rendering**:

   - Static template iterates over `quartersAndMonths.quarters`, `quartersAndMonths.months`, `rows`
   - Inserts element DOM via `{{{item.element}}}` triple-stache (HTML, not escaped)

6. **Resize Handling**:
   - `visibleWidth` getter listens to `window.resize` event and `isElementConnected` event
   - Triggers `rows` recomputation when width changes

---

## Open Questions & Ambiguities

1. **Missing Breakdown Prop**:

   - `lotsOfIssues` uses `this.breakdown`, but no such prop is defined in `static props`
   - `breakdown` is referenced in gantt-grid, but not passed to scatter-timeline
   - **Need clarification**: How does breakdown mode affect scatter-timeline rendering?

2. **Incomplete `miroData()` Function**:

   - [Lines 193–222](src/canjs/reports/scatter-timeline.js#L193-L222): Code is present but never called
   - No clear integration point or export mechanism
   - **Need clarification**: Is this debug code, or should it be wired to a button?

3. **No Interaction Model**:

   - Current implementation is read-only (no hover, click, drag)
   - Gantt Grid has tooltips and status indicators
   - **Need clarification**: What interactions should scatter-timeline support in React version?

4. **Row Packing Algorithm Optimality**:

   - Greedy first-fit algorithm may not minimize row count in all cases
   - Example: Three issues [10–30%, 25–45%, 50–70%] might pack suboptimally
   - **Need clarification**: Is current packing acceptable, or should it be optimized?

5. **Width Measurement Method**:

   - Default `getWidth()` clones element, appends to DOM off-screen, measures, removes — **once per issue** inside the `calculate()` loop.
   - The real cost is **layout thrashing**: interleaving DOM writes (`appendChild`/`removeChild`) with reads (`getBoundingClientRect()`) forces the browser to flush layout on every iteration — O(n) forced reflows for n issues.
   - **Resolved** (see [measurement-batching.md](spec/003-scatter-timeline-rewrite/measurement-batching.md)): Do **not** estimate widths from character count — proportional fonts make estimation inaccurate (wide vs. narrow glyphs), which would break the packing algorithm. Instead, keep true measurement but **batch** it so layout flushes once:
     - **Option A** — batched DOM measurement: append all elements first (writes), attach the container once, then read all widths (reads), remove the container. Reduces O(n) reflows to a single reflow.
     - **Option B** — Canvas `measureText()`: measure the text label with the actual font, zero DOM/reflow (best when width is text-driven; requires keeping the canvas `font` in sync with CSS).
     - **Option C** (React) — measure once after layout via `useLayoutEffect`/`ResizeObserver` and cache; recompute only when label, font, or container size changes.

6. **CSS Grid Column Width Calculation**:

   - Uses `getDaysInMonth()` to scale columns proportionally
   - Example: 30 days = 30fr, 28 days = 28fr
   - **Verify**: Does `getDaysInMonth(year, month)` handle leap years correctly? (See implementation: yes, it does via `new Date(year, month, 0)`)

7. **Text Truncation**:

   - Element has `truncate` class and `maxWidth`, but no tooltip
   - Long issue names are silently cut off
   - **Need clarification**: Should a tooltip show the full name on hover?

8. **Historical Comparison**:

   - Component receives `issueLastPeriod` data (for "compare to" baseline)
   - Not used in scatter-timeline rendering (unlike gantt-grid, which shows dual dates)
   - **Need clarification**: Should scatter-timeline show historical due dates for comparison?

9. **Marker Position Precision**:

   - Marker is absolutely positioned at `right: {endPercentFromRight}%`
   - With 1px width, sub-pixel positioning may cause alignment issues
   - **Need verification**: Is marker visually centered on the due date column?

10. **Empty Result Handling**:

    - If `primaryIssuesOrReleases` is empty, grid renders with headers but no issues
    - **Need clarification**: Should a "no data" message be shown?

11. **Date Rounding Edge Case**:

    - `roundDateByRoundToParam.end()` depends on `routeData.roundTo`
    - If `routeData.roundTo` is invalid, no fallback is documented
    - **Verify**: What happens if `roundDate[routeData.roundTo]` is undefined?

12. **Z-Index Layering**:
    - Elements have `z-index: 100`, markers have `z-index: 101`
    - Grid elements have `z-index: 10` (columns) and implicit 0 (rows)
    - **Verify**: Are there any stacking context issues with nested grids or overlapping content?

---

## Summary for React Rewrite

### Must Preserve

- Grid-based layout with proportional column sizing (days in month → flex units)
- Collision detection and row packing algorithm
- Date positioning math (rounding, percentage calculation, 1-day convention)
- Status-based color mapping
- "Today" line indicator
- Filtering of issues without due dates

### Can Improve

- Replace per-issue `defaultGetWidth()` with **batched** measurement to eliminate layout thrashing — keep true measured widths (do not estimate). See [measurement-batching.md](spec/003-scatter-timeline-rewrite/measurement-batching.md).
- Add interaction handlers (hover tooltips, click drill-down)
- Implement responsive design (handle very narrow containers)
- Add loading and error states
- Consider optimized row-packing algorithm if many issues cause too many rows
- Display full issue name in tooltip on hover
- Support for displaying historical comparison data (if desired)

### Key Props/Configuration to Accept

- `primaryIssuesOrReleases` (observable array)
- `allIssuesOrReleases` (observable array)
- `roundTo` (string, from RouteData)
- `primaryReportBreakdown` (boolean, from RouteData) — optional, for density control
- `compareTo` (number/Date, from RouteData) — optional, if comparison is supported

### Type Definitions Needed

- `IssueOrRelease<T>` — Generic issue/release object
- `RollupDateData` — Partial<{start, startFrom, due, dueTo}>
- `RollupStatusData` — {status, statusFrom?, lastPeriod?, issueKeys?, ...}
- `WithDateRollup` — {rollupDates: RollupDateData}
- `WithRollupStatus` — {rollupStatuses: {...}}

---

## Files Referenced in This Spec

- [src/canjs/reports/scatter-timeline.js](src/canjs/reports/scatter-timeline.js) — Main component
- [src/timeline-report.js](src/timeline-report.js) — Parent component, data wiring
- [src/configuration/reports.ts](src/configuration/reports.ts) — Report registration
- [src/canjs/routing/route-data/route-data.js](src/canjs/routing/route-data/route-data.js) — Global state (RouteData)
- [src/utils/date/quarters-and-months.js](src/utils/date/quarters-and-months.js) — Quarter/month computation
- [src/utils/date/days-in-month.js](src/utils/date/days-in-month.js) — Days in month helper
- [src/utils/date/date-helpers.js](src/utils/date/date-helpers.js) — `oneDayLater()`, etc.
- [src/canjs/routing/utils/round.ts](src/canjs/routing/utils/round.ts) — Date rounding
- [src/jira/rollup/dates/dates.ts](src/jira/rollup/dates/dates.ts) — Date rollup logic
- [src/jira/rolledup/work-status/work-status.ts](src/jira/rolledup/work-status/work-status.ts) — Status calculation
- [src/css/colors.css](src/css/colors.css) — Status color definitions
- [src/jira/rollup/rollup.ts](src/jira/rollup/rollup.ts) — Hierarchy utilities

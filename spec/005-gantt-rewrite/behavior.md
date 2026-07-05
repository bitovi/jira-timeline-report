# Gantt Chart Report — Behavior Specification

## Overview

The Gantt Chart is a CanJS-based timeline visualization implemented as the `<gantt-grid>`
custom element ([src/canjs/reports/gantt-grid.js](src/canjs/reports/gantt-grid.js#L69)). It
lays out issues/releases as **horizontal bars** across a shared calendar axis (quarters and
months). Each row is one issue (or a grouping header), and each issue's bar spans from its
rolled-up **start** date to its rolled-up **due** date, colored by rollup status. Unlike the
Scatter Plot (which positions a single marker by due date), the Gantt shows **duration** and
supports **hierarchical expand/collapse**, **grouping** (by parent/team/project), a
**"last period" shadow** for schedule-slip comparison, a **per-work-type breakdown** mode
(dev/qa/uat bars), an optional **% complete** column with a drill-down modal, and rich
**tooltips**.

**Report key**: `'start-due'` (rendered when `routeData.primaryReportType === 'start-due'`) —
[src/timeline-report.js](src/timeline-report.js#L67-L72)
**Feature flag**: `ganttChart` (`onByDefault: true`)
**Registration**: [src/configuration/reports.ts](src/configuration/reports.ts#L11-L17)

```typescript
{
  key: 'start-due',
  name: 'Gantt Chart',
  featureSubtitle: '',
  featureFlag: 'ganttChart',
  onByDefault: true,
}
```

---

## Visual Layout

### Overall Structure

The report is a single **CSS Grid** ([src/canjs/reports/gantt-grid.js](src/canjs/reports/gantt-grid.js#L70-L73)):

```
grid-template-columns: auto auto {{this.gridColumnsCSS}};
grid-template-rows: repeat({{this.gridRowData.length}}, auto);
```

- **Column 1** (`auto`): the expand/collapse chevron gutter (indented by hierarchy depth).
- **Column 2** (`auto`): the issue label / group header (summary text, linked to Jira).
- **Optional extra column(s)** from `columnsToShow` (`auto` each): today only the **% complete**
  column, injected between the label and the timeline when enabled.
- **Timeline columns**: one `fr` column per month, sized by **days in that month** (via
  `gridColumnsCSS`), so a 31-day month is wider than a 28-day February.

### Header Rows (sticky)

There are two sticky header rows built into the same grid:

- **Row 1 — Quarters** ([L81-L83](src/canjs/reports/gantt-grid.js#L81-L83)): each quarter header
  spans 3 month columns (`grid-column: span 3`), text-centered, `sticky top-0`, `z-50`,
  white background. Two empty sticky cells (plus one per `columnsToShow`) precede them to align
  over the label gutter.
- **Row 2 — Months** ([L91-L95](src/canjs/reports/gantt-grid.js#L91-L95)): one cell per month
  showing the short month name (e.g. "Jan"), `border-b border-neutral-80`, `sticky top-6`,
  `z-50`. Again preceded by empty sticky cells over the gutter/columns.

Because both header rows are `sticky` (`top-0` and `top-6`), they remain pinned while the body
scrolls vertically.

### "Today" Line

A thin vertical line marks the current date ([L98-L102](src/canjs/reports/gantt-grid.js#L98-L102)):

- Rendered in a container spanning `grid-column: {{plus(3, columnsToShow.length)}} / span months.length`
  and `grid-row: 3 / span gridRowData.length` (covers the whole timeline body).
- The inner `.today` div: `margin-left: {{todayMarginLeft}}%`, `width: 1px`,
  `background-color: #cf57a0` (pink/magenta), `z-index: 45`, full height.

### Vertical Month Guides

For each month a full-height vertical guide is drawn ([L105-L109](src/canjs/reports/gantt-grid.js#L105-L109)):

- `grid-column: {{plus(scope.index, 3, columnsToShow.length)}}`, `grid-row: 3 / span rows`,
  `z-index: 10`, classes `border-l border-b border-neutral-80`.
- The **last** month additionally gets a right border via `lastRowBorder(index)` →
  `border-r-solid-1px-slate-900` ([L327-L329](src/canjs/reports/gantt-grid.js#L327-L329)).

### Row Striping

Every issue/group row paints an alternating background behind it (`bg-neutral-20` on odd rows)
via `getReleaseTimeline`/`groupElement` ([L426-L433](src/canjs/reports/gantt-grid.js#L426-L433),
[L446-L456](src/canjs/reports/gantt-grid.js#L446-L456)).

### Density Scaling (`lotsOfIssues`)

When there are **more than 20** primary issues **and not** in breakdown mode, the report enters
a compact mode ([L206-L208](src/canjs/reports/gantt-grid.js#L206-L208)):

```javascript
get lotsOfIssues() {
  return this.primaryIssuesOrReleases.length > 20 && !this.breakdown;
}
```

This drives several size getters:

| Getter          | `lotsOfIssues` (true) | Normal (false) | Purpose                          | Ref                                                    |
| --------------- | --------------------- | -------------- | -------------------------------- | ------------------------------------------------------ |
| `textSize`      | `text-xs`             | `''`           | Label/column font size           | [L209-L211](src/canjs/reports/gantt-grid.js#L209-L211) |
| `bigBarSize`    | `h-2`                 | `h-4`          | Current-period rollup bar height | [L200-L202](src/canjs/reports/gantt-grid.js#L200-L202) |
| `shadowBarSize` | `h-4`                 | `h-6`          | Last-period "shadow" bar height  | [L203-L205](src/canjs/reports/gantt-grid.js#L203-L205) |
| `expandPadding` | `''`                  | `pt-1 pb-0.5`  | Vertical padding of chevron cell | [L206-L208](src/canjs/reports/gantt-grid.js#L206-L208) |

`makeCircleForStatus`/empty-set circles also switch padding (`p-1` vs `p-2`, `pl-1` vs `pl-2`)
based on `lotsOfIssues` ([L730-L758](src/canjs/reports/gantt-grid.js#L730-L758)).

### Grid Column Sizing (`gridColumnsCSS`)

([L243-L260](src/canjs/reports/gantt-grid.js#L243-L260))

```javascript
get gridColumnsCSS() {
  let columnCSS = '';
  if (this.columnsToShow.length) {
    columnCSS += 'repeat(' + this.columnsToShow.length + ', auto)';
  }
  columnCSS += this.quartersAndMonths.months
    .map(({ date }) => getDaysInMonth(date.getYear(), date.getMonth() + 1) + 'fr')
    .join(' ');
  return columnCSS;
}
```

Each timeline column gets `daysInMonth` `fr` units so date positioning within a month is
proportional to real calendar days.

---

## Inputs & Data Sources

### Props (from `timeline-report.js`)

([src/timeline-report.js](src/timeline-report.js#L68-L71))

```html
<gantt-grid
  primaryIssuesOrReleases:from="this.primaryIssuesOrReleases"
  allIssuesOrReleases:from="this.rolledupAndRolledBackIssuesAndReleases"
></gantt-grid>
```

1. **`primaryIssuesOrReleases`** (Array) — the filtered, rolled-up issues/releases at the
   primary hierarchy level. Used for rows, timing range, density, and grouping.
2. **`allIssuesOrReleases`** (Array) — all rolled-up + rolled-back data across every hierarchy
   level. Used to look up children (`makeGetChildrenFromReportingIssues`), resolve parents in
   grouping, and feed the % complete modal.

The parent only mounts `<gantt-grid>` when the issues promise is resolved **and**
`primaryIssuesOrReleases.length` is truthy ([src/timeline-report.js](src/timeline-report.js#L65)).
Empty result sets show a separate warning block instead of the gantt.

### `routeData` Props (component-level)

([L162-L192](src/canjs/reports/gantt-grid.js#L162-L192))

- **`routeData`** — the shared routing singleton, default value from
  [src/canjs/routing/route-data](src/canjs/routing/route-data/route-data.js).
- **`breakdown`** getter → `this.routeData.primaryReportBreakdown`.
- **`showPercentComplete`** getter → `this.routeData.showPercentComplete ?? !!localStorage.getItem('showPercentComplete')`.
- **`showChildrenByKey`** — an `ObservableObject` map of `issueKey → boolean` tracking which
  rows are expanded (default empty).
- **`getChildren`** getter → `makeGetChildrenFromReportingIssues(this.allIssuesOrReleases)`.

### Data Shape Consumed per Issue/Release

```typescript
{
  key: string;
  summary: string;
  url?: string;                          // Jira deep link (label is an <a target="_blank">)
  parentKey?: string;                    // used by groupBy: 'parent'
  projectKey?: string;                   // used by groupBy: 'project'
  team?: { name: string; /* ...team config */ };  // used by groupBy: 'team'
  rank?: string | number;                // parents sorted by rank when present
  issue?: { fields?: { Parent?: RawParent; 'Issue Type'?: { iconUrl?: string } } };

  reportingHierarchy: {
    depth: number;                       // label indentation = depth * 4 (pl-*)
    childKeys: string[];                 // hasChildren = childKeys.length > 0
    parentKeys: string[];
  };

  rollupStatuses: {
    rollup: {
      status: string;                    // complete|ontrack|behind|warning|blocked|unknown|notstarted|ahead|new
      start?: Date;
      due?: Date;
      lastPeriod?: { status?: string; start?: Date; due?: Date };
    };
    dev:  { status: string; start?: Date; due?: Date; lastPeriod?: {...}; issueKeys: string[] };
    qa:   { status: string; start?: Date; due?: Date; lastPeriod?: {...}; issueKeys: string[] };
    uat:  { status: string; start?: Date; due?: Date; lastPeriod?: {...}; issueKeys: string[] };
    // (workTypes drives which of these render in breakdown mode)
  };

  rollupDates: {                          // used by the dates tooltip
    start?: Date;
    due?: Date;
  };

  completionRollup: {                     // used by the % complete column + modal
    completedWorkingDays: number;
    remainingWorkingDays: number;
    totalWorkingDays: number;
    source: 'self' | 'average' | 'children';
  };

  issueLastPeriod?: {                     // "compare to" baseline for tooltip diffs
    rollupDates?: { start?: Date; due?: Date };
  };
}
```

### RouteData observables read (directly or via getters)

- **`groupBy`** — `'' | 'parent' | 'team' | 'project'` ([route-data.js](src/canjs/routing/route-data/route-data.js#L781-L799)).
  Default `''`. When `primaryIssueType === 'Release'` it is force-cleared.
- **`primaryIssueType`** — derived from the selected issue type ([route-data.js](src/canjs/routing/route-data/route-data.js#L726-L728)).
  `'Release'` disables all grouping branches.
- **`primaryReportBreakdown`** (`breakdown`) — boolean ([route-data.js](src/canjs/routing/route-data/route-data.js#L733-L738)).
- **`showPercentComplete`** — boolean, `saveJSONToUrl('showPercentComplete', false, …)`
  ([route-data.js](src/canjs/routing/route-data/route-data.js#L748)). Note: this uses plain
  `saveJSONToUrl` (URL only), unlike most flags which also read report data.
- **`roundTo`** — `'day'` default; validated against `ROUND_OPTIONS = ['day', ...Object.keys(roundDate)]`
  = `day | halfQuarter | week | month | quarter` ([route-data.js](src/canjs/routing/route-data/route-data.js#L215-L224),
  [round.js](src/utils/date/round.js#L141-L160)).
- **`derivedIssues`** — used by `getSortedParents` for parent lookup ([route-data.js](src/canjs/routing/route-data/route-data.js#L407)).

---

## Data Transformations

### `gridRowData` — rows to render ([L352-L419](src/canjs/reports/gantt-grid.js#L352-L419))

Builds the flat list of `{ type, issue, isShowingChildren, depth }` row descriptors. A shared
row-expander is created first:

```javascript
const getRows = makeGetRows((key) => this.showChildrenByKey[key], this.getChildren.bind(this));
```

`makeGetRows` ([L763-L778](src/canjs/reports/gantt-grid.js#L763-L778)) recursively flattens the
hierarchy: for each issue it emits a `{ type: 'issue', issue, isShowingChildren, depth }` row,
and if that key is expanded, appends its children's rows at `depth + 1`.

Then one of four branches runs (grouping is only honored when
`primaryIssueType !== 'Release'`):

**1. Group by parent** ([L358-L376](src/canjs/reports/gantt-grid.js#L358-L376))

```javascript
if (this.routeData.groupBy === 'parent' && this.routeData.primaryIssueType !== 'Release') {
  const { parents, parentToChildren } = getSortedParents(this.primaryIssuesOrReleases, this.routeData.derivedIssues);
  let parentsAndChildren = parents
    .map((parent) => [
      { type: 'parent', issue: parent, isShowingChildren: false },
      ...parentToChildren[parent.key].map(getRows).flat(1),
    ])
    .flat(1);
  return parentsAndChildren.length ? parentsAndChildren : this.primaryIssuesOrReleases;
}
```

`getSortedParents` ([L780-L822](src/canjs/reports/gantt-grid.js#L780-L822)):

- Groups primary issues by `parentKey`.
- For each parent key, resolves the parent object in priority order:
  1. the actual loaded issue from `allIssues` if present;
  2. else `normalizeParent(child.issue.fields.Parent)` if the child carries parent data;
  3. else a synthetic `{ key, summary: 'No Parent', rollupStatuses: { rollup: { status: null } } }`.
- Sorts parents by `rank` **only if** the first parent has a `rank`.

**2. Group by team** ([L377-L395](src/canjs/reports/gantt-grid.js#L377-L395)) —
`Object.groupBy(primary, i => i.team.name)`, builds synthetic team "parent" rows
(`{ ...team, summary: teamName }`), sorts teams **alphabetically by name**, then appends each
team's issue rows.

**3. Group by project** ([L396-L410](src/canjs/reports/gantt-grid.js#L396-L410)) —
`Object.groupBy(primary, i => i.projectKey)`, sorts project keys alphabetically, synthetic
parent row is just `{ summary: projectKey }`.

**4. Ungrouped (default)** ([L411-L417](src/canjs/reports/gantt-grid.js#L411-L417)) —
`this.primaryIssuesOrReleases.map((issue) => getRows(issue)).flat(1)`.

### `quartersAndMonths` — time axis range ([L330-L345](src/canjs/reports/gantt-grid.js#L330-L345))

```javascript
get quartersAndMonths() {
  const rollupDates = this.primaryIssuesOrReleases.map((issue) => issue.rollupStatuses.rollup);
  let { start, due } = mergeStartAndDueData(rollupDates);
  if (!start) start = new Date();                                    // nothing has timing
  if (!due)   due = new Date(start.getTime() + 1000*60*60*24*90);    // default +90 days
  if (due < new Date()) due = new Date(Date.now() + 1000*60*60*24*90);// clamp past-due ranges
  return getQuartersAndMonths(new Date(), due);
}
```

Notes:

- The **range start passed to `getQuartersAndMonths` is always `new Date()` (today)**, even
  though `start` is computed — the computed `start` is effectively unused for the axis start
  (see Bugs/Surprises).
- `getQuartersAndMonths(startDate, endDate)` ([quarters-and-months.js](src/utils/date/quarters-and-months.js#L7))
  snaps to quarter boundaries and returns `{ quarters, months, firstDay, lastDay }`. `firstDay`
  is the first day of the quarter containing today; `lastDay` is the end of the quarter
  containing `due`.

### `todayMarginLeft` — today-line offset ([L346-L350](src/canjs/reports/gantt-grid.js#L346-L350))

```javascript
get todayMarginLeft() {
  const { firstDay, lastDay } = this.quartersAndMonths;
  const totalTime = lastDay - firstDay;
  return ((new Date() - firstDay - 1000 * 60 * 60 * 24 * 2) / totalTime) * 100;
}
```

Percentage across the timeline, with a 2-day left nudge.

### `columnsToShow` — the % complete column ([L209-L242](src/canjs/reports/gantt-grid.js#L209-L242))

When `showPercentComplete` is true, returns a single column descriptor; otherwise `[]`.

```javascript
{
  name: 'percentComplete',
  getValue(issue) {
    return stache.safeString(`
      ${Math.round(
        (issue.completionRollup.completedWorkingDays * 100) / issue.completionRollup.totalWorkingDays,
      )}%
    `);
  },
  onclick: (event, issue, allIssues) => {
    const getChildren = makeGetChildrenFromReportingIssues(allIssues);
    const children = getChildren(issue);
    const root = createRoot(this.querySelector('.react-modal'));
    root.render(createElement(PercentComplete, {
      allIssuesOrReleases: allIssues, issue, childIssues: children, onClose: () => root.unmount(),
    }));
  },
}
```

- The value cell is right-aligned, `pointer`, hover `bg-neutral-41`
  ([L138-L142](src/canjs/reports/gantt-grid.js#L138-L142)).
- Clicking it mounts the React `PercentComplete` modal into the `.react-modal` container.
- `getPercentComplete(issue)` ([L270-L279](src/canjs/reports/gantt-grid.js#L270-L279)) is a
  near-duplicate helper (returns `''` when disabled) but appears unused by the template.

### Bar positioning — `getPositionsFromWork` ([L675-L716](src/canjs/reports/gantt-grid.js#L675-L716))

Given `{ firstDay, lastDay }` and a `work = { start, due }` object, computes CSS positioning:

```javascript
function getPositionsFromWork({ firstDay, lastDay }, work) {
  const totalTime = lastDay - firstDay;
  const roundedWork = {
    start: roundDateByRoundToParam.start(work.start),
    due: roundDateByRoundToParam.end(work.due),
  };
  if (roundedWork.start == null && roundedWork.due == null) {
    return {
      start: 0,
      end: Infinity,
      startExtends: false,
      endExtends: false,
      style: { marginLeft: '1px', marginRight: '1px' },
    };
  }
  const start = Math.max(firstDay, roundedWork.start);
  const end = Math.min(lastDay, roundedWork.due);
  const startExtends = roundedWork.start < firstDay; // bar begins before visible range
  const endExtends = roundedWork.due > lastDay; // bar ends after visible range
  return {
    start,
    end,
    endIsBeforeFirstDay: roundedWork.due && roundedWork.due <= firstDay,
    startIsAfterLastDay: roundedWork.start && roundedWork.start >= lastDay,
    startExtends,
    endExtends,
    style: {
      width: Math.max(((end + DAY_IN_MS - start) / totalTime) * 100, 0) + '%',
      marginLeft: 'max(' + ((start - firstDay) / totalTime) * 100 + '%, 1px)',
    },
  };
}
```

- Endpoints are rounded by `roundDateByRoundToParam` (start rounds down, end rounds up) using
  `routeData.roundTo` ([round.ts](src/canjs/routing/utils/round.ts#L5-L13)).
- Widths clamp with `Math.max(…, 0)`; a full extra `DAY_IN_MS` is added so a bar occupies its
  final day.
- Clamps start/end into `[firstDay, lastDay]`, tracks whether the bar `startExtends`/`endExtends`
  beyond the visible range, and flags `endIsBeforeFirstDay` (entirely in the past).

### Timeline rendering — `getReleaseTimeline` ([L434-L590](src/canjs/reports/gantt-grid.js#L434-L590))

Builds a `DocumentFragment` per issue row containing:

1. **Background** stripe (`bg-neutral-20` on odd rows). Its `grid-column` **widens to span the
   full grid** (`1 / span months+columns+2`) when any primary issue is expanded
   (`somePrimaryIssuesAreExpanded`), otherwise spans only the timeline columns
   ([L446-L456](src/canjs/reports/gantt-grid.js#L446-L456)).
2. **`root`** — relative-positioned container over the timeline columns, `z-index: 20`.
3. **`lastPeriodRoot`** — an absolutely-stretched overlay inside `root` for the "shadow" bars.
   Gets `py-1` unless in breakdown mode ([L468-L475](src/canjs/reports/gantt-grid.js#L468-L475)).

Then, **if `release.rollupStatuses.rollup.start && .due` exist**:

- **Breakdown mode** ([L506-L536](src/canjs/reports/gantt-grid.js#L506-L536)): for each work
  type with work (`hasWorkTypes.list.filter(wt => wt.hasWork)`), draws:
  - a **current-period bar**: `type + '_time'`, `h-[6px]`, `my-[1px]`, `rounded-sm`, colored
    `color-text-and-bg-{status}` from `rollupStatuses[type].status`;
  - a **last-period shadow** via `makeLastPeriodElement(...)` sized `h-2`.
- **Non-breakdown (rollup) mode** ([L537-L584](src/canjs/reports/gantt-grid.js#L537-L584)):
  - attaches `mouseenter`/`mouseleave` → dates tooltip (`showDatesTooltip`/`hideDatesTooltip`);
  - computes `currentPositions = getPositions(rollup)`;
  - if `endIsBeforeFirstDay`, renders a **status circle with a `←` arrow**
    (`makeCircleForStatus(status, '←', lotsOfIssues)`); otherwise renders the **current bar**:
    `my-2`, `bigBarSize`, `color-text-and-bg-{status}`, corner rounding from
    `roundBasedOnIfTheBarsExtend`, class `identifier-current-time`, `z-index: 30`;
  - if `rollup.lastPeriod` exists:
    - and it has both `start` & `due` → a blurred **shadow bar** (`makeLastPeriodElement`, sized
      `shadowBarSize`);
    - else → `makeEmptySetInThePast` (a `∅` circle) is appended (with a stray `console.log`).

**Else (no start or no due)** ([L586-L589](src/canjs/reports/gantt-grid.js#L586-L589)):
`makeEmptySetCurrent(lotsOfIssues)` — a `notstarted`-colored circle containing
`/images/empty-set.svg`.

#### `makeLastPeriodElement` (the "shadow") ([L479-L505](src/canjs/reports/gantt-grid.js#L479-L505))

- Skips rendering (empty div) if the shadow's positions equal the current positions, or if the
  shadow's `endIsBeforeFirstDay`.
- Otherwise a `blur-xs`, `border-black` bar with borders/rounding from
  `borderBasedOnIfTheBarsExtend` / `roundBasedOnIfTheBarsExtend`, `backgroundClip: content-box`.

#### Corner & border logic

```javascript
function roundBasedOnIfTheBarsExtend({ startExtends, endExtends }) {
  if (!startExtends && !endExtends)
    return 'rounded'; // fully inside → all corners
  else if (startExtends && endExtends)
    return 'rounded-none'; // spans both edges → square
  else if (startExtends)
    return 'rounded-r'; // clipped left → round right only
  else return 'rounded-l'; // clipped right → round left only
}
```

([L632-L641](src/canjs/reports/gantt-grid.js#L632-L641))

```javascript
function borderBasedOnIfTheBarsExtend({ startExtends, endExtends }) {
  if (!startExtends && !endExtends) return ['border'];
  else if (startExtends && endExtends) return ['border-0'];
  else if (startExtends) return ['border-r', 'border-y'];
  else return ['border-l', 'border-y'];
}
```

([L643-L652](src/canjs/reports/gantt-grid.js#L643-L652))

#### Empty-set / circle helpers ([L718-L758](src/canjs/reports/gantt-grid.js#L718-L758))

- `makeCircle(innerHTML, styles, css)` — a flex-centered `border-radius: 50%` element.
- `makeCircleForStatus(status, innerHTML, lotsOfIssues)` — wraps a circle colored
  `color-text-and-bg-{status}`, padding `p-1`/`p-2`. Used for the `←` past-due indicator.
- `makeEmptySetCurrent(lotsOfIssues)` — `notstarted` circle with `empty-set.svg` (issue has no
  start/due at all).
- `makeEmptySetInThePast(lotsOfIssues)` — a `∅` glyph circle (`color-text-notstarted`), shown
  when a last-period existed but current period lost its dates.

Note: `fewerIssuesClasses` and `lotsOfIssueClasses` are **identical** (`['w-4','h-4','text-xs']`)
([L730-L731](src/canjs/reports/gantt-grid.js#L730-L731)).

### `hasWorkTypes` / `hasQAWork` / `hasUATWork` ([L591-L615](src/canjs/reports/gantt-grid.js#L591-L615))

`hasWorkTypes` maps each `workTypes` entry to `{ type, hasWork }` where `hasWork` is true if any
primary issue has `rollupStatuses[type].issueKeys.length`. Used to decide which bars to draw in
breakdown mode. `hasQAWork`/`hasUATWork` are similar single-type convenience getters.

---

## Interactions

### Expand / Collapse Hierarchy

- Each issue label cell shows a chevron in column 1 ([L112-L127](src/canjs/reports/gantt-grid.js#L112-L127)):
  - expanded → `/images/chevron-down-collapse.svg`;
  - collapsed & has children → `/images/chevron-right-expand.svg`.
- Chevron indent: `pl-{{multiply(depth, 4)}}` (`depth * 4`), `w-4 box-content`.
- Clicking the chevron cell calls `toggleShowingChildren(issue)`
  ([L196-L205](src/canjs/reports/gantt-grid.js#L196-L205)), flipping `showChildrenByKey[key]`
  (only if `hasChildren`).
- The chevron is **hidden** (`invisible`) unless `showExpandChildrenIcon(issue)` is true:
  `hoveringIssue === issue || somePrimaryIssuesAreExpanded`
  ([L267-L269](src/canjs/reports/gantt-grid.js#L267-L269)) — i.e. it appears on hover, or on all
  rows once anything is expanded.

### Hover State

- `on:mouseenter`/`on:mouseleave` on the label cell set `hoveringIssue`
  ([L106-L107](src/canjs/reports/gantt-grid.js#L108), [L261-L266](src/canjs/reports/gantt-grid.js#L261-L266)).
- Label cell hover also toggles `hover:bg-neutral-41` on the chevron area when the issue has
  children.

### Issue Tooltip (group/parent rows)

- Parent/group header rows have `on:click='this.showTooltip(scope.event, data.issue)'`
  ([L146-L152](src/canjs/reports/gantt-grid.js#L146-L152)).
- `showTooltip` ([L280-L283](src/canjs/reports/gantt-grid.js#L280-L283)) delegates to
  `showTooltip(currentTarget, issue)` from
  [src/canjs/controls/issue-tooltip.js](src/canjs/controls/issue-tooltip.js#L44). (The gantt
  passes `allIssuesOrReleases` as a 3rd arg, but the imported function ignores it.)
- The tooltip is a toggle (click again to dismiss), renders a bold linked title, a
  "Show Children" explore link (rewrites the URL to `jql=issue = KEY`, `loadChildren=true`,
  clearing status/release/groupBy params), and per-work-part rollup/dev/qa/uat sections with
  start–due dates, "was" dates, and warning messages
  ([issue-tooltip.js](src/canjs/controls/issue-tooltip.js#L44-L181)).

### Dates Tooltip (bar hover)

- In non-breakdown mode, hovering a bar's `root` shows the dates tooltip
  ([L537-L538](src/canjs/reports/gantt-grid.js#L537-L538), [L284-L313](src/canjs/reports/gantt-grid.js#L284-L313)).
- It anchors to the `.identifier-current-time` bar if present, else the row root, and displays a
  `datesTooltipStache` fragment with up to three pills ([L45-L57](src/canjs/reports/gantt-grid.js#L45-L57)):
  - **start date** — `makeDateAndDiff(rollupDates.start, issueLastPeriod.rollupDates.start)`;
  - **business-days shorthand** — `timeRangeShorthand(daysBetween(due, start))` (only when both
    dates exist);
  - **end date** — `makeDateAndDiff(rollupDates.due, issueLastPeriod.rollupDates.due)`.
- `makeDateAndDiff` ([L661-L673](src/canjs/reports/gantt-grid.js#L661-L673)) formats the date
  (`Intl.DateTimeFormat` weekday/day/month/year) and appends a signed `+/-` shorthand diff vs the
  last-period date when nonzero.
- Tooltip positioning is handled by `SimpleTooltip.belowElementInScrollingContainer`
  ([simple-tooltip.js](src/canjs/ui/simple-tooltip/simple-tooltip.js#L74)); `hideDatesTooltip`
  calls `DATES_TOOLTIP.leftElement(event)`.

### % Complete Column → React Modal

Clicking a % complete cell opens the React `PercentComplete` modal
([PercentComplete.tsx](src/react/reports/GanttReport/PercentComplete/PercentComplete.tsx#L258)).
The modal shows:

- Header: issue type icon (or type text) + linked issue key + title
  "Remaining Work Calculation Summary".
- "Calculation Source: {self|average|children}".
- If **self**: `SelfCalculationBox` — the full timing calculation (method: dates /
  points-and-confidence / points / unknown) with completed/total working-day boxes and the
  velocity/confidence breakdown ([PercentComplete.tsx](src/react/reports/GanttReport/PercentComplete/PercentComplete.tsx#L70-L120)).
- If **average**: a single box of `{type} average days` = total working days.
- If **children**: `SelfAndChildrenValues` — a table of the issue plus each child with
  Percent Complete / Completed / Remaining / Total working days, child summaries linked to Jira
  ([PercentComplete.tsx](src/react/reports/GanttReport/PercentComplete/PercentComplete.tsx#L68-L120,src/react/reports/GanttReport/PercentComplete/PercentComplete.tsx#L200-L256)).

### Issue Links

- Issue labels are `<a href="{{issue.url}}" target="_blank">` with `hover:underline`
  ([L128-L133](src/canjs/reports/gantt-grid.js#L128-L133)), opening Jira in a new tab.

### `alignLeft` when expanded

- `alignLeft` === `somePrimaryIssuesAreExpanded` ([L617-L622](src/canjs/reports/gantt-grid.js#L617-L622)).
- When true, the label cell uses `justify-left` instead of `justify-between`
  ([L106-L108](src/canjs/reports/gantt-grid.js#L106-L108)), and (as noted above) row backgrounds
  widen to span the whole grid.

---

## Configuration & Feature Flags

### Feature Flag

`ganttChart`, `onByDefault: true` ([src/configuration/reports.ts](src/configuration/reports.ts#L11-L17)).
Toggleable in dev via `window.featureFlags` ([src/shared/feature-flag.js](src/shared/feature-flag.js)).

### Options affecting behavior

1. **`groupBy`** (`'' | 'parent' | 'team' | 'project'`) — selects the `gridRowData` grouping
   branch. Ignored (treated as ungrouped) when `primaryIssueType === 'Release'`. Route-level
   listener force-clears `groupBy` when the primary type becomes `Release`
   ([route-data.js](src/canjs/routing/route-data/route-data.js#L781-L799)).
2. **`primaryIssueType`** — when `'Release'`, disables grouping entirely.
3. **`showPercentComplete`** — toggles the `columnsToShow` % complete column and its modal.
   Falls back to `localStorage.getItem('showPercentComplete')` if the routeData value is
   nullish. Persisted URL-only (`saveJSONToUrl`).
4. **`primaryReportBreakdown`** (`breakdown`) — switches each bar into per-work-type dev/qa/uat
   bars, and **disables the `lotsOfIssues` density optimization** (`lotsOfIssues` is forced
   false whenever `breakdown` is true). Also removes the `py-1` padding on the last-period
   overlay.
5. **`roundTo`** (`day | week | month | quarter | halfQuarter`) — controls endpoint rounding in
   `getPositionsFromWork` via `roundDateByRoundToParam` (start rounds down, end rounds up).
6. **`secondaryReportType`** interplay — the gantt itself does not read `secondaryReportType`,
   but the sibling `<status-report>` is mounted alongside the gantt when
   `secondaryReportType === 'status'` or `'breakdown'`, with its own `breakdown` prop set to
   `eq(secondaryReportType, 'breakdown')` ([src/timeline-report.js](src/timeline-report.js#L85-L90)).
   The gantt's own breakdown bars are driven by `primaryReportBreakdown`, which is a separate
   flag from the secondary report's breakdown.

---

## Edge Cases & Special Handling

1. **No issues / empty data** — the gantt is not mounted at all; `timeline-report` shows a
   warning block instead ([src/timeline-report.js](src/timeline-report.js#L65,src/timeline-report.js#L98-L103)).
   If it did render with no timing, `quartersAndMonths` defaults to `today → today + 90 days`.
2. **Issue with no start or no due** — `getReleaseTimeline` renders `makeEmptySetCurrent`
   (the `empty-set.svg` circle) instead of a bar ([L586-L589](src/canjs/reports/gantt-grid.js#L586-L589)).
3. **Rollup start/due both null in `getPositionsFromWork`** — returns a degenerate position
   (`start:0, end:Infinity`, tiny 1px margins) ([L684-L695](src/canjs/reports/gantt-grid.js#L684-L695)).
4. **Bar entirely before the first visible day** (`endIsBeforeFirstDay`) — rendered as a status
   circle with a `←` arrow rather than a zero-width bar ([L544-L546](src/canjs/reports/gantt-grid.js#L544-L546)).
   Last-period shadows in this state are skipped ([L488-L490](src/canjs/reports/gantt-grid.js#L488-L490)).
5. **Bar extending beyond the visible range** — `startExtends`/`endExtends` drive corner
   rounding (`rounded-l`/`rounded-r`/`rounded-none`) and border sides so the bar visually reads
   as "continues off-screen" ([L632-L652](src/canjs/reports/gantt-grid.js#L632-L652)).
6. **Last-period present but current period lost its dates** — a `∅` (`makeEmptySetInThePast`)
   is shown in the shadow overlay ([L577-L581](src/canjs/reports/gantt-grid.js#L577-L581)).
7. **Last-period identical to current** — the shadow element is skipped (empty div) to avoid
   double-drawing ([L483-L485](src/canjs/reports/gantt-grid.js#L483-L485)).
8. **Missing parent data (group by parent)** — resolved via loaded issue →
   `normalizeParent(fields.Parent)` → synthetic `"No Parent"` with `status: null`
   ([L791-L810](src/canjs/reports/gantt-grid.js#L791-L810)). If a parent grouping yields nothing,
   it falls back to the ungrouped `primaryIssuesOrReleases` list.
9. **Parents without `rank`** — left in `Object.keys` order (no sort) when the first parent has
   no `rank` ([L812-L818](src/canjs/reports/gantt-grid.js#L812-L818)).
10. **Releases vs issues** — grouping branches are all gated on `primaryIssueType !== 'Release'`;
    a Release-typed report is always ungrouped.
11. **Density threshold** — `lotsOfIssues` triggers at `> 20` primary issues, but never in
    breakdown mode.
12. **Past-due range clamp** — if the merged `due` is already in the past, the axis is forced to
    `today + 90 days` so the "today" line and bars stay in view ([L339-L342](src/canjs/reports/gantt-grid.js#L339-L342)).
13. **Special status text color** — `classForSpecialStatus` only colors `complete`, `blocked`,
    `warning` labels (`color-text-{status}`); all other statuses get default text color
    ([L314-L320](src/canjs/reports/gantt-grid.js#L314-L320)).

---

## Dependencies

- **CanJS** — `StacheElement`, `type`, `ObservableObject`, `stache` ([src/can.js](src/can.js)).
- **React** — `createRoot` / `createElement` to mount the `PercentComplete` modal.
- **Tooltips** — `SimpleTooltip` ([simple-tooltip.js](src/canjs/ui/simple-tooltip/simple-tooltip.js)),
  `showTooltip`/`showTooltipContent` ([issue-tooltip.js](src/canjs/controls/issue-tooltip.js)).
- **Rollup / hierarchy** — `makeGetChildrenFromReportingIssues` ([src/jira/rollup/rollup](src/jira/rollup/rollup.ts)),
  `mergeStartAndDueData` ([src/jira/rollup/dates/dates](src/jira/rollup/dates/dates.ts)).
- **Work status** — `workTypes` ([src/jira/derived/work-status/work-status](src/jira/derived/work-status/work-status.ts)).
- **Normalize** — `normalizeParent` ([src/jira/normalized/normalize](src/jira/normalized/normalize.ts)).
- **Date utils** — `roundDateByRoundToParam` ([round.ts](src/canjs/routing/utils/round.ts)),
  `getQuartersAndMonths` ([quarters-and-months.js](src/utils/date/quarters-and-months.js)),
  `getDaysInMonth` ([days-in-month](src/utils/date/days-in-month.js)),
  `getBusinessDatesCount` ([business-days](src/utils/date/business-days.js)) — imported but see
  Bugs/Surprises, `daysBetween` ([days-between.js](src/utils/date/days-between.js)),
  `timeRangeShorthand` ([time-range-shorthand.js](src/utils/date/time-range-shorthand.js)).
- **CSS** — status color classes `color-text-and-bg-{status}` / `color-text-{status}`
  ([src/css/colors.css](src/css/colors.css)); Tailwind utilities throughout.

---

## Bugs / Surprises / Ambiguities (for review)

- **Axis always starts at today (intended)** ([L330-L344](src/canjs/reports/gantt-grid.js#L330-L344)):
  a `start` is derived from `mergeStartAndDueData` and defaulted, but `getQuartersAndMonths(new Date(), due)`
  always passes **today** as the axis start, so the computed `start` has no effect and bars that
  started before today render in the "extends left" state. This is **intended** — the Gantt is a
  future-looking timeline that begins at today. (Noted here only because the discarded `start` reads
  like an oversight.)
- **`getBusinessDatesCount` is imported but never used** (the dates tooltip uses `daysBetween` +
  `timeRangeShorthand` instead) ([L11](src/canjs/reports/gantt-grid.js#L11)).
- **Stray `console.log`** in the empty-set-in-the-past branch ([L579](src/canjs/reports/gantt-grid.js#L579)).
- **`fewerIssuesClasses` and `lotsOfIssueClasses` are identical** ([L730-L731](src/canjs/reports/gantt-grid.js#L730-L731)),
  so the circle sizing never actually changes with density (only the wrapper padding does).
- **Duplicate percent-complete logic** — `columnsToShow.getValue` and `getPercentComplete`
  compute the same value; `getPercentComplete` appears unused by the template.
- **`showTooltip` passes an extra arg** (`this.allIssuesOrReleases`) that the imported
  `showTooltip(element, issue)` ignores; it also re-creates `getChildren` and never uses it
  ([L280-L283](src/canjs/reports/gantt-grid.js#L280-L283)).
- **`classForSpecialStatus` takes an unused second `issue` param** ([L314](src/canjs/reports/gantt-grid.js#L314)).
- **Group-by-team assumes every issue has a `team.name`** (`Object.groupBy(..., i => i.team.name)`)
  — issues without a team would throw / group under `undefined` ([L377-L379](src/canjs/reports/gantt-grid.js#L377-L379)).
- **`showPercentComplete` persistence differs** from the other flags: it uses `saveJSONToUrl`
  (URL-only) rather than the report-aware wrapper, and additionally falls back to a raw
  `localStorage` key — two separate persistence mechanisms for one toggle.
- **Percent can be `NaN`** when `completionRollup.totalWorkingDays` is 0 (division by zero in
  both `getValue` and `getPercentComplete`).
- **Grid re-render cost**: `getReleaseTimeline` rebuilds the full DOM fragment (background +
  bars) for every row on any observable change, and the background span depends on the global
  `somePrimaryIssuesAreExpanded`, so expanding one row re-lays-out every row (noted in an inline
  comment).

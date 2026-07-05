# Plan: Migrate Gantt Chart from CanJS to React

## Goal

Faithful 1:1 port of the CanJS Gantt Chart (the `start-due` report) to React, mirroring the
ScatterTimeline migration. Direct swap — React becomes the only Gantt and the CanJS
`gantt-grid.js` is retired. The PercentComplete modal is rebuilt fresh.

## Decisions

- **Fidelity**: Faithful port first, improve later. No UX redesign.
- **Rollout**: Direct swap — React becomes the only Gantt; retire `src/canjs/reports/gantt-grid.js`.
- **PercentComplete**: Rebuild/refresh the modal (do not reuse the existing one).
- **Tooltips**: Rebuild with Atlaskit **Popup** (both the issue tooltip and the dates tooltip).
  Do NOT reuse the CanJS `SimpleTooltip` / `issue-tooltip`.
- **State**:
  - routeData-synced state **stays synced** via observables (read with `useCanObservable`,
    write by setting `.value`): `groupBy`, `roundTo`, `primaryIssueType`,
    `primaryReportBreakdown`, `showPercentComplete`
    (`showPercentComplete` is `saveJSONToUrl` in `route-data.js` line 748).
  - Only `showChildrenByKey` (per-issue expand/collapse) is component-local today (an
    `ObservableObject`, **not** in the URL) → becomes React `useState`. This preserves current
    behavior (expansion resets on reload, not shareable via URL).
- **Bars**: Port the raw-DOM `getReleaseTimeline` builder to declarative JSX (absolute-positioned divs).

## Known issues & remediation (from `behavior.md` review)

Decisions for the surprising/buggy behaviors catalogued in
[behavior.md](behavior.md) → "Bugs / Surprises / Ambiguities".

### Behavior-affecting

1. **Axis start = today (NOT a bug — intended)** — `quartersAndMonths` passes `new Date()` as the
   axis start and discards the computed `start`
   ([gantt-grid.js#L330-L344](src/canjs/reports/gantt-grid.js#L330-L344)). This is **expected
   behavior**: the Gantt is a **future-timeline** report and intentionally starts at today. The
   React port **preserves this** (`axisStart = today`). Isolate it in a single `computeAxisRange`
   helper so it is explicit and easy to revisit, but do not change the behavior.
2. **Group-by-team crash on missing team** — legacy `Object.groupBy(..., i => i.team.name)` throws /
   buckets under `undefined` ([gantt-grid.js#L377-L379](src/canjs/reports/gantt-grid.js#L377-L379)).
   **Remediation: reuse the shared `groupIssues.ts`** (Phase 0/1), which already uses
   `team?.name || null` with a **"No Team"** fallback. Fixed for free; do not port the unsafe version.
3. **Percent complete `NaN`** on divide-by-zero when `completionRollup.totalWorkingDays === 0`.
   **Remediation: render `—`** (em dash) when total is 0. Rationale: `—` is the app's established
   convention for a missing **number** (FlowMetrics `MetricsCards`, `IssueDebugModal`, `FlowMetrics`),
   whereas `∅` is reserved for **"unknown dates"** (undated circles, footer `StatusKey`). Percent is a
   missing number, so `—` is correct.
4. **`showPercentComplete` dual persistence** — legacy uses `saveJSONToUrl` (URL) **and** a raw
   `localStorage` fallback. **Remediation: routeData/URL observable is the single source of truth;
   drop the `localStorage` fallback**, consistent with `groupBy`, `roundTo`, etc.
5. **Density circle sizing is a no-op** — `fewerIssuesClasses` and `lotsOfIssueClasses` are identical
   ([gantt-grid.js#L730-L731](src/canjs/reports/gantt-grid.js#L730-L731)), so circles never resize
   with density. **Remediation: preserve current appearance** (keep sizing identical) for the faithful
   port; collapse to a single constant so the redundancy is obvious. Actual resize is deferred to the
   "improve later" phase.

### Dead code — do not port

- `getBusinessDatesCount` imported but unused ([gantt-grid.js#L11](src/canjs/reports/gantt-grid.js#L11)).
- Stray `console.log` in the empty-set-past branch ([gantt-grid.js#L579](src/canjs/reports/gantt-grid.js#L579)).
- Duplicate percent logic (`getPercentComplete` vs `columnsToShow.getValue`) → implement **once** as a
  pure `getPercentComplete(issue)` helper (with the divide-by-zero guard above), used by both the
  column cell and the modal.
- `showTooltip` passes an ignored 3rd arg and builds an unused `getChildren`
  ([gantt-grid.js#L280-L283](src/canjs/reports/gantt-grid.js#L280-L283)) → moot once tooltips are
  rebuilt with Atlaskit Popup.
- `classForSpecialStatus` unused `issue` param ([gantt-grid.js#L314](src/canjs/reports/gantt-grid.js#L314))
  → drop param; fold into shared `status.ts`.

### Performance (resolved by the React port)

- Full per-row DOM rebuild on any change, with each row's background span keyed to the global
  `somePrimaryIssuesAreExpanded` ([gantt-grid.js#L429-L470](src/canjs/reports/gantt-grid.js#L429-L470)).
  Declarative JSX + React reconciliation (rows keyed by issue key, memoized pure position helpers)
  makes expanding one row re-render only what changed. No special work beyond the "declarative JSX bars"
  decision.

## Source (CanJS) — what to port

- `src/canjs/reports/gantt-grid.js` (~825 lines) — `GanttGrid extends StacheElement`.
- Features: CSS-grid layout; quarter + month headers; today line; vertical month guides;
  hierarchical rows with expand/collapse (`showChildrenByKey`); grouping by parent/team/project;
  per-issue timeline bars (`getReleaseTimeline`) including current + last-period "shadow" bars;
  breakdown mode (dev/qa/uat work-type bars); % complete column + modal; density mode (>20 issues);
  issue tooltip + dates tooltip; status colors; empty-set circles for undated issues.
- Props consumed: `primaryIssuesOrReleases`, `allIssuesOrReleases`; routeData: `groupBy`,
  `primaryIssueType`, `showPercentComplete`, `primaryReportBreakdown`, `roundTo`.

## Template to follow — ScatterTimeline

- `src/react/reports/ScatterTimeline/` — structure: main `.tsx`, `index.ts`, `types.ts`,
  `fixtures.ts`, `components/*`, `helpers/*` (pure, unit-tested), `hooks/*`, `.stories.tsx`, `.test.tsx`.
- Mount pattern in `src/timeline-report.js`: `urlParamValuesToReactComponents` map +
  `renderReactReport()` wraps in `QueryClientProvider` + `JiraProvider`; observables created via
  `value.from` / `value.bind`.
- Read observables in React via `useCanObservable` (`src/react/hooks/useCanObservable`).

## Reusable helpers (date utils, pipeline)

- `src/utils/date/quarters-and-months` (`getQuartersAndMonths`) — already used by the CanJS gantt.
- `src/utils/date/days-in-month`, `business-days`, `days-between`, `time-range-shorthand`.
- `src/canjs/routing/utils/round` (`roundDateByRoundToParam`) — bar positioning rounding.
- `src/jira/rollup/rollup` (`makeGetChildrenFromReportingIssues`),
  `src/jira/rollup/dates/dates` (`mergeStartAndDueData`).

## Sharing with the Scatter report

ScatterTimeline was written anticipating this reuse (its helpers/components are generic and even
reference the Gantt in their comments). Extract the shared pieces into a **new** module
`src/react/reports/shared/timeline/` and have BOTH reports import from it (avoids a Gantt→Scatter
dependency).

**Direct reuse (no change):**

- `helpers/groupIssues.ts` — generic via a `getIssue` extractor + `allIssues`; doc comment says it
  mirrors gantt `getSortedParents`. Replaces the gantt `gridRowData` grouping branch.
- `helpers/status.ts` — `getStatusColorClass`, `getStatusLabel`, `countIssuesByStatus`,
  `STATUS_LEGEND_ORDER`. Covers `color-text-and-bg-*` + `classForSpecialStatus`.
- `helpers/density.ts` — `shouldUseDensityOptimizations(count) = count > 20` == gantt `lotsOfIssues`.
- Components `QuarterAndMonthHeaders`, `TodayLine`, `GridLines`, `StatusLegend` — all already accept
  a `columnOffset` prop (built for the gantt's left gutter). They render as bare CSS-grid children,
  so they drop into the gantt grid.
- Types: minimal `IssueOrRelease` slice + `Quarter`/`Month`/`QuartersAndMonths` re-exports.

**Adapt (not direct reuse):**

- `positioning.ts` — scatter positions a **point** (single rounded due date + label flipping);
  gantt positions a **bar** (start→due span, extend/round-corner logic in `getPositionsFromWork`).
  Separate gantt `positioning.ts`; shares the `firstDay`/`lastDay` percentage math.
- `dateRange.ts` / `trimRange.ts` — reusable concept; gantt computes range from
  `rollupStatuses.rollup` via `mergeStartAndDueData` → thin adapter.

**Gantt-only (no scatter equivalent):** row hierarchy flattening + expand/collapse (`makeGetRows`),
timeline bars + last-period shadow bars, breakdown (dev/qa/uat), % complete column + modal.

## Steps

### Phase 0 — Extract shared timeline module (do first)

0. Create `src/react/reports/shared/timeline/` and MOVE these out of ScatterTimeline (updating
   scatter's imports):

   - helpers: `groupIssues.ts`, `status.ts`, `density.ts`
   - components: `QuarterAndMonthHeaders`, `TodayLine`, `GridLines`, `StatusLegend`
   - shared `IssueOrRelease` slice + `Quarter`/`Month` re-exports

   Run scatter tests after the move to confirm green. Both reports then import from shared.

### Phase 1 — Scaffold + Gantt-specific pure helpers (parallelizable)

1. Create `src/react/reports/GanttReport/GanttGrid/` with `index.ts`, `types.ts`, `fixtures.ts`.
2. Port Gantt-only logic into `helpers/` (each with a `.test.ts`):
   - `rows.ts` — flatten hierarchy w/ expand state (port `makeGetRows`, `getSortedParents`).
   - grouping — REUSE shared `groupIssues.ts` (generic `getIssue` extractor); no new grouping helper.
   - `positioning.ts` — bar left/width % (port `getPositionsFromWork`, extend/round logic). Gantt-specific.
   - `columns.ts` / `quarters.ts` — `gridColumnsCSS`, `todayMarginLeft`; density REUSE shared
     `density.ts`; quarters via `getQuartersAndMonths`.
   - `barCorners.ts` — `roundBasedOnIfTheBarsExtend`, `borderBasedOnIfTheBarsExtend`. Status colors
     REUSE shared `status.ts`.

### Phase 2 — React components (depends on Phase 0, 1)

3. REUSE shared `QuarterAndMonthHeaders`, `TodayLine`, `GridLines` (pass `columnOffset` for the
   gantt's gutter columns).
4. `components/IssueRow/` — label cell (indent/chevron expand-collapse, hover), optional columns,
   timeline cell.
5. `components/TimelineBar/` — current-period bar + last-period shadow bar (declarative JSX,
   absolute-positioned divs); breakdown (dev/qa/uat) variant; empty-set circles for undated; dates
   tooltip via Atlaskit Popup.
6. `components/IssueTooltip/` (Atlaskit Popup) — replaces the CanJS issue-tooltip on parent rows.
7. `components/GroupRow/` — parent/team/project band row.
8. `GanttGrid.tsx` — orchestrator: read observables (`useCanObservable`) incl.
   `groupBy`/`roundTo`/`primaryIssueType`/breakdown/`showPercentComplete`, measure container width,
   compute rows/groups/positions via helpers, render CSS grid. `showChildrenByKey` via React
   `useState` (component-local, matches today).

### Phase 3 — PercentComplete modal (rebuild) (parallel with Phase 2)

9. New `components/PercentCompleteModal/` (Atlaskit modal) replacing
   `src/react/reports/GanttReport/PercentComplete`. Triggered by clicking the % complete column;
   receives issue + children + allIssues. Toggling writes the `showPercentComplete` observable (URL-synced).

### Phase 4 — Wire into shell + retire CanJS (depends on 2, 3)

10. `src/timeline-report.js`: add `'start-due': GanttGrid` to `urlParamValuesToReactComponents`;
    remove the `{{# eq primaryReportType "start-due" }}<gantt-grid>` block and the
    `import './canjs/reports/gantt-grid.js'`. Ensure `renderReactReport` passes the needed
    observables (add `groupByObs`, `roundToObs`, breakdown, `showPercentComplete`, `primaryIssueType`
    as needed).
11. Delete `src/canjs/reports/gantt-grid.js` and the old `src/react/reports/GanttReport/PercentComplete`.
    Remove now-unused CanJS `SimpleTooltip` / `issue-tooltip` refs if no other consumers.

### Phase 5 — Tests + stories

12. `GanttGrid.stories.tsx` mirroring the scatter stories (grouping, breakdown, density, undated,
    expand/collapse).
13. `GanttGrid.test.tsx` + helper tests. Run `npm run test`, `npm run typecheck`.

## Verification

1. `npm run typecheck` clean.
2. `npm run test` — new helper + component tests pass AND existing scatter tests still pass
   (validates the Phase 0 move).
3. Storybook (localhost:6006) — Gantt stories render: headers, today line, bars, grouping,
   breakdown, density, expand/collapse, undated circles. Scatter stories still render.
4. `npm run dev` — select the Gantt Chart report; verify vs old behavior: expand/collapse hierarchy,
   group by parent/team/project, % complete column + modal, breakdown (secondary = breakdown),
   tooltips, today-line position, roundTo.
5. E2E smoke where applicable.

## Resolved considerations

1. **Tooltips**: rebuild with Atlaskit Popup (both issue tooltip + dates tooltip).
2. **State**: routeData-synced stays synced (`groupBy`, `roundTo`, `primaryIssueType`, breakdown,
   `showPercentComplete`); only the per-issue expand map `showChildrenByKey` (already component-local,
   not in URL) becomes React `useState`.
3. **Bars**: port raw-DOM `getReleaseTimeline` to declarative JSX.

## Excluded scope

- No UX redesign (faithful port).
- No changes to the data pipeline (rollup/derive) — consume existing observables.

## Key files

| File                                                   | Purpose                                                                                                                      |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/canjs/reports/gantt-grid.js`                      | Source of truth to port (getters `gridRowData`, `quartersAndMonths`, `columnsToShow`, `getReleaseTimeline`, module helpers). |
| `src/timeline-report.js`                               | Mount point; `urlParamValuesToReactComponents` map + `renderReactReport()`.                                                  |
| `src/react/reports/ScatterTimeline/`                   | Structural template (helpers/components/hooks/stories/tests).                                                                |
| `src/react/hooks/useCanObservable/useCanObservable.ts` | Observable → React bridge.                                                                                                   |
| `src/canjs/routing/route-data/route-data.js`           | routeData observables (`showPercentComplete` at line 748, etc.).                                                             |
| `src/react/reports/GanttReport/PercentComplete/`       | Existing modal to be replaced.                                                                                               |

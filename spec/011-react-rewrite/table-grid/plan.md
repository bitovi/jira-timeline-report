# table-grid → React rewrite plan

**Source:** `src/canjs/reports/table-grid.js` (437 lines)
**Custom elements:** `<table-grid>` (`TableGrid`), `<estimate-breakdown>` (`EstimateBreakdown`, internal tooltip)
**Status: LIVE** — renders the "Estimation Table" report (feature flag `estimationTable`, off by default).
**Difficulty: Medium (leaning Easy)**

## Is it used?

Yes. It is the **sole render path** for the `table` report:

- Rendered at `src/timeline-report.js:98-100`, gated by `{{# eq(this.routeData.primaryReportType, "table") }}`.
- `"table"` is deliberately **absent** from `urlParamValuesToReactComponents` (`timeline-report.js:41-50`), so this report has never been migrated — unlike `start-due`→`GanttGrid` and `due`→`ScatterTimeline`.
- Report config: `src/configuration/reports.ts:54-60` (`key:'table'`, "Estimation Table", `featureFlag:'estimationTable'`, `onByDefault:false`). User-selectable whenever the flag is on.
- It is the only file left in `src/canjs/reports/`.

## What it does

Recursive, indented HTML `<table>` of issues showing estimation columns: Summary, Estimated Days, Timed Days, Rolled Up Days.

- **Row building** (`tableRows` getter, `:277-287`): `makeGetChildrenFromReportingIssues(allIssuesOrReleases)` (from `src/jira/rollup/rollup`) flattens `primaryIssuesOrReleases` into `{depth, issue}` rows.
- **Cell formatting** (`:288-376`): pure functions reading `issue.derivedTiming.*`, `issue.completionRollup.*`, `issue.rollupDates.*`, `issue.team.*`; values diffed against `issue.issueLastPeriod` via `compareToLast` into "last ➡ current" strings.
- **Interaction:** clicking the Estimated-Days cell opens the `EstimateBreakdown` popup (dense estimate-calculation breakdown) via a shared `SimpleTooltip` singleton.
- **React interop:** in `connected()` (`:389-397`), when `FEATURE_HISTORICALLY_ADJUSTED_ESTIMATES()` is on, it mounts the React `Stats` component (`src/react/Stats/Stats.tsx`) into `<div id="stats">` via `createRoot`, feeding it `value.from(this, 'primaryIssuesOrReleases')`.
- **Props:** consumes `primaryIssuesOrReleases` + `allIssuesOrReleases` (passed from the parent template; implicit, not declared). The declared `columns` prop is unused. Does **not** read routeData directly.

## CanJS surface

`StacheElement`, `stache.safeString` (`:176`), `key.get` (`:166-173`), `value.from` (`:393`). `type` + `ObservableObject` imported but unused. Stache `{{#for}}` / `{{#if}}` / `{{#eq|and|not}}`, `on:click`, `src:from`.

## Replacement plan

Port to a React report component and register it like the other React reports.

1. **New component** `src/react/reports/EstimationTable/EstimationTable.tsx` (name TBD). Consume `primaryIssuesOrReleases` / `allIssuesOrReleases` via `useCanObservable` (replaces the `value.from` bridge).
2. **Row building:** reuse `src/react/reports/GanttReport/GanttGrid/helpers/getChildren.ts` (`makeGetChildren`) + `helpers/rows.ts` (`buildGanttRows`) as the React analog of `makeGetChildrenFromReportingIssues` / the `{depth, issue}` flatten.
3. **Cells:** port the pure formatting fns (`estimatedDaysOfWork`, `timedDays`, `rolledUpDays`, `timingEquation`, `round`, `compareToLast`) verbatim into a `helpers/` module — they are framework-agnostic.
4. **EstimateBreakdown popup:** rebuild as a React modal/popover following `GanttGrid`'s `components/IssueTooltip` + `components/PercentCompleteModal` patterns. This is the bulk of the work (~188 lines of dense markup to translate).
5. **Stats:** `src/react/Stats/Stats.tsx` is already React — drop the imperative `createRoot` glue and render it directly as a child (still gated on `FEATURE_HISTORICALLY_ADJUSTED_ESTIMATES`).
6. **Wire-up:** add `'table': <EstimationTable .../>` to `urlParamValuesToReactComponents` (`timeline-report.js:41-50`) and delete the `{{# eq ... "table" }}` branch (`:97-101`).
7. Delete `src/canjs/reports/table-grid.js`.

## Reusable React pieces

`GanttGrid.tsx` + its `helpers/getChildren.ts`, `helpers/rows.ts`, `components/IssueRow`, `components/IssueTooltip`, `components/PercentCompleteModal`; `useCanObservable`; `Stats.tsx` (as-is).

## Risks / open questions

- Faithfully reproducing `EstimateBreakdown`'s calculation-breakdown markup and the "last ➡ current" diff formatting.
- Confirm the same rolled-up/derived issue shape (`derivedTiming`, `completionRollup`, `rollupDates`, `team`, `issueLastPeriod`) is what GanttGrid already consumes — expected yes, so no new data plumbing.
- Keep the `estimationTable` feature flag gating identical so behavior is unchanged when off.

## Why it's low-coupling / good standalone win

One consumer, existing React report-mounting infra (`attachReactReport` + the component map), no routeData or auth coupling, and the row/cell logic is small and pure. Independent of the auth work — can be done any time.

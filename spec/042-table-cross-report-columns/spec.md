# spec/042 — Table: columns from other reports

Sibling of [spec/012 table-and-grouper](../012-table-and-grouper/plan.md). Builds on the column
catalog ([column-source-registry.md](../012-table-and-grouper/column-source-registry.md),
[common-and-report-field-columns.md](../012-table-and-grouper/common-and-report-field-columns.md),
[rolled-back-columns.md](../012-table-and-grouper/rolled-back-columns.md)).

**Depends on [spec/043 Rollup Calculation settings & work rollup](../043-rollup-calculation-settings/spec.md)**
for the known / averaged / per-team rollup fields used in sections A and H.

## Goal

The Table report should be able to show the **per-issue values every other report computes**, so a
user can build one table that answers "what does the Gantt / Scatter / Flow Metrics / Estimation /
Auto-Scheduler report say about this issue?" without switching reports.

This spec inventories those values, states what each costs to expose, and proposes a phased order.

## Background

### How Percent Complete works (Gantt)

Two layers:

1. **Self (derived, per issue)** — `deriveWorkTiming()`
   ([work-timing.ts](../../src/jira/derived/work-timing/work-timing.ts)) computes
   `derivedTiming.totalDaysOfWork` and `derivedTiming.completedDaysOfWork`.
   - **Total working days** uses the first match:
     1. **dates** — business days between start and due (`datesDaysOfWork`), unless the team has
        _spread effort across dates_ on;
     2. **points-and-confidence** — `deterministicTotalPoints ÷ team.pointsPerDayPerTrack`, where
        `deterministicTotalPoints = median estimate × LOGNORMINV(confidence)` and
        `pointsPerDayPerTrack = velocity ÷ parallelWorkLimit ÷ daysPerSprint`;
     3. **points** — story points ÷ points-per-day;
     4. **dates** as a fallback.
   - **Completed working days** = (start → now) ÷ (start → due) × total working days.
2. **Rollup (per issue, across the hierarchy)** — `addPercentComplete()`
   ([percent-complete.ts](../../src/jira/rollup/percent-complete/percent-complete.ts)) attaches
   `completionRollup = { completedWorkingDays, totalWorkingDays, remainingWorkingDays, source }` using
   _childrenFirstThenParent_:
   - every child has real data → **sum of children** (`source: 'children'`);
   - else the issue has its own timing → **self** (`source: 'self'`);
   - else children exist → sum of children (soft data);
   - else → **average** total days of that hierarchy level, default 30 (`source: 'average'`).

`Percent Complete = round(completedWorkingDays × 100 ÷ totalWorkingDays)`
([percentComplete.ts](../../src/react/reports/GanttReport/GanttGrid/helpers/percentComplete.ts)).
The Gantt modal shows each child's Percent / Completed / Remaining / Total working days when the
value came from children, or the self-calculation boxes ("Calculation method:
points-and-confidence") when `source === 'self'`.

**Averages are mixed in early.** Each hierarchy level is finalized (averages written into its
`source: 'average'` items) _before_ its parent level sums children. So a parent's
`totalWorkingDays` already contains its descendants' averages, and nothing records how much. A
parent made mostly of unestimated epics shows `source: 'children'` and a confident-looking
percentage. A Done item with no estimate counts as average-sized and 100% complete. Fixed by
[spec/043](../043-rollup-calculation-settings/spec.md).

### What the Table already exposes ("Report Fields" group)

| sourceId                   | Label              | Reads                                                     |
| -------------------------- | ------------------ | --------------------------------------------------------- |
| `report:startDate`         | Start Date         | `issue.startDate`                                         |
| `report:dueDate`           | Due Date           | `issue.dueDate`                                           |
| `report:storyPoints`       | Story Points       | `issue.storyPoints`                                       |
| `report:storyPointsMedian` | Story Point Median | `issue.storyPointsMedian`                                 |
| `report:confidence`        | Confidence         | `issue.confidence`                                        |
| `estimation:estimatedDays` | Estimated Days     | `derivedTiming.deterministicTotalDaysOfWork` (or SP days) |
| `estimation:timedDays`     | Timed Days         | `derivedTiming.datesDaysOfWork`                           |
| `estimation:rolledUpDays`  | Rolled Up Days     | `completionRollup.totalWorkingDays` (= Gantt "Total")     |
| `report:percentComplete`   | Percent Complete   | `completionRollup` (click opens the Gantt modal)          |

**Gaps vs. Gantt:** Completed Working Days, Remaining Working Days, the rollup _source_, and the
self-calculation intermediates (calculation method, adjusted estimate, points/day/track, used
confidence) are not columns. Neither the Gantt nor the Table can separate known work from
averaged work, or break a total down by team.

**Estimation Analysis:** none of its values are in the Table today. Its per-issue values (actual
team days, actual ÷ estimate) only exist for _completed, estimated, dated_ issues; its headline
values (mean, variance) are **per team**.

## Rollup fields (from spec/043)

[spec/043](../043-rollup-calculation-settings/spec.md) replaces `completionRollup`'s fields with:

- `known*` — days from items' own size (dates or estimate, per the report's **Size work from**).
- `averaged*` — placeholder days for items without a size.
- `*WithAverages` — known + averaged (the old `totalWorkingDays` / `completedWorkingDays` /
  `remainingWorkingDays`).
- `unsizedIssueKeys` — lowest-level items without a size.
- `byTeam` — the same numbers per team; the parts add up to the totals.

The **Estimated effort** preset (Size work from = Estimate only, Items without a size = Leave
unsized, Parent vs. children = Larger) turns these into estimate-only numbers. The Table columns
below just read the fields; which work they count is set in Rollup Calculation.

## Cost tiers

| Tier                       | Meaning                                                                                                                                                                        | Implementation                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **T0 — on the issue**      | Already attached to every rolled-up issue the Table receives.                                                                                                                  | Accessor only (`getValue` + render).                                          |
| **T1 — per-issue derive**  | Pure function of one issue plus its changelog, which is **always** loaded (`expand: ['changelog']` in [jira-data-requests.js](../../src/stateful-data/jira-data-requests.js)). | Extract the report's helper into a shared module; call it per row (memoized). |
| **T2 — population derive** | Needs a pass over all issues (e.g. per-team stats).                                                                                                                            | Compute once per issue set in a shared hook; join onto rows by key or team.   |
| **T3 — simulation**        | Needs the Auto-Scheduler Monte Carlo (10,000 runs, main-thread batched).                                                                                                       | Only by reusing a shared simulation result; never per row.                    |

## Candidate catalog

`P1` = recommended first, `P2` = next, `P3` = later / on demand. Proposed sourceId namespaces:
`rollup:*` (already reserved in spec/012), `flow:*`, `estimate:*`, `status:*`, `team:*`,
`schedule:*`.

Existing aggregations are `sum`, `avg`, `min`, `max`, `count`, `range` (dates), `distinct`
([aggregations.ts](../../src/react/reports/TableReport/model/aggregations.ts)). **New** ones this
spec needs are marked _(new)_.

### A. Gantt — percent complete & timing (T0)

| Pri | sourceId                                                        | Label                                    | Reads                                                                                                                                                                                                                     | Type / agg         |
| --- | --------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| P1  | `rollup:completedWorkingDaysWithAverages`                       | Completed Working Days (with averages)   | `completionRollup.completedWorkingDaysWithAverages`                                                                                                                                                                       | number / sum       |
| P1  | `rollup:remainingWorkingDaysWithAverages`                       | Remaining Working Days (with averages)   | `completionRollup.remainingWorkingDaysWithAverages`                                                                                                                                                                       | number / sum       |
| P1  | `rollup:knownWorkingDays`                                       | Known Working Days                       | `completionRollup.knownWorkingDays`                                                                                                                                                                                       | number / sum       |
| P1  | `rollup:knownCompletedWorkingDays`                              | Completed Working Days (known only)      | `completionRollup.knownCompletedWorkingDays`                                                                                                                                                                              | number / sum       |
| P1  | `rollup:knownRemainingWorkingDays`                              | Remaining Working Days (known only)      | `completionRollup.knownRemainingWorkingDays`                                                                                                                                                                              | number / sum       |
| P1  | `rollup:averagedWorkingDays`                                    | Averaged Working Days                    | `completionRollup.averagedWorkingDays`                                                                                                                                                                                    | number / sum       |
| P1  | `rollup:knownPercentComplete`                                   | Percent Complete (known only)            | `computeKnownPercentComplete(issue)`                                                                                                                                                                                      | number (%) / ratio |
| P1  | `rollup:averagedShare`                                          | % of Work Averaged                       | `averagedWorkingDays ÷ workingDaysWithAverages`                                                                                                                                                                           | number (%) / ratio |
| P1  | `rollup:unsizedCount`                                           | Items Without a Size                     | `completionRollup.unsizedIssueKeys.length` (keys listed on hover)                                                                                                                                                         | number / sum       |
| P1  | `rollup:percentCompleteSource`                                  | Percent Complete Source                  | `completionRollup.source` (self / children / average)                                                                                                                                                                     | enum / distinct    |
| P2  | `estimation:calculationMethod`                                  | Calculation Method                       | `timingMethod(issue)` (dates / points-and-confidence / points / unknown) — export from [CalculationBreakdown.tsx](../../src/react/reports/GanttReport/GanttGrid/components/PercentCompleteModal/CalculationBreakdown.tsx) | enum / distinct    |
| P2  | `estimation:adjustedEstimate`                                   | Adjusted Estimate (pts)                  | `derivedTiming.deterministicTotalPoints`                                                                                                                                                                                  | number / sum       |
| P2  | `estimation:usedConfidence`                                     | Used Confidence                          | `derivedTiming.usedConfidence` (default-filled)                                                                                                                                                                           | number / avg       |
| P2  | `estimation:selfTotalDays`                                      | Self Total Working Days                  | `derivedTiming.totalDaysOfWork`                                                                                                                                                                                           | number / sum       |
| P2  | `estimation:selfCompletedDays`                                  | Self Completed Working Days              | `derivedTiming.completedDaysOfWork`                                                                                                                                                                                       | number / sum       |
| P3  | `estimation:probabilisticDays`                                  | Probabilistic Days                       | `derivedTiming.probablisticTotalDaysOfWork`                                                                                                                                                                               | number / sum       |
| P3  | `team:pointsPerDayPerTrack`                                     | Points / Day / Track                     | `team.pointsPerDayPerTrack`                                                                                                                                                                                               | number / avg       |
| P3  | `team:velocity`, `team:parallelWorkLimit`, `team:daysPerSprint` | Team Velocity / Tracks / Days per Sprint | `team.*`                                                                                                                                                                                                                  | number / avg       |

> `Rolled Up Days` (`estimation:rolledUpDays`) is relabeled **Total Working Days (with averages)**
> and keeps its sourceId and value, so saved reports don't change. `Percent Complete`
> (`report:percentComplete`) also keeps its value (with averages).

### B. Gantt / Scatter / Cards — rolled-up dates & status (T0)

| Pri | sourceId                                     | Label                              | Reads                                                                                                                                       | Type / agg           |
| --- | -------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| P1  | `rollup:startDate`                           | Rolled-up Start                    | `rollupDates.start`                                                                                                                         | date / range         |
| P1  | `rollup:dueDate`                             | Rolled-up Due (Target Delivery)    | `rollupDates.due`                                                                                                                           | date / range         |
| P1  | `rollup:status`                              | Timeline Status                    | `rollupStatuses.rollup.status` (complete / blocked / warning / behind / ahead / ontrack / notstarted / new / unknown); status-circle render | enum / worst _(new)_ |
| P1  | `rollup:dueSlip`                             | Due Date Slip (days)               | business days between `issueLastPeriod.rollupDates.due` and `rollupDates.due`                                                               | number / max         |
| P2  | `rollup:startSlip`                           | Start Date Slip (days)             | same, for start                                                                                                                             | number / max         |
| P2  | `rollup:statusReason`                        | Timeline Status Reason             | `rollupStatuses.rollup.statusFrom.message`                                                                                                  | text                 |
| P2  | `rollup:workType:{dev,qa,uat,design}:status` | Dev / QA / UAT / Design Status     | `rollupStatuses[type].status`                                                                                                               | enum / worst _(new)_ |
| P2  | `rollup:blockedCount`                        | Blocked Issues                     | `blockedStatusIssues.length` (keys listed on hover)                                                                                         | number / sum         |
| P2  | `rollup:warningCount`                        | Warning Issues                     | `warningIssues.length`                                                                                                                      | number / sum         |
| P2  | `rollup:childStatusBreakdown`                | Child Status Breakdown             | `childStatuses.children` grouped by status, e.g. "3 Done · 2 In Progress"                                                                   | text                 |
| P3  | `rollup:workType:{type}:start` / `:due`      | Dev / QA / UAT / Design Start, Due | `workTypeRollups.children[type].start` / `.due`                                                                                             | date / range         |
| P3  | `derived:workType`                           | Work Type                          | `derivedStatus.workType`                                                                                                                    | enum / distinct      |
| P3  | `derived:statusType`                         | Work Status Type                   | `derivedStatus.statusType`                                                                                                                  | enum / distinct      |

Sections A and B get previous-period variants for free via
[rolled-back-columns.md](../012-table-and-grouper/rolled-back-columns.md), since they read through
`issueLastPeriod` unchanged.

### C. Estimation Progress (T0, over descendants)

Per-row counts over the row's descendants; most useful at initiative / outcome level.

| Pri | sourceId                        | Label             | Reads                                           | Type / agg         |
| --- | ------------------------------- | ----------------- | ----------------------------------------------- | ------------------ |
| P2  | `estimate:childEpicCount`       | Child Epics       | descendant epic count                           | number / sum       |
| P2  | `estimate:estimatedEpicCount`   | Estimated Epics   | epics with (SP or SP median) **and** confidence | number / sum       |
| P2  | `estimate:unestimatedEpicCount` | Unestimated Epics | total − estimated                               | number / sum       |
| P2  | `estimate:estimationCoverage`   | % Estimated       | estimated ÷ total                               | number (%) / ratio |
| P3  | `estimate:isEstimated`          | Is Estimated      | this issue has SP-or-median **and** confidence  | enum / count       |

Extract the counting in `getReportingData()`
([EstimationProgress.tsx](../../src/react/reports/EstimationProgress/EstimationProgress.tsx)) into a
pure helper shared by both reports.

### D. Estimation Analysis (T1 per issue, T2 per team)

| Pri | sourceId                          | Label                      | Reads                                          | Tier | Notes                                                                                                                                                 |
| --- | --------------------------------- | -------------------------- | ---------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2  | `estimate:actualTeamDays`         | Actual Team Days           | `computedActualTeamDaysOfWork`                 | T2   | Spreads each team's daily capacity across its overlapping issues, so it needs the team's whole issue set. Blank unless completed + estimated + dated. |
| P2  | `estimate:actualOverEstimate`     | Actual ÷ Estimate          | `computedActualDaysOfWorkPerEstimatedTeamDays` | T2   | Same population; render as `1.4×`.                                                                                                                    |
| P2  | `team:estimateAccuracyMean`       | Team Accuracy (mean A/E)   | `TeamTimings.mean`, joined by `team.name`      | T2   | Per team: identical on every row of a team. Best with Group by Team.                                                                                  |
| P3  | `team:estimateVariance`           | Team Precision (variance)  | `TeamTimings.variance`                         | T2   | Same.                                                                                                                                                 |
| P3  | `estimate:inAccuracySample`       | In Accuracy Sample         | `issueWasEstimatedDatedAndCompleted()`         | T1   | Explains blanks in the two per-issue columns.                                                                                                         |
| P3  | `estimate:historicalAdjustedDays` | Historically Adjusted Days | `historicalAdjustedEstimatedTime`              | T2   | Estimate scaled by the team's historical pace. Computed but not displayed by any report today.                                                        |

Source: `getTeamTimingData()` in
[actual-vs-estimated.ts](../../src/jira/rollup/historical-adjusted-estimated-time/actual-vs-estimated.ts).

### E. Flow Metrics (T1)

| Pri | sourceId              | Label                 | Reads                                                                      | Type / agg                                |
| --- | --------------------- | --------------------- | -------------------------------------------------------------------------- | ----------------------------------------- |
| P1  | `flow:inProgressDate` | Started (In Progress) | `getInProgressDate()` — last To Do → In Progress transition                | date / range                              |
| P1  | `flow:doneDate`       | Done Date             | `getDoneDateFromChangelog()` — last transition into a Done-category status | date / range                              |
| P1  | `flow:cycleTime`      | Cycle Time (days)     | done − in progress + 1 (only when both exist)                              | number / avg, median _(new)_, p85 _(new)_ |
| P1  | `flow:wipAge`         | WIP Age (days)        | now − in progress + 1 (only while not done)                                | number / avg, max                         |
| P3  | `flow:leadTime`       | Lead Time (days)      | done − created + 1 (not in Flow Metrics today; trivial)                    | number / avg                              |

Source: [metrics.ts](../../src/react/reports/FlowMetrics/metrics.ts),
[adapter.ts](../../src/react/reports/FlowMetrics/adapter.ts). Move the per-issue helpers and
`buildStatusCategoryMap` into `src/jira/derived/` so both reports share them. Grouping the Table by
team / issue type then reproduces Flow Metrics' cards through column aggregation.

### F. Time in Status (T1)

| Pri | sourceId                        | Label                  | Reads                                         | Type / agg               |
| --- | ------------------------------- | ---------------------- | --------------------------------------------- | ------------------------ |
| P2  | `status:timeIn:<statusName>`    | Time in "<status>"     | `getStatusDurationsMap(issue).get(status)`    | number (days) / avg      |
| P2  | `status:timeInCurrent`          | Time in Current Status | duration of the active status (now − entered) | number (days) / avg, max |
| P3  | `status:enteredAt:<statusName>` | Entered "<status>"     | `getStatusEntryDatesMap(issue).get(status)`   | date / range             |

Dynamic: one column per status seen in the loaded changelogs, offered in a "Time in Status"
sub-group of the Add-column menu. Source:
[TimeInStatus.tsx](../../src/react/reports/TimeInStatus/TimeInStatus.tsx) — extract the two map
builders into a pure module.

### G. Auto-Scheduler (T3, except Blocked By)

| Pri | sourceId                | Label                      | Reads                              | Notes                                                    |
| --- | ----------------------- | -------------------------- | ---------------------------------- | -------------------------------------------------------- |
| P2  | `schedule:blockedBy`    | Blocked By / Blocks        | `linkedBlockedBy` / `linkedBlocks` | **T1** — from Jira "Blocks" links, no simulation needed. |
| P3  | `schedule:mustStart`    | Must Start                 | `startDateWithTimeEnoughToFinish`  | Depends on the uncertainty slider and start date.        |
| P3  | `schedule:mustEnd`      | Must End                   | `dueDateTop`                       | Same.                                                    |
| P3  | `schedule:earliestEnd`  | Earliest End               | `dueDateBottom`                    | Same.                                                    |
| P3  | `schedule:adjustedDays` | Adjusted Days              | `adjustedDaysOfWork`               | Same.                                                    |
| P3  | `schedule:criticality`  | Criticality %              | `criticalityIndex`                 | Fraction of runs on the driving chain.                   |
| P3  | `schedule:daysAdded`    | Days Added (critical path) | `sequencingDaysAdded`              | Meaningful for epics.                                    |
| P3  | `schedule:queuedDays`   | Mean Queued Days           | `meanQueuedDays`                   | Capacity delay.                                          |

Simulation columns are only feasible if the simulation result is lifted into a shared, cached
service the Table can subscribe to (with a "simulating…" cell state). Defer until there is demand.

### H. Estimated time by team (T0, from `byTeam`)

The user goal: estimated time for an initiative, and summed for a particular team.

| Pri | sourceId                                           | Label                   | Reads                                                      | Type / agg   |
| --- | -------------------------------------------------- | ----------------------- | ---------------------------------------------------------- | ------------ |
| P1  | `rollup:team:<teamName>:knownWorkingDays`          | Known Days · <Team>     | `completionRollup.byTeam[team].knownWorkingDays`           | number / sum |
| P1  | `rollup:team:<teamName>:knownRemainingWorkingDays` | Remaining Days · <Team> | known − known completed for that team                      | number / sum |
| P2  | `rollup:team:<teamName>:averagedWorkingDays`       | Averaged Days · <Team>  | `byTeam[team].averagedWorkingDays`                         | number / sum |
| P2  | `rollup:teamBreakdown`                             | Team Breakdown          | `byTeam` as text, largest first: "Team A 80d · Team B 40d" | text         |

Dynamic: one column per team found in the loaded issues' `byTeam`, offered in a "By team"
sub-group of the Add-column menu, persisted by team **name** (a team absent from the current data
renders `—`).

How the two questions are answered:

- **Estimated time for initiatives:** Hierarchy rows from Initiative, the **Estimated effort**
  preset, and Known Working Days + Items Without a Size + Team Breakdown.
- **Time for a particular team:** add `Known Days · Team A`. Every row (initiative, epic) shows
  Team A's share, and the parts add up to the row's total. Because the value is per row, there's
  no double counting from mixing levels, and no dependency on the initiative's own team field.
- Alternative with no new columns: Hierarchy From = To = Epic, Group by Team, sum Known Working
  Days. Correct only when epics are the level that carries estimates.

### Not candidates

- Aggregate-only visuals: throughput, histograms, team heatmaps, plan spread, dependency floor,
  critical-path routes, Estimation Progress bar widths. The Table's group aggregations cover the
  useful ones.
- Report of Reports — composes other reports; no data of its own.

## Design decisions (confirm before building)

1. **Add-column menu grouping.** Recommend sub-groups named after the source report ("Gantt /
   Timeline", "Estimation", "Flow", "Time in Status", "Auto-Scheduler") under Report Fields, so a
   user can find "the value I saw in the Gantt".
2. **Clickable explanations.** Percent Complete already opens the Gantt modal. Recommend the same
   for `rollup:status` (status-reason popover) and `estimation:calculationMethod` (self-calculation
   modal).
3. **Per-team values on issue rows** (`team:*`). Recommend allowing them; each cell shows the team's
   value.
4. **Dynamic Time-in-Status columns.** Recommend persisting by status **name**
   (`status:timeIn:In Review`); a status absent from the current data renders `—`.
5. **New aggregations.** `median` and `p85` (Flow) and `worst` (status severity — spec/012 already
   lists "Worst Status" as a future reducer).
6. **Shared helpers, not report imports.** Each computation moves to `src/jira/derived/` or
   `src/jira/rollup/` (pure, tested); both the source report and the Table import it. The Table
   must not import report React components for data.

**Decided** (percent columns in group rows):

- Averaging row percentages misweights them: a 2-day item counts as much as a 200-day item (100%
  and 10% → `avg` 55%, true 11%). This affects group-header and cross-tab cells only; hierarchy
  parent rows already show their own correctly weighted rollup.
- Add a _(new)_ `ratio` aggregation: Σ numerator ÷ Σ denominator over the group's rows. It is the
  default for the percent columns:

  | Column                                  | Numerator                          | Denominator               |
  | --------------------------------------- | ---------------------------------- | ------------------------- |
  | `report:percentComplete`                | `completedWorkingDaysWithAverages` | `workingDaysWithAverages` |
  | `rollup:knownPercentComplete`           | `knownCompletedWorkingDays`        | `knownWorkingDays`        |
  | `rollup:averagedShare`                  | `averagedWorkingDays`              | `workingDaysWithAverages` |
  | `estimate:estimationCoverage` (Phase 2) | estimated epic count               | child epic count          |

- **Column definition change:** reducers today receive only the displayed value. Add an optional
  `ratioParts?: (issue) => { numerator: number; denominator: number } | null` to
  `ColumnDefinition` ([columns.ts](../../src/react/reports/TableReport/model/columns.ts)); `ratio`
  is offered only for columns that define it. A denominator of 0 renders `—`.
- **Saved reports:** a column with a persisted `aggregation` override (e.g. `avg`) keeps it; only
  columns without an override get the new `ratio` default.
- **Known limitation (unchanged):** if a group contains both a parent and its descendants (flat
  mode, multiple levels), their days are counted twice — the same flaw `sum` on Rolled Up Days has
  today. Counting only the top-most rows per group is a separate decision.

**Decided** (rollup fields): see [spec/043](../043-rollup-calculation-settings/spec.md) —
known / averaged / with-averages naming, per-team breakdown, and the report-level Rollup
Calculation settings. `estimation:rolledUpDays` keeps pointing at the with-averages total,
relabeled **Total Working Days (with averages)**.

## Proposed phases

1. **Phase 1 — estimated time (T0; needs spec/043 phase 1):** A-P1 working-day, percent, and
   unsized columns; H-P1 per-team columns; `ratioParts` + `ratio` aggregation (default for the
   percent columns); relabel Rolled Up Days. Pairs with spec/043 phase 2 for the Estimated effort
   preset.
2. **Phase 2 — timeline (T0/T1):** B-P1 Rolled-up Start / Due, Timeline Status (+ `worst`
   aggregation), Due Date Slip — **plus the Compare slider in the Table controls** (designed in
   [rolled-back-columns.md](../012-table-and-grouper/rolled-back-columns.md), not built; without
   it, slip is always against 15 days ago); B-P2; E-P1 Flow columns (+ `median` / `p85`); A-P2
   calculation intermediates; C Estimation Progress counts.
3. **Phase 3 (T1/T2):** F Time in Status columns; D Estimation Analysis per-issue and per-team
   values; `schedule:blockedBy`.
4. **Phase 4 (T3, on demand):** G Auto-Scheduler simulation columns via a shared simulation service.

## Testing

- Rollup engine tests live in [spec/043](../043-rollup-calculation-settings/spec.md).
- `aggregations.test.ts`: `ratio` sums numerators and denominators (2/2 + 20/200 → 11%), skips rows
  whose `ratioParts` is `null`, renders `—` for a 0 denominator, and is only offered for columns with
  `ratioParts`.
- Each extracted helper gets colocated unit tests (reuse the source report's existing fixtures).
- `buildColumnCatalog.test.ts`: new columns are offered in the right group with the expected
  render / compare / aggregate; per-team columns appear for each team in `byTeam`.
- Parity tests: for a fixture issue set, each Table column equals what the source report shows
  (Percent Complete modal totals, Flow cycle time, Time in Status durations, Estimation Progress
  counts).

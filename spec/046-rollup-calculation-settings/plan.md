# spec/046 — Plan (first pass)

Implements [spec.md](./spec.md) in three phases, gated behind a Features-tab toggle. The Work
settings are **only** what [mockups/sizing-picture.html](./mockups/sizing-picture.html) shows
(_Size each item by_ + fallbacks + "If it still has no size"), not the spec's Work table. The spec's
Estimate value, Missing confidence, Mark complete by, Parent vs. children and presets are not built;
those behave as today (confidence-adjusted estimate, missing confidence = 50%, progress from dates,
children then parent).

**Update 2026-11-24:** see [spec § Scope: epics only](./spec.md#scope-epics-only). The Work settings
apply only to epics; other levels use `legacyWorkSize`. Sizes are in today's units (no ÷ tracks).
`sizeBy` defaults to `dates` (no "not set"). The epic level's work rollup follows its date rollup
setting. Other work only loads epics.

## Gate

`features.ts` gets one entry: **Rollup Calculation** (`rollupCalculation`, off by default). The flag
gates the **UI only**:

- Flag off: the sidebar section stays "Timing Calculation" (dates only), the Gantt modal is unchanged.
- Flag on: the section is renamed "Rollup Calculation" with **Dates** and **Work** parts, and the
  Gantt modal shows the known/averaged additions.

The Work route params apply whether or not the flag is on, the same way `loadBlockers` does: a URL
or saved report that carries them renders the same for everyone. With no Work params, everything
is computed exactly as today.

## Decisions that differ from the spec

1. **Sizing is a rollup stage, not part of `deriveWorkTiming()`.** A new
   `src/jira/rollup/work-size/` stage runs in `addRollups()` just before `addPercentComplete()` and
   adds `workSize: { totalDaysOfWork, completedDaysOfWork, sizeFrom }` to each issue. Reasons:
   team time needs every item in a team and level anyway (spec: "after derive and before rollup");
   changing a setting won't re-derive every issue through the request pipeline; and `derivedTiming`
   stays exactly as the Auto-Scheduler and Estimation Analysis read it. The rollback path runs
   `addRollups()` too, so `issueLastPeriod` gets the same sizing. `sizeFrom` lives on `workSize`
   rather than `derivedTiming`.
2. **No Work params = today's sizing ("legacy").** `workSize` copies `derivedTiming.totalDaysOfWork`
   / `completedDaysOfWork` exactly, which still honors each team's Spread effort toggle and keeps
   estimates in track-days. Picking anything under _Size each item by_ switches the report to
   report-level sizing in **team-days**, and the team toggle stops mattering for that report.
   - So **Spread effort is not removed** in this pass. That avoids the migration and the one-time
     notice: a report without the param still honors each team's setting, including per-team
     overrides. The Work section says so while no sizing is chosen.
   - **Team time is not the default yet.** Open question 3 (keeping saved reports on today's
     sizing) is still open. Team time is listed first, as in the mockup, but a report only uses it
     once someone picks it. Making it the default for new reports is one line once that's decided.

## Route params

All report-level, saved with the report. A value equal to the default is left out of the URL.

| Setting (mockup label)                      | Route key               | Values                                                                      | Default        |
| ------------------------------------------- | ----------------------- | --------------------------------------------------------------------------- | -------------- |
| Size each item by                           | `workSizeBy`            | `teamTime` · `estimate` · `dates` · `''` (legacy)                           | `''`           |
| If it has no dates / If it has no estimate  | `workSizeFallback`      | `estimate` · `dates` · `teamTime` · `none` (allowed set depends on primary) | per primary¹   |
| If it has dates but no estimate (team time) | `workNoEstimate`        | `averagePace` · `leaveOut`                                                  | `averagePace`  |
| Include the team's other overlapping work   | `workTeamTimeOtherWork` | boolean                                                                     | `false`        |
| If it still has no size                     | `workMissingSize`       | `levelAverage` · `unsized`                                                  | `levelAverage` |

¹ Primary `teamTime` or `dates` → `estimate` (a checkbox, "Use its estimate"; off = `none`).
Primary `estimate` → `dates` (radios: date span / team time / don't use dates). An invalid
combination falls back to the primary's default.

`workMissingSize` applies with nothing picked too (it's about the rollup, not how an item is
sized).

## Phase 1 — Rollup split (no behavior change)

`src/jira/rollup/percent-complete/percent-complete.ts`

- Replace `PercentCompleteRollup` with the spec's `WorkRollup` (known / averaged / `*WithAverages`
  getters / `unsizedIssueKeys` / `byTeam`), source `'self' | 'children' | 'average' | 'unsized'`.
- `childrenFirstThenParent` only. Own data reads `issue.workSize` (Phase 1: legacy values, which
  are `derivedTiming`'s). Averages go into `averaged*`, not `known*`; `finalizeMetadata` adds the
  average to `averagedWorkingDays` (and to completed for Done items, as today).
- `byTeam` keyed by `issue.team.name`; releases have no team and never use their own data.
- Remove the dead `widestRange` and the commented-out code.

Consumers (rename; read `*WithAverages`):

- Gantt `computePercentComplete` + new `computeKnownPercentComplete`; `types.ts`; `fixtures.ts`;
  stories; `PercentCompleteModal` (Row, average box).
- Table `buildColumnCatalog` (`estimation:rolledUpDays`, `report:percentComplete`),
  `estimationTypes.ts`, stories/tests.
- Type stubs: `Stats.tsx`, `EstimateAnalysis.tsx`, `AutoScheduler.tsx`.

Gantt modal additions (flag on): child table adds **Known %** and **Averaged Days**; header line
"N of M working days are averaged · K items have no size"; `SelfCalculationBox` reads
`workSize.sizeFrom` instead of `team.spreadEffortAcrossDates` (falls back to today's logic when an
issue has no `workSize`).

Tests: existing `percent-complete.test.ts` expectations rewritten to the new fields with the same
numbers (known + averaged = old totals), plus `unsizedIssueKeys` and Σ `byTeam` = totals.

## Phase 2 — Work settings

**Rollup stage** `src/jira/rollup/work-size/work-size.ts`:
`addWorkSize(issues, settings, levels, { now, otherWork })` → issues with `workSize`.

- Estimate (team-days) = track-day estimate ÷ `parallelWorkLimit`, where the track-day estimate is
  read as today: `deterministicTotalDaysOfWork` if the median is valid, else `storyPointsDaysOfWork`.
- Date span = `derivedTiming.datesDaysOfWork` (fields or sprints), 1 team-day per business day.
- Size = first of [primary, fallback] that has a value. `sizeFrom` records which.
- Completed (non-team-time) = size × elapsed fraction, with today's one-date rules.

**Rollup** gains `workMissingSize = unsized`.

**Route data**: the params above, a small enum-param helper over
`saveJSONToUrlButAlsoLookAtReport_DataWrapper`, and a `workSettings` getter the view model passes to `rollupAndRollback()` → `addRollups()`.

**UI** (`TimingCalculation` → Rollup Calculation, flag on): Dates (existing selects) then Work:

- _How much work is an item?_ — Size each item by (team time first) + fallbacks + "If it still has
  no size", laid out like the mockup. With nothing picked, no radio is checked and a note says the
  report uses today's sizing.

Tests: `work-size.test.ts` (each primary × fallback, team-days, completed days);
`work-rollup.test.ts` (known vs. averaged, unsized, gaps, Σ `byTeam` = totals); component tests.

## Phase 3 — Team time

In `work-size.ts`, per team (`team.name`) and per hierarchy level, for items with both a start and
a due date:

- density = estimate team-days ÷ date span; with no estimate, `averagePace` uses the group's average
  density (1 if none) and `leaveOut` drops the item from the split (it falls through to the fallback).
- Each business day (same day stepping as `getBusinessDatesCount`, so a lone item's team time equals
  its date span) is split among the active items by density. An item's team time = Σ its shares.
- **Completed = Σ its shares on days up to today.**

**Other overlapping work:** the `workTeamTimeOtherWork` checkbox sits under the team-time option.

- Off: always shows the warning ("Team time only counts work loaded in this report…").
- On, and team time is the main rule or the fallback: route data's `teamTimeOtherWork` runs
  `loadTeamOtherWork()` (`work-size/other-work.ts`) and the view model passes the result to
  `rollupAndRollback()` as `otherWork`, which only splits days. The sidebar shows progress
  ("1 of 3 teams") and then the result line with its limits and any teams that failed.
- **One JQL query per team**, from the loaded items that have both dates:
  - team: the Team field by its id (`cf[n] = "<uuid>"`), or `project = "KEY"` when the team falls
    back to its project key; a team found by neither is skipped;
  - per hierarchy level: the same issue types, with that team's configured start/due fields (as
    field ids) overlapping the earliest start → latest due of its loaded items at that level.
- Results are normalized and derived with the report's configuration and fields, then kept only if
  they land on the same team and level and aren't already loaded.
- A load starts only when the queries or fields change, so re-deriving doesn't refetch.
- Not loaded for sample data (logged out), for embedded report-of-reports children, or for the
  compare-to period (other work has no history, so `issueLastPeriod` sizes without it).

Tests: the spec's worked example (A = B = 8), a lone item = span, leave-out vs average pace,
completed to date, `otherWork` shrinking an item's team time; `other-work.test.ts` (query per
team, Team field / project fallback, per-team date fields, filtering, failed teams).

## Not in this pass

- Removing Spread effort and its migration (see decision 2).
- Team time as the default for new reports (open question 3).
- spec/045 table columns (known/averaged/per-team).

## Implementation notes (first pass)

Built as planned, with these additions found along the way:

- **Report-of-reports.** Each Work param is also a `CHILD_PARAMS` entry, and `ChildReportConfig`
  has its own `workSettings`, so an embedded report keeps its own sizing (the drift test requires
  this). `addRollups` treats missing settings as the defaults.
- **The flag outside the settings providers.** Reports and their modals render outside the
  storage/query providers, so the modal reads the flag through `useCachedFeatureFlag` (the shared
  `queryClient` cache, which the sidebar fills). It takes a `showWorkBreakdown` prop to override.
- **Modal header:** shows the averaged/unsized line and how a self-sized issue was sized. It doesn't
  list the other active Work settings yet: the modal is also rendered by the Table report, and
  pulling route data into it would make its tests load the whole route-data module.
- The nav button reads "Rollup" instead of "Timing" when the flag is on.

Files: `src/jira/rollup/work-size/{work-settings,work-size,other-work}.ts`,
`src/jira/rollup/percent-complete/percent-complete.ts`, `TimingCalculation/components/WorkSettings/`,
`TimingCalculation/hooks/useWorkSettings/`, `services/features/useCachedFeatureFlag.ts`.

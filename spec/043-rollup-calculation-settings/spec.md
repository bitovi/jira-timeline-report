# spec/043 — Rollup Calculation settings & work rollup

Prerequisite for [spec/042 Table: columns from other reports](../042-table-cross-report-columns/spec.md).

## Goal

One **configurable work rollup** that drives Percent Complete (Gantt, Table) _and_ estimated-time
reporting (initiative totals, per-team sums), with:

1. **Known vs. averaged work** carried separately, so a total can say how much of it is guessed.
2. **A per-team breakdown** at every level, so an initiative can say "Team A 80d, Team B 40d" and
   the parts always add up to the total.
3. **Report-level settings** for how work is sized, rolled up, and marked complete. Every default
   reproduces today's behavior, **except sizing**: new reports default to team time over dates
   (see [§Team time over dates](#team-time-over-dates)); saved reports keep today's sizing.

"Estimated effort only" is not a separate rollup; it is this rollup with
**Size work from = Estimate only** and **Items without a size = Leave unsized**.

## Today

- **Sizing** (`deriveWorkTiming()` in
  [work-timing.ts](../../src/jira/derived/work-timing/work-timing.ts)): an item's
  `totalDaysOfWork` is its **date span** if it has dates, unless the team's
  `spreadEffortAcrossDates` toggle is on, in which case the **estimate** wins. Missing confidence
  defaults to 50% (`getDefaultConfidenceDefault`).
- **Progress**: `completedDaysOfWork` is always date-based (elapsed share of start → due). Status is
  ignored, except an averaged (no-size) item that is Done counts as fully complete.
- **Rollup** (`addPercentComplete()` in
  [percent-complete.ts](../../src/jira/rollup/percent-complete/percent-complete.ts)): always
  _children first, then parent_. Items with no size get the hierarchy level's average (default
  30). Averages are folded into `totalWorkingDays` before parents sum children, so the guessed
  portion is invisible. `addPercentComplete` already receives the per-level Timing settings but
  ignores them (commented-out code).
- **Settings UI**: "Timing Calculation"
  ([TimingCalculation.tsx](../../src/react/SettingsSidebar/components/TimingCalculation/TimingCalculation.tsx))
  sets, per hierarchy level, how **dates** roll up (route key `timingCalculations`, default
  `widestRange`). Team Configuration has the "Spread effort" toggle (per team, per level).

## Settings

Rename the sidebar section **Timing Calculation → Rollup Calculation**, with two parts.

### Dates (existing, unchanged)

Per level: From parent, then children · From children · From children, then parent · Earliest to
latest · From parent. Route key `timingCalculations`.

### Work (new)

All report-level, saved in the URL with the report (same pattern as `timingCalculations`). A
param equal to its default is omitted from the URL.

| Setting                             | Route key                | Choices                                                                                                                 | Default (= today)         |
| ----------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **Size work from**                  | `workSizeFrom`           | `datesFirst` Dates, then estimate · `estimateFirst` Estimate, then dates · `estimateOnly` Estimate only                 | `datesFirst`              |
| **Estimate value**                  | `workEstimateValue`      | `confidenceAdjusted` Median × LOGNORMINV(confidence) · `median` Median only                                             | `confidenceAdjusted`      |
| **Missing confidence**              | `workMissingConfidence`  | `assume50` Assume 50% · `unsized` Treat as no estimate                                                                  | `assume50`                |
| **Items without a size**            | `workMissingSize`        | `levelAverage` Use the level's average · `unsized` Leave unsized (count them, add 0 days)                               | `levelAverage`            |
| **Parent vs. children** (per level) | `workRollupCalculations` | `childrenFirstThenParent` Children, then parent · `larger` Larger of parent or children · `childrenOnly` · `parentOnly` | `childrenFirstThenParent` |
| **Mark complete by**                | `workCompleteBy`         | `dates` Dates · `datesStatusWins` Dates, but status wins · `status` Status only                                         | `dates`                   |

**Size work from replaces the team "Spread effort" toggle** (decided: report-level only). Spread
off = `datesFirst`; spread on = `estimateFirst`. See [§Migration](#migration-of-spread-effort).

#### Presets

A preset picker above the Work options sets several at once (the options stay editable):

| Preset                         | Size from      | Items without a size | Parent vs. children   |
| ------------------------------ | -------------- | -------------------- | --------------------- |
| **Timeline** (default / today) | `datesFirst`   | `levelAverage`       | Children, then parent |
| **Estimated effort**           | `estimateOnly` | `unsized`            | Larger                |

## Per-issue size and progress (derive stage)

`deriveWorkTiming()` takes the Work settings (via `deriveIssue` options) instead of reading
`team.spreadEffortAcrossDates`, and adds `derivedTiming.sizeFrom: 'dates' | 'estimate' | null`.

**Estimate days**

- `confidenceAdjusted`: `deterministicTotalDaysOfWork` when a median is valid, else
  `storyPointsDaysOfWork` when plain story points are valid.
- `median`: `storyPointsMedianDaysOfWork`, else `storyPointsDaysOfWork`.
- `workMissingConfidence = unsized`: a median with no confidence is not an estimate (plain story
  points still are).

**Size** (`totalDaysOfWork`)

| `workSizeFrom`  | Size                                     |
| --------------- | ---------------------------------------- |
| `datesFirst`    | date span ?? estimate days               |
| `estimateFirst` | estimate days ?? date span               |
| `estimateOnly`  | estimate days (date-only items: no size) |

**Completed** (`completedDaysOfWork`). `fraction` = elapsed share of start → due (0 before start, 1
after due, 0 with no dates).

| `workCompleteBy`  | Completed                                         |
| ----------------- | ------------------------------------------------- |
| `dates`           | size × fraction                                   |
| `datesStatusWins` | Done → size; To Do → 0; otherwise size × fraction |
| `status`          | Done → size; otherwise 0                          |

`size × fraction` matches today's result both with spread off (size = span, so it equals elapsed
days) and with spread on. Items with only one date keep today's handling: start only → elapsed
days capped at size; due only → 0 until the due date, then size.

## Team time over dates

A third way to size an item, explored in [mockups/sizing-picture.html](./mockups/sizing-picture.html):
the **team-days the team actually spends on it over its dates**. Unlike estimate and date span it
depends on the other items, so it is computed per **team** and per **hierarchy level** (otherwise a
parent and its children would compete for the same days) after derive and before rollup.

### Units: team-days

A **team-day** is one business day of the whole team. All sizing in the new settings is reported in
team-days, per item, per team, and in totals. Organizations often know what a team-day costs, so
team-days × that rate gives an item's rough cost.

- **Team time** is in team-days (below).
- **Estimate** in team-days = points ÷ the team's velocity (`totalPointsPerDay`), which is today's
  track-day estimate ÷ `parallelWorkLimit`.
- **Date span** counts each business day in the span as 1 team-day.
- **Track-days** (today's estimate unit, points ÷ `pointsPerDayPerTrack`) stay internal: the
  Auto-Scheduler and estimate breakdowns still use them. A track is a slot for one piece of work at
  a time (a 12-person team might run 3 epics at once), not a person, so track-days aren't
  comparable across teams any more than team-days are. Tracks don't affect sizing.
- Legacy sizing on saved reports (see Default below) keeps today's units.

### Calculation

**Inputs.** Each item with both a start and a due date: its business days, and its **density** =
estimate team-days ÷ date span. Items without both dates get no team time (they fall back).

Items with dates but no estimate follow the setting **If it has dates but no estimate** (only
shown when sizing by team time):

- **Use the team's average pace** (default): density = the average density of the team's items at
  that level that have both (1 if none).
- **Leave it out of team time**: the item is not active on any day, so the other items get its
  days (or the team is idle). It gets no team time and falls through to the next rule (estimate,
  then "If it still has no size").

**Each business day:**

1. Active items = items whose dates include the day.
2. Split the day (1 team-day) among the active items in proportion to density.
3. Days with no active item go to nobody.

An item's team time is the sum of its daily shares. So team time ≤ date span, and a team's team
time at a level adds up to its busy days (days with at least one active item).

**Worked example.** Epics A and B are each estimated at 8 team-days. A runs days 1–12; B runs days
5–16 (A alone for 4 days, then both, then B alone for 4).

| Days 1–4 (A alone) | Days 5–12 (both) | Days 13–16 (B alone) | A   | B   |
| ------------------ | ---------------- | -------------------- | --- | --- |
| A 1/day            | 0.5 each/day     | B 1/day              | 8   | 8   |

A takes all of the team's time while alone, then they share, then B gets it all. The result is
the same whatever the team's track count.

Rejected alternatives:

- **Hand out `tracks` track-days a day, no cap** — a lone item absorbs every track (A = 16 at 2
  tracks, 24 at 3).
- **Hand out `tracks` track-days a day, at most 1 per item** — treats a track as a person on one
  item, so a lone item leaves capacity idle and size depends on the track setting (A = 12 at 2
  tracks).
- **Cap each item at its own pace** (≤ density per day) — forces an even pace, so A can't take the
  whole day while alone (A = 6.7).

### Across teams

Totals and percent complete that span teams (initiatives) are weighted by team-days, so a day of
any team counts the same. That matches cost only when teams cost about the same per day.

Follow-up (not in this spec): an optional **cost per team-day** on each team, so cross-team totals
can be shown as cost and percent complete weighted by cost.

### Default

Team time is the **first option** and the **default for new reports**, with
the fallback chain team time → estimate → level average. Saved reports keep today's sizing (date
span → estimate, or estimate first where Spread effort was on). See open question 3.

Open: the option's name (e.g. "Its share of team time").

## Work rollup

`completionRollup` keeps its name; its fields are replaced, so the compiler flags every consumer.

### Vocabulary

- **Known** work — days from an item's own size (dates or estimate, per Size work from).
- **Averaged** work — placeholder days for an item without a size (only with
  `workMissingSize = levelAverage`).
- **With averages** — known + averaged.
- **Unsized** issues — items without a size (averaged or left unsized), listed so a total can say
  "3 of 8 epics have no size".

### Shape

```ts
type TeamWork = {
  knownWorkingDays: number;
  knownCompletedWorkingDays: number;
  averagedWorkingDays: number;
  averagedCompletedWorkingDays: number;
};

type WorkRollup = {
  source: 'self' | 'children' | 'average' | 'unsized';
  userSpecifiedValues: boolean; // unchanged: every contributing item had a size

  knownWorkingDays: number;
  knownCompletedWorkingDays: number;
  readonly knownRemainingWorkingDays: number;

  averagedWorkingDays: number;
  averagedCompletedWorkingDays: number;
  readonly averagedRemainingWorkingDays: number;

  readonly workingDaysWithAverages: number; // old totalWorkingDays
  readonly completedWorkingDaysWithAverages: number; // old completedWorkingDays
  readonly remainingWorkingDaysWithAverages: number; // old remainingWorkingDays

  unsizedIssueKeys: string[]; // all descendants (and self) without a size; informational
  byTeam: Record<string, TeamWork>; // keyed by team name; Σ byTeam = totals
};
```

### Rules

**An issue's own data** (leaf, or when the parent's own size is used):

| Issue                   | `source`  | known    | averaged                                                   |
| ----------------------- | --------- | -------- | ---------------------------------------------------------- |
| Has a size              | `self`    | own size | 0                                                          |
| No size, `levelAverage` | `average` | 0        | level average; completed by Mark complete by (Done → 100%) |
| No size, `unsized`      | `unsized` | 0        | 0                                                          |

**Parent vs. children** (keyed by the parent's type, like `timingCalculations`):

| Method                    | Uses children's sum when…                                                  | Otherwise                |
| ------------------------- | -------------------------------------------------------------------------- | ------------------------ |
| `childrenFirstThenParent` | every child has a size; or the parent has no size and has children (today) | parent's own             |
| `larger`                  | the parent has no size, or children's **known** ≥ parent's own size        | parent's own (see below) |
| `childrenOnly`            | the issue has children                                                     | issue's own data (leaf)  |
| `parentOnly`              | never                                                                      | issue's own data         |

- Children's sum = Σ each child's known, averaged, `unsizedIssueKeys`, and `byTeam` (merged).
- **Parent's own** → `source: 'self'`; all days go to the parent's team in `byTeam`.
- **`larger`, parent wins** → known = parent's own size; averaged = 0 (the parent's estimate covers
  its children). `byTeam` keeps the children's **known** amounts and adds the remainder (parent −
  children's known) to the parent's team (decided).
- **Gaps are always reported:** `unsizedIssueKeys` is the union of every descendant's
  `unsizedIssueKeys` (plus the issue itself if it has no size), whichever side wins. It is
  informational and adds no days — so an initiative sized by its own estimate still shows "2 epics
  have no estimate".
- The level average is computed only from known totals at that level (unchanged).
- `issueLastPeriod` gets the same fields automatically.

## Consumers

| Consumer                                                                                                                         | Change                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `computePercentComplete` ([percentComplete.ts](../../src/react/reports/GanttReport/GanttGrid/helpers/percentComplete.ts))        | `completedWorkingDaysWithAverages ÷ workingDaysWithAverages` — same as today by default; with `unsized`, averaged is 0 so it equals known-only. Add `computeKnownPercentComplete`.                                                |
| Gantt `PercentCompleteModal` / `CalculationBreakdown`                                                                            | Read `derivedTiming.sizeFrom` instead of `team.spreadEffortAcrossDates`. Child table adds **Known %** and **Averaged Days**; header shows "N of M working days are averaged · K items have no size" and the active Work settings. |
| Table `estimation:rolledUpDays`, `report:percentComplete`                                                                        | Read the `*WithAverages` fields; see spec/042.                                                                                                                                                                                    |
| Type stubs in `Stats.tsx`, `EstimateAnalysis.tsx`, `AutoScheduler.tsx`, `TableReport/model/estimationTypes.ts`, Gantt `types.ts` | Rename the field in the type; none do math on it.                                                                                                                                                                                 |
| Team Configuration (`ConfigureTeamsForm.tsx`, `AllTeamsDefaultsForm.tsx`, team-configuration services, `normalize.ts`)           | Remove `spreadEffortAcrossDates`.                                                                                                                                                                                                 |

Unaffected: Estimation Analysis and Auto-Scheduler read `derivedTiming` estimate fields
(`deterministicTotalDaysOfWork`, `datesDaysOfWork`, probabilistic values), not `totalDaysOfWork`.

Out of scope: the separate rollups in
[historical-adjusted-estimated-time.js](../../src/jira/rollup/historical-adjusted-estimated-time/historical-adjusted-estimated-time.js)
and [linked-issue/percent-complete.ts](../../src/jira/linked-issue/percent-complete/percent-complete.ts)
(only called by its own tests).

## Migration of Spread effort

Spread effort is stored per team and per level; a single report-level `workSizeFrom` can't express
a mix.

- If the stored **All teams** default has spread on, a report with no `workSizeFrom` param starts
  at `estimateFirst`; otherwise `datesFirst`.
- Per-team spread overrides are dropped. Reports that relied on a mix will change; the Rollup
  Calculation section shows a one-time notice when overrides were found.

## Open questions

1. **`larger` compares the parent against children's _known_ days** (not with averages), so
   guessed children can't outweigh a real parent estimate. OK?
2. **Migration** as above, or always start at `datesFirst` and only show the notice?
3. **Keeping saved reports on today's sizing.** Defaults are omitted from the URL, so a saved report
   with no sizing param would switch to team time when the default changes. Options: rewrite every
   stored saved report once to add today's sizing explicitly, or use a new param name whose absence
   in a pre-existing saved report means today's sizing.

## Mockup

[mockups/rollup-calculation.html](./mockups/rollup-calculation.html) — interactive: the Rollup
Calculation sidebar with presets, the Table with estimated-time and per-team columns (spec/042
Phase 1), Group by Team with `ratio`, and the Gantt percent-complete modal. Numbers are computed
live from sample data using these rules. Open with any static server (e.g.
`python3 -m http.server` in the folder).

Exploration of the sizing settings (supersedes the "Size work from" dropdown above; spec text not yet
updated). Both show team time over dates first and selected, as the default:

- [mockups/sizing-options.html](./mockups/sizing-options.html) — four sidebar layouts for "How much
  work is an item?" (main choice + fallbacks, one dropdown, ranked list, sentence).
- [mockups/sizing-picture.html](./mockups/sizing-picture.html) — one team's calendar, where each day
  of team time goes, and each epic's size by estimate / date span / team time over dates.

## Phases

1. **Rollup split, no behavior change:** `WorkRollup` shape (known / averaged / unsized / byTeam)
   with only `childrenFirstThenParent`; rename consumers; Gantt modal additions.
2. **Settings:** Work settings + presets in the renamed Rollup Calculation section; derive-stage
   size and progress rules; parent-vs-children methods; remove team Spread effort with migration.

## Testing

- `percent-complete.test.ts`:
  - With default settings, known + averaged equals the old `totalWorkingDays` /
    `completedWorkingDays` for every Rules row (no Gantt regression).
  - Each parent-vs-children method, including `larger` with the parent winning (byTeam keeps the
    children's known amounts plus the remainder on the parent's team) and losing.
  - `unsized`: averaged is 0, `unsizedIssueKeys` lists the gaps, and Σ `byTeam` = totals.
  - A parent sized by its own estimate (`self` or `larger`) still lists its children's gaps.
- `work-timing.test.ts`: every Size work from × Estimate value × Missing confidence combination,
  and each Mark complete by rule against these cases:

  | Epic (20d estimate, Jan 1 → 31, today Jan 16) | `dates` | `datesStatusWins` | `status` |
  | --------------------------------------------- | ------- | ----------------- | -------- |
  | In Progress, halfway                          | 10      | 10                | 0        |
  | Done, due date in the future                  | 10      | 20                | 20       |
  | To Do, start date passed                      | 10      | 0                 | 0        |
  | In Progress, no dates                         | 0       | 0                 | 0        |
  | Done, no dates                                | 0       | 20                | 20       |
  | Not Done, due date passed                     | 20      | 20                | 0        |

- Rollup Calculation component tests: presets set the right options; defaults are omitted from the
  URL.

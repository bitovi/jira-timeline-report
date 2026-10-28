# Auto-Scheduler: one consistent plan, with each epic's own risk as a whisker

Extends [backward-scheduling.md](./backward-scheduling.md). Where they disagree, this file wins.

## Problem

Today each epic's bar is built from that epic's own simulation results:

- **end** = the epic's due day at the slider's percentile (`dueDayTop`)
- **start** = end − the epic's length at the same percentile (`adjustedDaysOfWork`)

Each date is right on its own, but percentiles don't add up, so the bars don't form a plan anyone
could follow. Six epics in a row on one track at 90% (IMP-116):

|           | Per-epic length  | Gap between starts | Overlap with the previous epic |
| --------- | ---------------- | ------------------ | ------------------------------ |
| Each epic | ~45 working days | ~32 working days   | ~13 working days               |

Those bars are what **Update Epic Dates** writes to Jira. Once someone freezes them, the overlap is
real: the scheduler must put one of the frozen epics on an over-capacity track (ORDER-24 in IMP-99,
"2 items overlap on 1 track").

You cannot have all three:

1. each epic's dates are its own p% window,
2. epics on a track don't overlap,
3. the plan's end is the realistic p% finish.

The old non-Monte-Carlo scheduler gave up (3): it stacked p% lengths, so six epics at 90% finished
around day 270 instead of the simulation's ~200. The current bars give up (2). This spec gives up
(1) for the bars, and shows (1) separately as a whisker and in the tooltip.

## Decision

- **The solid bar is a plan.** It comes from one run of the scheduler with no randomness, where every
  epic gets its length at one shared percentile _q_. Choose _q_ so this run finishes when the
  simulation says the whole plan finishes at the slider's risk. The bars fit the tracks and the
  blockers by construction, because the real scheduler placed them.
- **The bar is what gets written to Jira**, and what "Freeze" reproduces. Freezing a plan and
  running again gives the same bars, with no over-capacity track.
- **Each epic's own risk is the thin line (the whisker).** It is the same thin line drawn today for
  "might start", now also reaching past the bar's end to the epic's own p% finish.
- **No toggle.** The previous per-epic bars are not kept as an option. Their dates overlap on a
  track, and freezing them recreates this bug.

The slider now means "chance the **whole plan** finishes by its end". Each epic's own chance is in
its tooltip.

## The plan pass

### Fixed lengths at percentile _q_

Each epic's length today is sampled from a lognormal around its median
(`sampleExtraPoints` in `src/utils/math/confidence.js`). The plan pass uses the same distribution's
quantile instead: `estimateExtraPoints(median, confidence, q)`, which `getEstimationData(issue,
{ uncertaintyWeight: q })` already exposes as `deterministicTotalDaysOfWork`.

Frozen items behave as in the simulation. A frozen item with both dates holds them. One with only a
start or only a due date gets the missing date from its length at _q_.

### Calibrating _q_

1. **Target.** Use the simulation's overall finish at the slider: the p-th percentile of `lastDays`,
   or the mean at "average". This is the end of the "Overall timing" green band.
2. **Search.** Find _q_ in [1, 99] whose plan finish is closest to the target. Use bisection: the
   finish almost always grows with _q_. Stop when the finish is within 0.5 day of the target, or
   after 12 steps. Keep the closest _q_ seen, so a rare non-monotone step can't make things worse.
3. **When the finish can't move.** If every candidate finishes on the same day (the last item is
   frozen), calibrate on the plan's **start** instead. Use the value `planStartAtWeight` already
   returns from `firstStartDays`, which is the start of the "Overall timing" blue band.
4. **When neither can move** (everything that matters is frozen), use _q_ = the slider's value, or
   50 at "average".

Expect _q_ to be below the slider at high settings, because one long epic is offset by others that
come in short. At "median" and "average", _q_ usually lands above 50, because the lognormal is
skewed to the right. Bars come out slightly longer than each epic's median length, which is
correct, not a bug.

### When it runs

- It needs its own `linkIssues(...)` copy. The plan pass and the simulation must not mutate the same
  `mutableWorkItem` objects.
- It runs in `StatsAnalyzer.dataForUI`, which already runs per batch and on slider changes.
- To keep that cheap, start the search from the previous _q_. Re-run it only when the target moved by
  at least half a day, the slider changed, or the simulation finished.
- One plan run costs about one simulation iteration. A full search costs about 12, on top of a
  20-iteration batch.

## What each value means now

| UI element                              | Before                                                        | After                                                       |
| --------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| Solid bar start                         | `dueDayTop − adjustedDaysOfWork` (backward: `startDayBottom`) | plan start                                                  |
| Solid bar end                           | `dueDayTop`                                                   | plan end                                                    |
| Row / track an epic is shown on         | most common track across runs                                 | plan track                                                  |
| Over-capacity track                     | most common track ≥ track limit                               | plan track ≥ track limit                                    |
| Blocker lines                           | between bar ends and starts                                   | unchanged, but bars are now plan dates                      |
| Thin line, left end                     | `startDayBottom`                                              | `min(startDayBottom, plan start)`                           |
| Thin line, right end                    | `dueDayTop` (hidden under the bar)                            | `max(dueDayTop, plan end)`                                  |
| Tooltip                                 | "Must start", "Must end"                                      | plan dates, plus "_p_% chance done by _date_" (`dueDayTop`) |
| **Update Epic Dates**                   | bar dates                                                     | plan dates                                                  |
| Team "Total Working Days"               | sum of `adjustedDaysOfWork`                                   | sum of plan lengths                                         |
| Overall timing row, summary, histograms | simulation                                                    | unchanged                                                   |
| Late-for-frozen %, before-start %       | simulation                                                    | unchanged                                                   |

Tooltip wording for the new line:

- numeric slider: "90% chance done by Mar 26"
- "average": "Done by Mar 26 on average"

`anchorBarAtStart` goes away. It only existed to stop backward bars from overrunning the item they
block, and the plan pass can't overrun.

### Writing dates to Jira

Plan days are fractional, and a bar's end is exclusive, but a Jira due date is the last day worked.
Both ends of a bar round to the nearest business day the same way, and the due date is written as
the day before the rounded end. Bars that touch stay touching once written, so freezing a whole plan
never overlaps a track.

Before this, the due date written was the rounded-down end itself, one business day late. Bars that
touched were written with a one-day overlap. The "Must end" tooltip date moves one day earlier for
the same reason.

## Implementation

- `scheduler/plan.ts`: `runPlan` and `calibratePlan`.
- `resetLinkedIssue(issue, quantile)` takes the length at a fixed percentile instead of a sample.
- `StatsAnalyzer` keeps its own linked copy for the plan pass and caches the calibrated plan.
  `applyPlan` moves the bar to the plan, with `ownDueDayTop` holding the item's own finish and
  `track` the plan track. `planQuantile` is in the UI data.
- The row's thin line has `data-testid="issue-range-line"`.

## The whisker

It is the existing thin line ("The Little Line" in `IssueSimulationRow.tsx`): 4px tall, a blue→green
gradient, under the bar.

- Today it runs from `startDayBottom` to `dueDayTop`, and the bar ends at `dueDayTop`, so only its
  left part shows.
- Now the bar usually ends before `dueDayTop`, so the green tail also shows to the right.
- A whisker reaching past the next epic's start reads as "if this one goes badly, it eats into the
  next". That is the information the overlapping bars were trying to give.
- When the epic's own p% finish is earlier than the plan end (it has slack), the line simply ends at
  the bar. It never points backward.
- Frozen items still get no thin line.

## Out of scope

- Writing the epic's own p% finish to a second Jira field, such as Target end. A possible follow-up.
- A buffer view, with epics at median lengths and the margin shown as one block.
- Changing the simulation itself, its histograms, or the Overall timing row.

## Tests

Scheduler and stats:

- **Plan pass, no overlap.** Six epics in a chain on one track, at slider 90: no plan bar overlaps
  another on the same track. Each starts at or after its blocker's end.
- **Calibration.** In the same chain, the plan finish is within 0.5 day of the 90th percentile of
  `lastDays`, and _q_ < 90.
- **Median.** At slider 50 in the same chain, _q_ > 50.
- **Frozen end.** With the last item frozen, the search calibrates on the start (_q_ moves the plan
  start toward the `firstStartDays` target). With everything frozen, _q_ = the slider.
- **Freeze round trip.** Take the plan dates, freeze all of them, and re-run: same bars, and no
  over-capacity track.
- **Nothing frozen, no blockers, parallel tracks.** The plan finish equals the target, within
  tolerance.
- **Deterministic.** Two plan passes with the same _q_ give identical output.

UI:

- **Whisker.** When `dueDayTop` is after the plan end, the thin line extends past the bar. When it
  is before, the line ends at the bar.
- **Tooltip.** Shows "90% chance done by _date_" at 90, and "Done by _date_ on average" at average.
- **Update Epic Dates** writes the plan dates.
- **Grouping.** Track rows group by plan track, and the over-capacity label follows the plan track.

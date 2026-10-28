# Auto-Scheduler: one consistent plan, with when each epic might start, should start and should end

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
(1) exactly, keeps it close for the typical epic, and marks when each epic might start, should start and should end. It
also loosens (3): the plan's last date is close to, but not exactly, the overall p% finish, which
stays in the Overall timing row.

## Decision

- **The solid bar is a plan.** It comes from one run of the scheduler with no randomness, where every
  epic gets its length at one shared percentile _q_. Choose _q_ so the typical epic's bar ends on
  its own p% finish (see "Calibrating _q_"). The bars fit the tracks and the blockers by
  construction, because the real scheduler placed them, and every bar is a real adjusted size.
- **The bar is what gets written to Jira**, and what "Freeze" reproduces. Freezing a plan and
  running again gives the same bars, with no over-capacity track.
- **Each epic's own estimate is marks over the bar**: a dot for when it might start, and ticks for
  when it should start and end. See "Might start, should start, should end".
- **No toggle.** The previous per-epic bars are not kept as an option. Their dates overlap on a
  track, and freezing them recreates this bug.

The slider still means "chance each epic finishes by its date", now true for the typical epic rather
than exactly for each one. The whole plan's chance is the Overall timing row.

## The plan pass

### Fixed lengths at percentile _q_

Each epic's length today is sampled from a lognormal around its median
(`sampleExtraPoints` in `src/utils/math/confidence.js`). The plan pass uses the same distribution's
quantile instead: `estimateExtraPoints(median, confidence, q)`, which `getEstimationData(issue,
{ uncertaintyWeight: q })` already exposes as `deterministicTotalDaysOfWork`.

Frozen items behave as in the simulation. A frozen item with both dates holds them. One with only a
start or only a due date gets the missing date from its length at _q_.

### Calibrating _q_

The first version matched the plan's **last** date to the overall p% finish. That fails on two
shapes, in opposite directions:

- **A chain** (IMP-116): all epics running long at once is unlikely, so _q_ lands below the slider.
  Every epic ends where the last one needs it to, not where its own p% says.
- **Parallel branches** (IMP-99): you wait on both, which is less likely to go well than either
  alone, so the overall finish is later than each branch's own finish and _q_ lands **above** the
  slider. Every epic — on both branches — gets stretched to carry that "waiting on two branches"
  risk, and their bars end weeks after their own p% finishes.

One dial can't fit both, so it is fitted to the epics instead:

1. **Target.** Each forward item's own p% finish: its `dueDayTop` from the simulation (the mean at
   "average"), its should-end tick. Frozen items don't move; work feeding a frozen item is
   placed from the frozen dates, so neither counts.
2. **Measure.** The **median**, over those items, of plan end − own finish. Half the items end on or
   before their own date, half after. The median, not the mean, so one huge, uncertain epic can't
   drag the dial for everyone. It grows with _q_, since every bar end moves later.
3. **Search.** Bisection on _q_ in [1, 99] until the measure is within 0.5 day of zero, or 12 steps,
   keeping the closest _q_ seen. Out of reach, settle for 1 or 99.
4. **When no item's finish can move** (only frozen work and what feeds it), calibrate the plan's
   **start** against `planStartAtWeight` from `firstStartDays`, the start of the "Overall timing"
   blue band.
5. **When nothing moves**, _q_ = the slider's value, or 50 at "average".

What it looks like:

- In a chain, equal lengths put early epics a bit before their own p% finish and late ones a bit
  after, so the plan can end slightly after the overall p% finish.
- With parallel branches, epics sit near their own windows and the plan ends **before** the overall
  p% finish. The gap is the risk of waiting on several branches: no single epic carries it, and the
  Overall timing row shows it.
- The parent's rolled-up due date (the latest epic) can therefore understate that risk. Writing the
  overall finish to the parent is a possible follow-up.
- Bars are never squeezed: every bar is its epic's length at _q_. (Re-timing bars to end exactly on
  each epic's own finish was considered and rejected: a small epic after a big, uncertain one would
  get a fraction of its size — IMP-99's "Promotion end-date error handling" ~57% — and that short
  epic would be written to Jira.)

At "median" and "average", _q_ usually lands above 50, because the lognormal is skewed to the right.
Bars come out slightly longer than each epic's median length, which is correct, not a bug.

### When it runs

- It needs its own `linkIssues(...)` copy. The plan pass and the simulation must not mutate the same
  `mutableWorkItem` objects.
- It runs in `StatsAnalyzer.dataForUI`, which already runs per batch and on slider changes.
- To keep that cheap, re-run it only when any item's target moved by at least half a day, the slider
  changed, or the simulation finished.
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
| Thin line                               | `startDayBottom` → `dueDayTop`                                | replaced by a might-start dot (see below)                   |
| Should start / should end               | the bar's ends                                                | ticks at `ownShouldStartDay` / `ownShouldEndDay`            |
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

## Might start, should start, should end

People want to know how early an epic might start and, roughly, when it should start and end — and
a coherent plan to write to Jira. Each epic row answers exactly that, over its gray plan bar:

```
  ●            |                         |
might start  should start           should end
                 ╔═══════════════════╗          ← plan bar (written to Jira)
```

- **Might start** (blue dot, 8px): `startDayBottom`, the start early enough that only `100 − p`% of
  runs start earlier. It can sit far left of the bar in a long chain; that's fine.
- **Should start** (blue tick, 2px × 16px): `ownShouldStartDay` = own finish − own adjusted size at
  the slider. Start here and, taking its p% size, it still ends by its own p% date.
- **Should end** (green tick): `ownShouldEndDay`, the epic's own finish at the slider.
- The gap between the ticks is the epic's own adjusted size — the number the
  [Statistical Software Estimator](https://bitovi.github.io/statistical-software-estimator/) teaches.
  A bar ending after the green tick runs late against the epic's own estimate; a bar starting after
  the blue tick has squeezed time.
- Work feeding a frozen item is mirrored: its safe number is the early start, so it should start at
  `startDayBottom` and end its size later, capped at its own finish.
- All three marks are drawn over the bar with a white outline, so they show inside it. Frozen items
  get none.

**Language.** "Should", not "must": these come from the epic's own estimate and are guidance.
"Must start by" stays only for the frozen-item deadline, which really is a hard dependency.

Tooltip (epic): "Plan starts", "Might start", "Should start"; "_N_ days in the plan", "_M_ days at
_p_%"; "Plan ends", "Should end: _date_ (_p_% likely)" — "(on average)" at "average".

**Overall timing** keeps full-height bands: a blue start band and a green delivery band. The
delivery range is what execs need, and thin lines were too thin to read.

Tried and dropped:

- A whisker for the epic's own size window plus a might-start dot: both ends were the same kind of
  percentile edge, drawn differently.
- Thin blue start-range and green finish-range lines (on one level, then on two): later epics'
  ranges overlapped so much they added confusion, not information.

## Out of scope

- Writing the epic's own p% finish to a second Jira field, such as Target end. A possible follow-up.
- A buffer view, with epics at median lengths and the margin shown as one block.
- Changing the simulation itself, its histograms, or the Overall timing row.

## Tests

Scheduler and stats:

- **Plan pass, no overlap.** Six epics in a chain on one track, at slider 90: no plan bar overlaps
  another on the same track. Each starts at or after its blocker's end.
- **Calibration.** In the same chain, the median of plan end − own finish is within 0.5 day of zero,
  _q_ < 90, the first epic ends before its own finish and the last after.
- **Parallel branches.** A root blocking two identical branches: the median miss is within 0.5 day,
  and the plan's last bar ends before the overall p% finish.
- **Median, not mean.** One item far off its own finish doesn't move the dial.
- **Median.** At slider 50 in the same chain, _q_ > 50.
- **Frozen end.** With the last item frozen, the search calibrates on the start (_q_ moves the plan
  start toward the `firstStartDays` target). With everything frozen, _q_ = the slider.
- **Freeze round trip.** Take the plan dates, freeze all of them, and re-run: same bars, and no
  over-capacity track.
- **Deterministic.** Two plan passes with the same _q_ give identical output.

UI:

- **Whisker.** When `dueDayTop` is after the plan end, the thin line extends past the bar. When it
  is before, the line ends at the bar.
- **Tooltip.** Shows "Should end: _date_ (90% likely)" at 90, and "(on average)" at average.
- **Update Epic Dates** writes the plan dates.
- **Grouping.** Track rows group by plan track, and the over-capacity label follows the plan track.

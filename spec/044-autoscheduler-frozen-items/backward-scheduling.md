# spec/044 — Part 2: schedule blockers of frozen items backward

Changes how freezing behaves in [spec.md](./spec.md). Where the two disagree, this document wins.
How bars are positioned and written to Jira is superseded by [consistent-plan.md](./consistent-plan.md).

## Why

When a blocker of a frozen item can't fit before it, spec.md's scheduler queues the blocker
**after** the frozen item. In "Verify promotion is available" (frozen, days 6–12) blocked by
"Create a promotion" (~8 days, same one-track team), the blocker:

- fit before the frozen item in 36% of runs (start day 0), and
- was queued after it in 64% (start day 12).

The averaged bar landed in between, on top of the frozen item, a position no run produced.

The real answer to "when must this start so the frozen date holds?" lies **before** the start date.
This part lets the scheduler say so.

## Decisions

| Question                                      | Decision                                                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Where does a blocker of a frozen item go?     | As late as possible (just in time) before the frozen item, even before the start date.          |
| What is the warning measured against?         | The plan's start date only.                                                                     |
| Frozen items whose dates are before the start | Held at their real dates. They take capacity there too; no clipping.                            |
| Approach                                      | Run the existing scheduler mirrored (backward) for upstream work, then forward for the rest.    |
| Work between two frozen items                 | Forward from the earlier one. If it can't fit before the later one, it runs late, never queued. |

## Scheduling (per Monte Carlo run)

### Groups

Worked out once in `linkIssues`, from the `Blocks` links:

- **Frozen**: the items the user froze that have a Jira date.
- **Backward**: items that are **not** downstream of any frozen item and that block a frozen or
  backward item — so every backward item reaches a frozen item through frozen or backward items
  alone. (X → Y → frozen F, with Y after another frozen item, leaves X forward: its deadline runs
  through Y, which is placed forward.)
- **Forward**: everything else, which includes:
  - work after a frozen item,
  - work between two frozen items,
  - work unrelated to frozen items.

A backward item's blockers are always backward too: a blocker can't be downstream of a frozen item
without making this item downstream of it, and it blocks a backward item. Forward items therefore
never block backward ones.

### Step 1 — frozen items

Each gets its **full** span at its Jira dates on the first free track, including any part before
the start date. More overlap than tracks → over-capacity track (as in spec.md).

| Jira dates    | Start                       | End                           |
| ------------- | --------------------------- | ----------------------------- |
| Start and due | Jira start                  | Jira due                      |
| Due only      | Jira due − sampled estimate | Jira due                      |
| Start only    | Jira start                  | Jira start + sampled estimate |

### Step 2 — backward items, as late as possible

- Walk upstream from the frozen items: latest-starting frozen item first, then up each item's
  `linkedBlockedBy`. Siblings with the longest upstream chain (`blockedByWorkDepth`) go first.
- An item is placed once everything it blocks **within the frozen and backward groups** has been
  placed.
- **Latest finish** = the earliest start among those items.
- `WorkPlans.scheduleWorkBackward(work, latestFinish)`: on each real (not over-capacity) track, find
  the latest start whose span fits a free gap and ends by `latestFinish`; take the latest across
  tracks. Time is unbounded going back, so a slot always exists. Backward items are never late.
- Forward items a backward item blocks don't constrain it; they wait for it in step 3.

### Step 3 — forward items, as early as possible

spec.md's forward pass, with these changes:

- Frozen **and** backward items are already placed. `planIssue` walks through them to their
  dependents without placing them again.
- Earliest start is still `max(0, latest blocker end)`. Forward work never starts before the start
  date.
- **Deadline rule.** For an item with a finite `latestFinish`, if the best slot on a real track
  starts after its earliest start **and** makes it finish after `latestFinish`, it goes on an
  over-capacity track at its earliest start instead (first over-capacity track free for that span,
  else a new one). Work with a deadline is never queued behind the frozen item it must finish
  before.
- Ordering stays deadline-first, then `blocksWorkDepth`.

### Unchanged

- Nothing frozen → steps 1 and 2 do nothing, and output is identical to before spec/044.
- Lateness does not pass through a frozen item: work after it starts from its Jira end.

## What the simulation reports

### Days before the start date

Business-day offsets from the start date can be negative everywhere: per-item start/due days and
track placement.

### Plan start spread (new)

- Per run: the earliest start of any non-frozen item, **capped at 0**. A run whose first work starts
  after the start date needed no early start, and its exact late start only scatters the histogram.
- Kept sorted. At slider `p` it reports the `(100 − p)`th percentile, the start that is early enough
  in `p`% of runs.
- At `average` it reports the **median**, not the mean. A minority of runs that start weeks early
  would otherwise pull an "average" start before the start date when most runs never go there.
- `beforeStartPercent`: the share of runs whose earliest start is before day 0. Shown only in the
  overall row's tooltip.
- `startDayLate`: the other end of the start band, the mirror of the finish band. It is the start
  that is early enough in only `100 − p`% of runs. At 50%/`average` it equals `startDay`.
- Exposed as `planStart: { startDay, startDayLate, beforeStartPercent, startDays }` on the UI data.
  The overall row's `startDays` is the same sorted array, so its start histogram is the plan's
  start distribution.

### Per item

- **Bar position.** Forward items keep today's calculation: anchored at the due date late enough in
  `p`% of runs, reaching back by a `p`th-percentile duration.
- **Backward items are anchored at the other end.** Their bar starts at the start early enough in
  `p`% of runs, the safe number for work that must finish before a frozen item. It reaches forward
  by the `p`th-percentile duration, capped at the latest due.
  - Anchoring them at the late due drew each blocker from the runs where the work after it was
    short. A blocker could then appear after the bar it blocks: "Create a promotion" drawn in March,
    after "Add promotion to cart" (long and uncertain) started in October.
- **`beforeStartPercent`:** share of runs in which the item started before day 0.
- **`lateForFrozenPercent`:** unchanged. Only forward deadline work can be late now.
- **`mustStartByDay`:** forward items only. For backward items the bar's start already is the
  must-start date.
- **`isOverflowTrack` / `overlapInfo`:** overlap counts now include any item on an over-capacity
  track, not only frozen ones ("N items overlap on T tracks").

### Removed from spec.md

- Clipping frozen items at day 0.
- "Ended before plan start".
- "Needed to start … before the plan start" (the bar shows it).

## What you see

- **Grid extends left.** Its first column is the earliest drawn start (bar start or might-start)
  across all rows, or the start date, whichever is earlier. Date headers are laid out from that
  date. Jira-date shadows don't widen the grid; they're clipped as before.
- **Start-date line.** When the grid begins before the start date, a dashed orange vertical line
  marks it, running through the date header (hover: "Start date").
- **Before-start warning.** No marking on the bar itself — the start-date line already shows which
  part is early. When a bar starts left of that line, the tooltip adds "Starts before the start date
  in _N_% of runs", so it, too, follows the slider.
- **Must start by** (forward deadline work): "Must start by _date_", plus "(before the start date)"
  when negative.
- **Over-capacity tooltip:** "Over capacity: _N_ items overlap on _T_ tracks, _Mar 3 – Apr 10_".
- **Overall timing row** (was "Due Date"). Read like an epic row:
  - **Blue start band** from `planStart.startDay` to `startDayLate`. When the two match it's a
    narrow pill (on the start date when nothing needs to start early).
  - **Green finish band**, unchanged except for its height.
  - **Both bands are always full height.** A range is a wider bar, a single date a narrow pill. The
    finish band used to inset a range with a 6px white border, shrinking it to a 4px stripe, so the
    band changed thickness as the slider moved and the more uncertain case looked fainter.
  - **Tooltip.** When any run starts early, it adds a start box: "To be _p_% sure / work has to
    start by _date_ / _N_% of runs start early" ("In the middle run" at `average`).
  - Nothing joins the two bands.
  - **Click** anywhere on the row. Opens the full distributions: the start histogram (each run's
    earliest start) above and the finish histogram below. The start histogram only appears once some run starts early; otherwise it would be a
    single bar.
  - **Spike cap.** When the start date's column holds most runs, it's drawn full height but left
    out of the scale, so the tail stays readable. It isn't labelled.
  - The grid extends left to include the start band. While the histograms are open it reaches back to
    the 1st-percentile run start, so the early tail is drawn. It doesn't go back to the very
    earliest: a few runs with blown-up estimates can start a year early and would squash the plan.
- **Histograms** (click a bar) cover the whole grid, including days before the start date.
- **Dates** for negative offsets count business days back from the start date. This applies
  everywhere a day offset becomes a date, including the Update Dates modal.

## Testing

**Unit**

- `workplan.test.ts`:
  - `scheduleWorkBackward` ends at the deadline on a free track.
  - It goes earlier past busy time, and fits a gap between items.
  - It never uses an over-capacity track.
  - The deadline rule puts late deadline work on an over-capacity track at its earliest start.
- `link-issues.test.ts`:
  - Frozen / backward / forward groups for a chain, a fan-in, A → B → C with A and C frozen (B is
    forward), and X → Y → F with Y after another frozen item (X is forward).
- `schedule.test.ts`:
  - The no-frozen regression stays.
  - A blocker that doesn't fit before its frozen item starts before day 0 and finishes at its start.
  - A chain of blockers stacks backward.
  - Two backward items on a one-track team don't overlap.
  - A frozen item before the start date takes capacity there.
  - A → B → C with A and C frozen: B starts at A's end, runs late, is on an over-capacity track
    when C holds the only track.
- `stats-analyzer.test.ts`:
  - A backward chain into a long, uncertain epic draws each blocker ending before the bar it blocks,
    at 60%, 90% and average.
  - The plan start percentile follows the slider; `average` uses the median, so 23% early runs
    show a share but no date.
  - `beforeStartPercent`.
  - Overlap info includes non-frozen over-capacity items.

**Component**

- `IssueSimulationRow`:
  - Before-start tooltip line.
  - Bars positioned with a negative grid start.
- `AutoScheduler`:
  - Grid starts before the start date when a row does.
  - Start-date line. There is no "Work must start by" text in the summary.
- `IssueSimulationRow` (overall timing):
  - Start band position, nothing joining it to the finish band.
  - Clicking anywhere on the row opens and closes the histograms.
  - Start box in the tooltip and start histogram on click only when some run starts early.
- `IssueSimulationDays`:
  - The spike cap scales the rest to the next-largest column, with no label.

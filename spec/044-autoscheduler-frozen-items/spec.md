# spec/044 — Auto-Scheduler: frozen items

> **Superseded in part by [backward-scheduling.md](./backward-scheduling.md):** blockers of frozen
> items are now scheduled backward (as late as possible, possibly before the start date), and frozen
> items are no longer clipped at the start date.

## Goal

Let a user tell the Auto-Scheduler **"don't move this one"**. A frozen item keeps the dates it
already has in Jira, takes up one whole track for that span, and everything else is scheduled
around it.

To make the choice informed, every row also shows its **current Jira dates as a shadow**, the same
way the Gantt shows last period's dates.

## Today

- The scheduler ([schedule.ts](../../src/react/reports/AutoScheduler/scheduler/schedule.ts),
  [workplan.ts](../../src/react/reports/AutoScheduler/scheduler/workplan.ts)) places every item
  from day 0 (`selectedStartDate`). Items are ordered by `blocksWorkDepth`. Each item goes on the
  earliest free track, and an item can be slotted into a gap before work already on a track
  (`isPrependPossible`).
- Jira start/due dates are ignored. An item's size comes from its estimate
  (`derivedTiming.probablisticTotalDaysOfWork`), which is sampled again on every Monte Carlo
  iteration ([monte-carlo.ts](../../src/react/reports/AutoScheduler/scheduler/monte-carlo.ts),
  `resetLinkedIssue` in
  [link-issues.ts](../../src/react/reports/AutoScheduler/scheduler/link-issues.ts)).
- The simulation restarts only when `primary` changes. `selectedStartDate` only affects how the
  results are drawn.
- Jira dates appear only in the Update Dates modal
  ([UpdateModal.tsx](../../src/react/reports/AutoScheduler/components/UpdateModal/UpdateModal.tsx)),
  as "current" next to "new".

## Behavior

### Jira-date shadows

- Every row whose issue has **both** a start and a due date gets a blurred shadow bar at those
  dates. Dates come from `derivedTiming.startData` / `dueData`: the start/due fields, falling back
  to sprints, as on the Gantt.
- It uses the Gantt look
  ([ShadowBar.tsx](../../src/react/reports/GanttReport/GanttGrid/components/ShadowBar/ShadowBar.tsx)):
  `border-black blur-xs`, sitting behind the bar.
- It is hidden when it lines up exactly with the bar drawn on top of it. This is always true for
  items frozen with both dates.
- It is clipped at day 0 and at the grid's last day. A clipped edge is drawn open (no border on
  that side), as the Gantt does.
- Items with only one date get no shadow.

### Freezing

- **Lock toggle:** a lock icon button at the start of each row's label column (before the
  summary).
  - Unlocked rows show a faint icon on hover. Locked rows show a solid icon.
  - Disabled when the item has neither a start nor a due date. Tooltip: "Needs a start or due date
    in Jira to freeze."
  - Accessible name: "Freeze _summary_" / "Unfreeze _summary_".
- **Team header bulk action:**
  - "Freeze all with dates" freezes every row in the team that can be frozen.
  - Once every such row is frozen, it switches to "Unfreeze all".
- **What freezing does:**

  | Item's Jira dates | Start                       | Due                           | Uncertainty range drawn |
  | ----------------- | --------------------------- | ----------------------------- | ----------------------- |
  | Start and due     | Jira start                  | Jira due                      | none (solid bar)        |
  | Due only          | Jira due − sampled estimate | Jira due                      | start side only         |
  | Start only        | Jira start                  | Jira start + sampled estimate | due side only           |

  - A frozen item takes up **one entire track** for its whole span, whatever its estimate says.
    Its estimate is used only to fill in a missing date.
  - **Starts before the plan start date:** it is clipped to day 0, and only the part from day 0 on
    takes up capacity.
  - **Ends before the plan start date:** it takes up no capacity. The row says "Ended before plan
    start". Work it blocks may start at day 0.

- **Frozen bar look:**
  - A solid bar with a small lock glyph, and no "little line" (might-start range).
  - Items frozen with one date keep the uncertainty gradient on their free side only.
- **Re-running:** any change to the frozen set restarts the simulation. While anything is frozen,
  changing `selectedStartDate` restarts it too, because frozen items' day offsets depend on it.

### Over capacity (overflow tracks)

- When more frozen items overlap in time than the team has tracks, the extra ones go on **overflow
  tracks**, listed after the team's real tracks and labelled "Track N (over capacity)".
- Unfrozen work is never scheduled onto an overflow track.
- Bars on an overflow track get the **orange border** already used for unestimated items
  (`border-2 border-yellow-500` in `rangeBorderClasses`).
- Tooltip: "Over capacity: _3_ frozen items overlap on _2_ tracks, _Mar 3 – Apr 10_".

### Upstream deadlines and conflicts

A frozen item's blockers (and their blockers) have a **deadline**: they have to finish by the
frozen item's start.

- The scheduler gives deadline work its tracks first (see [Algorithm](#algorithm)).
- **Must start by:** each item upstream of a frozen item gets a "Must start by _date_" line in its
  tooltip, following the uncertainty slider.
  - When that date is before the plan start, the line reads "Needed to start _Feb 10_, before the
    plan start", in orange.
- **Late blocker:**
  - When a blocker's due date (at the current slider position) is after a frozen dependent's start,
    the dependency line between them turns orange.
  - The blocker's tooltip adds "Finished after _X_ started in _62%_ of simulations".
- **Two frozen items in conflict:** frozen A blocks frozen B, but A ends after B starts. Both stay
  where they are, and the link is orange (late in 100% of runs).

### Update Dates modal

- Items frozen with **both** dates are left out, since there is nothing to write back.
- Items frozen with one date stay in, so the computed date can be saved.

## Settings

| Setting      | Route key      | Value                                             | Default        |
| ------------ | -------------- | ------------------------------------------------- | -------------- |
| Frozen items | `frozenIssues` | Comma-separated issue keys, sorted, no duplicates | `''` (omitted) |

- It is defined in [route-data.js](../../src/canjs/routing/route-data/route-data.js) with
  `saveJSONToUrlButAlsoLookAtReport_DataWrapper`, next to `uncertaintyWeight`, so it is saved with
  the report.
- Read and written through a new `useFrozenIssues()` hook in `AutoScheduler/hooks/`, shaped like
  `useUncertaintyWeight`. It returns `[Set<string>, setter]`.
- Keys that aren't in the loaded data are ignored but **kept** in the URL, so changing a filter
  doesn't silently unfreeze anything.
- A team's "Unfreeze all" removes only that team's visible keys.

## Algorithm

When `frozenIssues` is empty, the scheduler's output must be **identical to today's**. Everything
below runs only when at least one loaded item is frozen.

### Data

- `LinkedIssue` gains `frozen: null | { startDay: number | null; dueDay: number | null }`.
- These are business-day offsets from `selectedStartDate`, computed once in `linkIssues`, and can be
  negative. `dueDay = offset(start) + getBusinessDatesCount(start, due)`, the same span formula as
  `work-timing.ts`.
- `runMonteCarlo(issues, { frozenKeys, startDate, ... })` and `StatsAnalyzer` take the frozen set
  and the start date.

### Per Monte Carlo iteration

1. **Reset and sample.**
   - Unfrozen items are sampled as today.
   - Items frozen with both dates are not randomized: `daysOfWork = dueDay − max(startDay, 0)`
     (0 if `dueDay ≤ 0`).
   - Items frozen with one date sample their estimate, then fill in the missing date from it.
2. **Reserve.**
   - Frozen items are sorted by `(startDay, key)`.
   - A new `WorkPlans.reserve(work, startDay)` puts each one on the first track with no work
     overlapping its span. If there is none, it adds a `WorkPlan` marked `overflow: true`.
   - Items with `dueDay ≤ 0` aren't reserved. Their effective `startDay` and `daysOfWork` are both 0.
   - `sheduleWork` and `earliestStartDay` skip overflow plans.
   - Gap insertion (`isPrependPossible`) then fits unfrozen work before, between, and after
     reservations with no further changes.
3. **Deadlines (backward pass).** Memoised over `linkedBlocks`, O(V + E):
   - `latestFinish(frozen) = frozen.startDay`
   - `latestFinish(unfrozen) = min over successors s of (latestFinish(s) − s.daysOfWork)`, where a
     frozen successor contributes its `startDay` directly. With no constrained successors it is
     `+∞`.
   - `mustStartBy = latestFinish − daysOfWork` (only for items with a finite `latestFinish`).
4. **Forward pass.** Today's `planIssue` recursion, with these changes:
   - The root order and the `linkedBlocks` order are sorted by
     `(latestFinish ascending, blocksWorkDepth descending)`. Work with a deadline is placed first.
   - A frozen item is already scheduled. `planIssue` does not place it again, but it still walks
     its `linkedBlocks` so its dependents get planned.
   - A frozen item never gets `artificiallyDelayed`.
   - An unfrozen item's earliest start is still `max(0, latest blocker end)`, whether its blockers
     are frozen or not.
5. **Record**, per item per iteration:

   - track number (overflow tracks are numbered after the real tracks)
   - `mustStartBy` (if finite)
   - `lateForFrozen`: its due day is after the `startDay` of a frozen item it directly blocks.

   Frozen items count toward the plan's last day, like any other item.

### Stats

[stats-analyzer.ts](../../src/react/reports/AutoScheduler/scheduler/stats-analyzer.ts) adds, per
item:

- `mustStartByDays: number[]`, kept sorted.
  - At slider `p` it reports the `(100 − p)`th percentile, the earliest date that is safe with
    confidence `p`.
  - At `average` it reports the mean.
- `lateForFrozenCount`, reported as a percentage of iterations.
- `isOverflowTrack`, true when `mostCommonTrack ≥ team.parallelWorkLimit`.
- `overlapInfo` for the over-capacity tooltip: how many frozen items overlap, how many tracks the
  team has, and the overlapping window.

### Cost

- One extra O(V + E) pass and one sort per iteration, only while something is frozen. This is about
  the cost of `findLongestPath` (~13% of a batch, per the comment in `monte-carlo.ts`).
- Reservation is O(F · tracks).

## Components

| Unit                                     | Change                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `scheduler/link-issues.ts`               | Compute `frozen` offsets. `resetLinkedIssue` respects frozen sizing.                             |
| `scheduler/workplan.ts`                  | `reserve()`, `overflow` plans, overflow plans skipped by `sheduleWork`.                          |
| `scheduler/deadlines.ts` (new)           | Backward pass: `computeDeadlines(linkedIssues) → Map<key, { latestFinish, mustStartBy }>`.       |
| `scheduler/schedule.ts`                  | Reserve first; deadline-aware ordering; frozen items treated as scheduled.                       |
| `scheduler/monte-carlo.ts`               | Pass `frozenKeys`/`startDate`; record `mustStartBy`, `lateForFrozen`.                            |
| `scheduler/stats-analyzer.ts`            | Aggregate the new per-iteration data; overflow flags.                                            |
| `hooks/useFrozenIssues/` (new)           | URL-backed frozen set.                                                                           |
| `components/FreezeToggle/` (new)         | Lock icon button for a row.                                                                      |
| `components/JiraDatesShadow/` (new)      | Shadow bar placed by business-day offsets (the Gantt `ShadowBar` is tied to its own axis types). |
| `IssueSimulationRow.tsx`                 | Shadow, lock toggle, frozen bar style, overflow border, new tooltip lines.                       |
| `AutoScheduler.tsx`                      | Restart rules, team header bulk action, overflow track labels.                                   |
| `svg-blockers.ts`                        | Orange line for late blockers of frozen items.                                                   |
| `components/UpdateModal/UpdateModal.tsx` | Leave out items frozen with both dates.                                                          |

## Known limitations

- **Critical path rail:** frozen items go into `findLongestPath` with their fixed span as
  `daysOfWork`. Their fixed start dates are not modelled in the dependency floor, so the floor can
  understate a plan held up by a frozen item that starts late.
- Bars are never drawn before day 0. Work that "should have started already" shows that only
  through the "Needed to start … before the plan start" tooltip line.
- An item can be frozen only at its Jira dates. Dragging a bar to pick new dates is out of scope.

## Testing

**Unit (Vitest)**

- `workplan.test.ts`:
  - `reserve` uses the first free track.
  - Overlapping reservations add an overflow plan.
  - `sheduleWork` never uses an overflow plan.
  - Unfrozen work fits into a gap before a reservation, and goes after it when the gap is too small.
- `deadlines.test.ts`:
  - single chain
  - fan-in to a frozen item
  - two frozen successors (the minimum wins)
  - no frozen successors (`+∞`)
  - `mustStartBy` before day 0
- `schedule.test.ts`, with deterministic `daysOfWork`:
  - **No frozen items gives exactly today's output** (regression).
  - Deadline work beats deeper unconstrained work for a track.
  - A frozen item's dependent waits for its due day.
  - Frozen-vs-frozen contradiction: neither moves.
  - Items that start or end before the plan start.
- `link-issues.test.ts`:
  - Offsets for both dates, due only, and start only.
  - Weekend start dates.
- `stats-analyzer.test.ts`:
  - `mustStartBy` percentile follows the slider.
  - Late percentage.
  - `isOverflowTrack`.

**Component**

- `FreezeToggle`:
  - Disabled with its tooltip when there are no dates.
  - Toggling updates the URL set.
- `IssueSimulationRow`:
  - The shadow renders when dates differ from the bar and is hidden when they match.
  - Frozen and overflow styling.
- Team header bulk action: freezes only rows that can be frozen, and unfreezes only that team.
- Stories: frozen row, overflow track, late blocker.

## Open questions

- The algorithm section was written after the UI was agreed but before it was reviewed. Confirm
  deadline-first forward scheduling with a backward "must start by" readout (option 3 from
  brainstorming).
- Should a frozen item that is Done in Jira be treated the same as one that "Ended before plan
  start", even when its dates say otherwise?

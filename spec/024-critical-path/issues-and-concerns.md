# Issues & concerns found during manual smoke test

Found while running the new `CriticalPathsReport` (spec/024-critical-path POC, branch
`autoscheduler-composite-confidence`) against real data in the Auto-Scheduler at
`http://localhost:5173/?primaryReportType=auto-scheduler&jql=...`.

---

## Status — 2026-08-11: paused, report unmounted

**The report is currently not rendered.** `AutoScheduler.tsx` has both the
`import { CriticalPathsReport }` and the `<CriticalPathsReport>` JSX commented out, so Vite
tree-shakes `CriticalPathsReport.tsx` and `build-critical-paths.ts` out of the bundle. All the code
is still on disk and all its tests still run and pass — uncomment the two sites to bring it back.

Still live in the simulation (small, and the data is harmless if unread): `traceDrivingChain`,
`CriticalityAccumulator`, and the `criticalityIndex` / `meanWorkDays` / `meanQueuedDays` fields
`stats-analyzer.ts` puts on every `SimulationIssueResult`.

`npm run typecheck` and `npm run test` are green as of the pause.

### What was fixed

**Issue 1 is understood and the ranking model has been rewritten.** The cause was not any of the
leads listed below — `CriticalityAccumulator.merge()`, the `issueByWorkItem` identity, and
start-date-only scheduling were all fine. The cause was that `traceDrivingChain` followed
**capacity hops**: when an issue was `artificiallyDelayed`, the walk stepped sideways onto the team
track via `ScheduledWorkNode.previous` and continued from whatever epic happened to be sitting
there. On a plan where one team's tracks are saturated, that single backward walk snaked through
most of the plan, so most epics were "on the driving chain" in every iteration.

Reproduced in isolation before changing anything — twelve completely unlinked epics on one
one-track team, ten iterations: **all twelve reported criticality 1.0 and queued 0**. Split across
four teams: 0.2–0.3 each.

Two changes, both landed and covered by tests:

1. **`critical-path-trace.ts` — the walk follows blocker links only.** It steps from an issue to
   the blocker that finished last and stops at an issue with no blockers. Capacity delay is now
   reported as the delayed issue's own `queuedDays` rather than as extra chain members. Also added
   the issue-key tiebreak the spec asked for.
2. **`queuedDays` is no longer forced to 0 for unblocked issues.** It was
   `linkedBlockedBy.length > 0 ? startDay − earliestStartFromBlockers : 0`. The spec defines queued
   as `startDay − earliestStartFromBlockers`, and an unblocked issue's earliest start is 0 — so the
   special case hid exactly the capacity queueing the column exists to show (concern 3 below).
3. **`build-critical-paths.ts` — the first epic's queued days are excluded from the row span**,
   since chain span runs from the _first epic's start_ to the last epic's end. Including them made a
   single late-starting epic report a span close to the whole plan length.

`traceDrivingChain` no longer needs `nodeByWorkItem` / `issueByWorkItem`, so `buildNodeByWorkItem`
and its per-iteration `WorkPlans.workNodes()` pass are gone from `monte-carlo.ts`.

**This deviates from `README.md`, deliberately.** The README says the walk should follow the track
predecessor on a capacity hop. Following it produces the saturation above, and it contradicts the
README's own invariant that work + queued sums to the chain span (a capacity-hop chain is
contiguous, so its queued time is zero by construction). The mockup's chains are dependency chains
with queue gaps in them. The dependency-only walk satisfies the invariant exactly and matches the
mockup; the README should be amended when this resumes.

### Where it was when paused

Measured in the app against `type = Initiative and project = "Itsy Marketplace"` (~92 rows, plan
total 1238 working days), **after fixes 1–2 but before fix 3**:

|                     | before any fix           | after fixes 1–2          |
| ------------------- | ------------------------ | ------------------------ |
| rows at 100%        | 13+ unrelated leaf epics | 1                        |
| bottom of the table | all ~100%                | a long 0% tail           |
| worst "Total days"  | —                        | 1285 d, on a 1238 d plan |

So the ranking moved in the right direction but was not yet validated, and the day totals were
visibly wrong. Fix 3 addresses the specific 1285 d / 1192 d cases (a single epic reporting
"2 days work, 1190 days queued" — its queued time was its absolute start offset), **but the result
has not been re-checked in the app.** That is the first thing to do when this resumes.

### Known-remaining problems

1. **Row totals are still not a real duration.** `totalWorkDays` / `totalQueuedDays` sum per-issue
   means, and each of those means is conditioned on a _different_ subset of iterations
   (`meanWorkDays` divides by that issue's `onChainCount`, not by `iterations`). The README wants
   span measured per iteration, then read at the selected percentile. That **cannot** be done
   post-hoc: `stats-analyzer.ts` stores `startDays` / `dueDays` through
   `insertSortedArrayInPlace`, which sorts each issue's samples independently and so destroys
   per-iteration alignment across issues. It has to be accumulated inside `runBatch`.
2. **Epics that never drive the finish now show `0 d`.** Honest, but it looks broken next to the
   mockup. Falls out of 1.
3. **Concerns 2, 3 and 4 below have not been re-evaluated** against the new numbers.
4. **`probabilisticallySelectIssueTiming` is dead.** `linkIssues(issues, flag)` accepts the
   parameter and never reads it, and `resetLinkedIssue` always uses
   `probablisticTotalDaysOfWork`. Confirmed by repro: passing `false` still produced varying work
   days. The README's "the trace is exactly the known chain, deterministically" test cannot be
   written until this is fixed. Related: `scheduleIssues` calls `resetLinkedIssue` again, so
   `runBatch`'s own reset loop re-samples every issue twice per iteration.

---

## 1. Bug: many unrelated epics all show 100% criticality on a large plan

> **Resolved** — see the status section above. The leads listed under this issue were all dead
> ends; the cause was capacity-hop following in `traceDrivingChain`. Kept for the record.

**Repro:** Load the Auto-Scheduler with a JQL that pulls in a large, mostly-disconnected set of
epics (`type = Initiative and project = "Itsy Marketplace"`, ~76 epics/tasks, many of them
completely unlinked leaf items with no blockers and nothing blocked by them). Open the new
"Critical Paths (new)" report at the bottom.

**Observed:** Rows 3 through at least 14 (and likely more) each show a **criticality index of
100%**, and most of them are single-epic chains with no fan-out — isolated leaf items such as:

- "due date only" (13 d)
- "GDPR Compliance" (13 d)
- "Save cart details for future recovery" (13 d)
- "2-10" (13 d)
- "Partially Complete" (13 d)
- "Earlier" (13 d)
- "Later" (13 d)
- "start date only" (13 d)
- "Upsell dev" (13 d)
- "2-15" (13 d)
- "2-14" (13 d)
- "UAT: Pet Photo Sharing" (25 d)
- "UAT: Customer Events" (61 d)

**Why this looks wrong:** Per `traceDrivingChain`/`CriticalityAccumulator`
(`src/react/reports/AutoScheduler/scheduler/critical-path-trace.ts`,
`src/react/reports/AutoScheduler/scheduler/criticality-accumulator.ts`), each Monte Carlo iteration
identifies exactly **one** global `lastIssue` (the single item with the latest `dueDay` across the
_entire_ plan — see `runBatch` in `monte-carlo.ts`), then walks backward from it. An issue's
criticality index is `onChainCount / iterations` — the fraction of iterations in which it appeared
on _that single_ backward-traced chain. For a plan with many unrelated, disconnected epics, it
should be structurally impossible for a dozen-plus completely independent leaf epics to each be on
the driving chain in 100% of iterations — only one chain can be "the" global driving chain in any
given iteration, so unrelated leaves should mostly show low/near-zero criticality, with only the
true long pole(s) approaching 100%.

**Leads for whoever investigates:**

- Confirm whether the simulation had actually completed (`percentComplete === 100`) when this
  screenshot was taken, vs. a mid-run snapshot with very few accumulated iterations — small-sample
  criticality percentages would be noisy, though it's still surprising for _so many_ unrelated
  items to each hit exactly 100%.
- Check `CriticalityAccumulator.merge()` (`criticality-accumulator.ts`) — confirm `iterations` and
  the per-key maps are accumulating correctly across all ~500 batches rather than resetting or
  double-counting.
- Check `buildNodeByWorkItem` / `issueByWorkItem` construction in `monte-carlo.ts`'s `runBatch` —
  confirm object identity of `mutableWorkItem` is actually stable/unique per issue across iterations
  (a bug here could cause unrelated issues' hops to be attributed to the wrong `issueKey`).
- Check whether items with only a due date / only a start date (e.g. "due date only", "start date
  only") are scheduled specially (pinned/anchored) in a way that could make `traceDrivingChain`
  treat them as always being the `lastIssue`, or always reachable, regardless of the rest of the
  plan.
- Compare against the **old** `CriticalPath.tsx` report's output for the same query (see below) —
  it produces plausible-looking, differentiated numbers ("Days in Critical Path": 193, 85, 82, 74,
  73, 68, 60, 57, 53, 51, 50, 48, 40, 40, 39, …) for the same data, which is a useful reference for
  what "sane" output should look like even though its ranking model is the one 024 set out to
  replace.

## 2. Concern: the new report's "old vs. new" comparison — the old report currently reads as more useful

Side-by-side on the same large query, the existing `CriticalPath.tsx` table ("First Epic" / "Days
in Critical Path" / "Following Epics in Critical Path" / "Days for All Blocked Work" / "Remaining
Blocked Epics") gives a wide, differentiated spread of numbers across ~76 rows and is easy to scan.
The new report, once the bug above is fixed, still needs to be checked against this bar — right now
it reads as _less_ useful specifically because of the 100%-everywhere bug, but it's worth
re-validating usefulness once the ranking is fixed rather than assuming the redesign is strictly
better.

## 3. Concern: queued time is never visible where the user expects it

> **Partly addressed** — `queuedDays` is no longer zeroed for unblocked issues, so capacity
> queueing now shows up on the chain rows. The fan-out total is still
> `Σ adjustedDaysOfWork` and still has no work/queued split. Not re-checked in the app.

**Observed (smaller, 2-epic-chain example):** Top-ranked row "Create a promotion → … → Wrong
promotion entered" (STORE-17 → STORE-18 → ORDER-23 → ORDER-26) shows **0% queued** (all-blue bar),
even though two sibling epics — "Promotion end-date error handling" (ORDER-24) and "Remove
promotion from cart" (ORDER-25) — are visibly queued behind ORDER-23/ORDER-26 on the same team
track in the Gantt chart above.

**Root cause (understood, not yet fixed):**

- The traced _driving chain_ is, by construction, the path with zero wasted time — every hop on it
  started exactly when its blocker/track allowed (`critical-path-trace.ts`'s
  `earliestStartFromBlockers` / `queuedDays` calculation), so a chain that's on the direct driving
  path will legitimately show 0% queued. This part is working as spec'd
  (`spec/024-critical-path/README.md`, "Queued" definition).
- The epics that actually experience the queuing (ORDER-24, ORDER-25) aren't part of the chain —
  they're **fan-out** (siblings blocked by the same predecessor, per `buildChain`/`addFanOut` in
  `build-critical-paths.ts`). Fan-out is currently rendered as a bare link list with a single total
  ("Other epics blocked by this chain · 24 days total"), and that total is computed from
  `fanOut.reduce((sum, wi) => sum + wi.adjustedDaysOfWork, 0)` — i.e. each item's raw estimated work
  days, **not** `meanWorkDays + meanQueuedDays`. So the actual queued/waiting time these siblings
  experience is invisible anywhere in the UI.

**Net effect:** a user looking at this report has no way to see "24 days" broken into work vs.
queued for the fan-out, and the one place queued time _is_ shown (the top chain) is definitionally
always low/zero for the #1-ranked row. This was flagged as a Minor, non-blocking finding in the
final whole-branch code review of the original 8-task POC, but it's the direct cause of real user
confusion ("I would expect to see some queuing because promotion end-date error handling and remove
promotion from cart are waiting") and is worth prioritizing higher than "Minor."

## 4. Concern: root-epic criticality is easy to misread as "this task causes the most delay"

Per spec (`spec/024-critical-path/README.md`, "Three definitions the implementation must not drift
from"): _"A row is ranked by the criticality of its root epic."_ In practice this means a
1-day task with no blockers of its own (e.g. "Create a promotion") can show a 100% criticality
index simply because it's the common ancestor of nearly every downstream chain in its subtree — not
because it personally drives delay. The number is technically correct per the spec's definition,
but the report doesn't currently do anything to head off the natural misreading ("why is this tiny
task the most critical thing?"). Worth deciding whether the copy/labeling needs to clarify that
criticality describes the _lineage_, not the individual epic's own impact.

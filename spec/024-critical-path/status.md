# Status — Epics on the critical path

**Last updated:** 2026-08-23
**Branch:** `feat/critical-path-epics` (based on `origin/main`)
**State:** Feature complete and green. Not reviewed, not merged, not verified against real Jira data.

---

## What this is

A report in the Auto-Scheduler that answers:

> If nobody ever had to wait for a free person, which epics would determine the finish date, and how many days does each one add?

This is deliberately **capacity-blind**. It measures the floor imposed by dependencies alone — the finish
this plan would reach if staffing were unlimited. That is a different question from the one the scheduler
answers, and the difference between the two numbers is the part of the timeline you could fix by hiring
or reassigning rather than by cutting scope. See [dependency-floor.md](dependency-floor.md).

---

## Files

### New

| File                                                                                   | Purpose                                                                | Tests |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----- |
| `src/react/reports/AutoScheduler/scheduler/longest-path.ts`                            | Longest dependency chain through the `Blocks` graph, ignoring capacity | 9     |
| `src/react/reports/AutoScheduler/scheduler/critical-path-accumulator.ts`               | Tallies path membership and days added across all simulation runs      | 10    |
| `src/react/reports/AutoScheduler/CriticalPathEpicsReport/build-critical-path-epics.ts` | Turns tallies into sorted rows; computes highlight sets                | 7     |
| `src/react/reports/AutoScheduler/CriticalPathEpicsReport/CriticalPathEpicsReport.tsx`  | The collapsible report                                                 | 11    |
| `src/react/reports/AutoScheduler/CriticalPathEpicsReport/index.ts`                     | Barrel export                                                          | —     |

### Modified

- `scheduler/monte-carlo.ts` — runs the longest-path pass once per iteration; carries a `CriticalPathAccumulator` on `BatchDatas`
- `scheduler/monte-carlo.test.ts` — coverage for the above
- `scheduler/stats-analyzer.ts` — merges per-batch accumulators; exposes `criticalPath` on `StatsUIData`
- `AutoScheduler.tsx` — mounts the report; also un-pauses `CriticalPathsReport` (see open questions)

---

## How it works

`findLongestPath` is a memoized depth-first walk over the blocking graph. For each epic it computes:

```
longestFrom(epic) = epic's own duration
                  + max(longestFrom(x)) over every epic x that this epic blocks
```

Each epic's answer is computed once and cached, which is what keeps this linear in
(epics + dependency links) rather than exponential in the number of distinct routes. Cycles are guarded
with an in-progress set that returns 0, so a malformed graph cannot hang the simulation.

**Placement matters.** The pass runs inside the iteration loop, _after_ durations are re-sampled and
_before_ `scheduleIssues`. It cannot move to `onBatch`, because `onBatch` sorts each epic's `daysOfWork`
independently and that destroys the per-iteration alignment this needs.

---

## The one significant design decision

**The critical-path work is unconditional. There is no feature flag. This was deliberate.**

The original plan gated it behind a `trackCriticalPath` flag so the cost was only paid when the report
was expanded. That flag sat in a React effect dependency array, so toggling it tore down the
`StatsAnalyzer` and **restarted the entire 10,000-run simulation**. Every number on the page re-converged
and visibly shifted.

Measured cost of simply always doing the work:

| Plan size | Simulation without it | With it | Extra          |
| --------- | --------------------- | ------- | -------------- |
| 50 epics  | 401ms                 | 437ms   | +36ms (9.0%)   |
| 200 epics | 1790ms                | 2077ms  | +287ms (16.0%) |
| 500 epics | 4722ms                | 5327ms  | +605ms (12.8%) |

About 13% always, versus 100% on every toggle. Gating was strictly worse, so the flag was removed.

> **Caveat on those numbers.** They came from a synthetic benchmark — generated epics with uniform
> estimates and regular dependency chains — and the harness was deleted afterward. Real plans have
> lopsided fan-out and deeper chains, which changes the edge count. The ratio should hold roughly, but
> this is not a measurement of production data.

Because the data is always present, `StatsUIData['criticalPath']` is non-nullable and there is no
"calculating…" state. The expand/collapse toggle is purely about vertical space.

---

## Verification status

| Check                                            | Result                           |
| ------------------------------------------------ | -------------------------------- |
| `npm run typecheck`                              | Clean                            |
| `npx vitest run src/react/reports/AutoScheduler` | 11 files, 75 tests passing       |
| `npm run test` (full suite)                      | 244 files, 2100 passing + 2 todo |
| Manual check against live Jira                   | **Not done**                     |
| Code review                                      | **Not done**                     |

The manual check is the last step of the plan and needs `npm run dev` plus real credentials.

---

## Open questions

### 1. Should `CriticalPathsReport` stay un-paused?

`AutoScheduler.tsx` currently re-enables the older `CriticalPathsReport`, which commit `926daf19`
deliberately disabled with the note _"paused while its ranking model is reworked."_ That rework did not
happen — this branch built a different, new report instead.

It is isolated in its own commit so it can be dropped without touching anything else. **Decide before merging.**

### 2. 10,000 runs, or 1,000?

For this report, 1,000 would be plenty — every figure it shows is a mean, and means converge fast. The
blocker is that `batches` is global, and the existing uncertainty slider reads the _tails_ of the
distribution, where fewer samples get noticeably noisier (the 95th percentile at 1,000 runs rests on
about 50 samples).

This is a ~10x speedup available from changing one number. Worth deciding on its own merits.

### 3. Performance: the bottleneck may not be the math

Investigated after a question about porting this to WebAssembly. `runMonteCarlo` runs **on the main
thread**, chopped into 500 batches with `setTimeout(fn, 1)` between them. Browsers clamp nested timers to
a 4ms minimum, so roughly **2 seconds of every run is the browser deliberately idling** — untouchable by
any speedup to the computation.

Cheaper options, in the order they should be tried:

1. **Fewer, larger batches.** `batches` and `batchSize` are already parameters. 50 x 200 does identical
   work with a tenth of the scheduling overhead. Costs only progress-bar granularity.
2. **Fewer runs** (open question 2 above) — a straight 10x.
3. **A Web Worker.** Removes main-thread blocking entirely, lets the batching and timer chain be deleted,
   and sidesteps background-tab throttling. Roughly a day; the pure functions barely change.
4. **WebAssembly** — only if compute is still the wall afterward. Port the _whole_ loop, not just
   `findLongestPath`, or 10,000 boundary crossings will eat the gains.

**None of this is measured on real data.** The 4ms clamp is specification behavior and is reliable; the
actual waiting-versus-computing split in this app is not yet known. Measure that first — it determines
whether steps 1-3 are already sufficient.

### 4. Possible background-tab defect

While investigating the above, a timer loop in a backgrounded tab failed to complete in a timeframe
consistent with normal 1-second background throttling. If that is what is happening, a simulation started
and then backgrounded would take roughly **8 minutes** instead of 5 seconds. **Unconfirmed** — the
observation came through a flaky browser-automation path. Worth 15 minutes to check deliberately, since a
Web Worker (option 3) would fix it as a side effect.

### 5. The plan document is stale

[plans/2026-08-12-critical-path-epics.md](plans/2026-08-12-critical-path-epics.md) still describes the
flag-gated design in roughly five places: the architecture summary, Task 3, Task 6, Q6, and two
"Known gaps" bullets. It has not been updated to match what shipped.

---

## Deviations from the plan as written

Two genuine defects were found in the plan during implementation and fixed:

1. **Task 1's random number generator overflowed.** The specified `seed * 1103515245` exceeds 2^53 and
   silently loses precision in float64. Replaced with `Math.imul(seed, 1103515245)`.
2. **Task 5 had an ambiguous assertion.** `getByText('3.0')` matched two elements. Scoped to the
   residual row via `closest('tr')`.

Also, the plan claimed no `DerivedIssue` fixtures existed. They did — `makeDerivedIssue` — so two
integration tests were added using it.

---

## Picking this back up

```sh
git checkout feat/critical-path-epics
npm run typecheck && npx vitest run src/react/reports/AutoScheduler
```

Suggested order: decide open question 1 (it blocks merging), then get a review, then the manual check
against real data. Questions 2-4 are performance work that can be split into a follow-up branch.

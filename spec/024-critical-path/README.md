# 024 — Critical Paths

Make the critical path usable: fix the model that decides which path is critical, then give it a
home of its own so it can be seen without scrolling past the whole Auto-Scheduler, and embedded in a
Report of Reports without one.

- [idea.md](./idea.md) — the original ask.
- [mockups/critical-paths.html](./mockups/critical-paths.html) — the redesigned report, the team-load
  section, four placement options, and the report-of-reports states. Open it in a browser.
- [critical-path.png](./critical-path.png) / [autoscheduler.png](./autoscheduler.png) — today.

The work splits cleanly in two, and the order matters: **fixing the model changes what the report is
able to say**, so building the UI first would mean designing around numbers we are about to replace.

---

## Fixing the model — it names the wrong long pole

### What is deterministic today

[`CriticalPath.tsx`](../../src/react/reports/AutoScheduler/CriticalPath.tsx) ranks paths with
`sortWorkItemsByBlocksWorkDepth` (line 21), which reads `linkedIssue.blocksWorkDepth`. That value is
assigned in exactly one place —
[`link-issues.ts:67-80`](../../src/react/reports/AutoScheduler/scheduler/link-issues.ts), from
`derivedTiming.deterministicTotalDaysOfWork` — and nothing else ever writes it. `resetLinkedIssue`
(line 61) re-samples `mutableWorkItem.daysOfWork` every iteration but leaves `blocksWorkDepth`
alone, and `runBatch` never touches it.

So the path structure is fixed before iteration 1. The Monte Carlo contributes exactly one thing to
this report: `adjustedDaysOfWork`, used for the day totals it prints.

### Why that is wrong, not merely approximate

Consider two chains, where the middle stage of A is three parallel 9-day epics:

```
A:  10 days → [9 days, 9 days, 9 days] → 10 days
B:  10 days → 10 days → 10 days
```

`setBlocksWorkDepthDeterministically` gives A's root `10 + (9 + 10) = 29` and B's root
`10 + (10 + 10) = 30`. B ranks above A, permanently, at every uncertainty setting.

But A's middle stage completes at the **max** of three draws, and with any real variance
`E[max]` exceeds 9 — enough of the time, past 10. Under simulation A is the longer pole. The current
report cannot express this at any uncertainty setting, because the ranking never sees a sample.

The same failure is visible in real data. In [critical-path.png](./critical-path.png), "Tablet Mode
UI Enhancements" is listed second purely because 132 days is the second-largest number. It is long but
it has slack, so it rarely decides the finish date — the mockup ranks it fourth, at 12% criticality.

### A second, independent inconsistency

`totalDaysInCriticalPath` sums each issue's `adjustedDaysOfWork` — a per-issue P80 — along the chain.
For independent draws the P80 of a sum is well below the sum of P80s, and the sum ignores queueing
delay entirely. So "257 days" in the current report is neither a P80 duration nor an elapsed time. It
is not a duration at all.

Compounding it: `resetLinkedIssue` calls `getEstimationData(issue, {})`, so
`deterministicTotalDaysOfWork` is computed at that function's hardcoded `uncertaintyWeight = 80`
([`work-timing.ts`](../../src/jira/derived/work-timing/work-timing.ts)). `blocksWorkDepth` is
therefore _itself_ a sum of per-item P80s — the same error, baked into the ranking.

### The fix: trace the driving chain per iteration

Each iteration of `runBatch`
([`monte-carlo.ts:77`](../../src/react/reports/AutoScheduler/scheduler/monte-carlo.ts)) already
produces a complete schedule. Walk backward from the last-finishing item, asking at each hop what
made this item start when it did:

- `mutableWorkItem.artificiallyDelayed` is set ([`workplan.ts:100,126`](../../src/react/reports/AutoScheduler/scheduler/workplan.ts))
  exactly when the item was pushed past its blocker-ready date by its own team's track. The driver is
  then the track predecessor (`ScheduledWorkNode.previous`) — a **capacity hop**.
- Otherwise the driver is the argmax of `linkedBlockedBy` by end day, which
  `earliestStartTimeFromBlockers` ([`schedule.ts:107`](../../src/react/reports/AutoScheduler/scheduler/schedule.ts))
  already computes — a **dependency hop**.

Accumulated across iterations this yields, per epic, a **criticality index**: the share of
simulations in which it was on the driving chain. That replaces `blocksWorkDepth` as the ranking
signal, and the dependency/capacity hop split becomes the work/queued breakdown in the UI.

### Three definitions the implementation must not drift from

**Criticality index** — of an epic: the fraction of iterations in which it appeared on the traced
driving chain. A row is ranked by the criticality of its **root** epic.

**Chain span** — of a row: the days from the first epic's start to the last epic's end. A row's chain
is fixed once (by the criticality-ordered greedy pass), so its span can be measured in every
iteration; the reported figure is the value at the selected uncertainty percentile, indexed exactly
as `getUncertaintyThresholdData` (`stats-analyzer.ts:156`) already does, so it agrees with the
Auto-Scheduler's bars.

It is deliberately **not** the plan length: in any single iteration the chain that drives the finish
date runs from day 0 to the last day, so that quantity is identical for every row and useless as a
column.

**Queued** — `startDay − earliestStartTimeFromBlockers(issue)`: the gap between an epic being
unblocked and its team's track having room. Work + queued along a traced chain sums to the chain
span, because the trace is contiguous by construction. The reported split is the **mean share** of
span across iterations, applied to the percentile span above — so the two segments always add to the
number printed beside them.

### Queued time is a floor, and the UI must say so

The scheduler only sees the epics loaded into the plan. The thing occupying a team's track during a
"queued" gap is **another epic in this plan**. Work a team does outside the plan is invisible to the
model; it enters only through `pointsPerDayPerTrack` and `parallelWorkLimit` in team configuration.

Consequences, which are requirements on the copy and not merely notes:

- The orange segment is labeled **"Queued behind other plan work"**, never "waiting on team".
- The team-load section reports **plan load** and names the exclusion. It does not declare a team
  over-capacitated: a team also carrying substantial unmodeled work is already past 100% while the
  panel still reads 92%.
- Every queued figure is a floor. Real waiting is equal or worse, never better.

### Sharp edges

**Blocks cycles.** A cycle in Jira link data would loop the backward walk forever, so it needs a
visited set and a hop cap. This is pre-existing fragility — `areAllBlockersScheduled`
(`schedule.ts:103`) already deadlocks on a cycle, leaving `startDay` null and making
`earliestStartTimeFromBlockers` throw for anything downstream — but the trace is where it becomes
visible, so it must fail safely rather than hang.

**Ties.** Equal end days need a deterministic tiebreak (issue key), or the trace jitters run to run
for no real reason and the report looks unstable.

**Chains that leave the query.** `linkDirectBlocks` (`link-issues.ts:111`) drops blockers whose keys
aren't in the result set. A chain can therefore dead-end at an item whose real predecessor is outside
the JQL. The walk handles this correctly; the UI must distinguish "chain starts here" from "chain
continues outside your query" rather than presenting the second as the first.

**Node lookup.** Finding the track predecessor needs a `WorkItem → ScheduledWorkNode` back-pointer,
set in `WorkPlan.append`/`prepend` (~4 lines, 2 sites). Rebuilding a map per iteration instead would
add an O(n) pass to all 10,000 of them.

**Performance.** The walk is O(chain length) per iteration, against a full schedule plus four sorted
inserts per issue that each iteration already pays. Not expected to be measurable; worth confirming
once rather than assuming.

### The fixture gap is the real cost

[`monte-carlo.test.ts:6-9`](../../src/react/reports/AutoScheduler/scheduler/monte-carlo.test.ts) says
it outright:

> The scheduler pipeline (linkIssues → scheduleIssues → runBatch) all handle an empty issue set, so
> we can exercise the batch-loop / teardown control flow without building DerivedIssue fixtures.

Every existing scheduler test runs on `[]`. There is **no coverage of scheduling behavior at all**,
so the model work has to build the harness first: a `scheduler/fixtures.ts` following the established
`makeIssue` pattern from [`GanttGrid/fixtures.ts`](../../src/react/reports/GanttReport/GanttGrid/fixtures.ts).

One subtlety will produce tests that pass for the wrong reason if missed: `linkIssues` reads the
**precomputed** `derivedTiming.deterministicTotalDaysOfWork`, while `resetLinkedIssue` **re-derives**
per iteration via `getEstimationData(issue, {})`. A hand-written fixture can easily make those
disagree. The builder should call `getEstimationData` itself so they cannot.

Variance comes from `confidence` via `sampleExtraPoints`, so the A/B case above is directly
expressible: set confidence below 100 on the three 9-day epics and assert A is critical more often
than B. That is the regression test for the defect this part exists to fix. The harness is reusable
well beyond 024.

### Tests

| Test                                        | Asserts                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A/B fixture, confidence < 100               | A's root has a higher criticality index than B's — the defect, pinned                                         |
| `probabilisticallySelectIssueTiming: false` | the trace is exactly the known chain, deterministically                                                       |
| capacity hop                                | two epics on a one-track team, no link between them → the later one's delay is attributed as queued, not work |
| dependency hop                              | a blocked epic starting the day its blocker ends → attributed as work, zero queued                            |
| work + queued                               | sums to chain span for every traced chain                                                                     |
| cycle fixture                               | terminates and reports, rather than hanging                                                                   |
| tie fixture                                 | identical results across repeated runs                                                                        |
| chain leaving the query                     | flagged as continuing outside the result set, not as a chain start                                            |

### Files

| File                          | Change                                                     |
| ----------------------------- | ---------------------------------------------------------- |
| `scheduler/workplan.ts`       | work-item → node back-pointer (~4 lines)                   |
| `scheduler/monte-carlo.ts`    | the backward trace + per-iteration accumulation            |
| `scheduler/stats-analyzer.ts` | criticality counts and hop-type totals into `dataForUI`    |
| `scheduler/fixtures.ts`       | **new** — the harness described above                      |
| `scheduler/critical-paths.ts` | **new** — cone assembly, moved out of the component        |
| `CriticalPath.tsx`            | deletes both recursive functions (~45 lines); net negative |

---

## Redesigning and relocating the report

### Its own report type

Showing critical paths in a Report of Reports without the full Auto-Scheduler settles this on its
own. Embedding `auto-scheduler` with a view param would work mechanically, but the Add
Report picker takes its names and icons from `reports.ts` (see
[spec/023](../023-report-modal/README.md)), so it would list "Auto-Scheduler" and nobody would find
it.

| Registration          | Value                                                                |
| --------------------- | -------------------------------------------------------------------- |
| `reports.ts` key      | `critical-path`                                                      |
| Name                  | Critical Paths                                                       |
| Feature flag          | `criticalPath`, `onByDefault: false`                                 |
| `registry.ts`         | `embeddableReportComponents['critical-path']`                        |
| `report-type-meta.ts` | new `ReportTypeTone` — chain-link icon, per 023's per-type icon rule |

`features.ts` derives its list from `reports.ts`, so the flag appears in settings automatically.

### The report

Drawn as "The report, redesigned" in [the mockup](./mockups/critical-paths.html), then simplified
twice after review. First pass replaced today's five-column grid with ranked rows carrying a
segmented bar plus the full spelled-out chain — still too much to scan at once. Second pass dropped
the bar and chain entirely in favor of a bare text row — lost the at-a-glance work/queued signal that
made the mockup's other placements (the Auto-Scheduler strip, the dropdown) easy to read. What's kept
now is that strip's density: one compact line per path, everything else behind a disclosure.

**Collapsed row** — one line per path, five columns, under a real header row (CSS Grid, so the
header and every row share one column definition — no separate legend needed, since "Work"/"Queued"
swatches sit directly in the header cell they label):

| Criticality index | Critical path           | Work · Queued | Total days |
| ----------------- | ----------------------- | ------------- | ---------- |
| 1 · 78%           | Epic X.1 → … → Epic X.6 | ▬▬▬▬▬▬▬▬▓▓▓▓  | 257 d      |

"Criticality index" itself spans three grid columns — the expander, the rank number, and the
percent — since those three together are what the header names.

- **Chain** always shows just the first epic → `…` → the last epic, not every epic spelled out —
  that's what made the earlier version wide and slow to scan. The full chain, in order, lives in the
  expanded detail.
- **Work / queued** is a small two-color bar, scaled to a shared max span so rows are comparable —
  the same encoding as the mockup's Auto-Scheduler strip, just also present in the standalone report.
- Top 5, then "Show more".

**Expanded row** (disclosure per path) adds:

- **Full chain** — every epic in the chain as linked chips. No row-level team tag: a chain is built
  from capacity hops (necessarily same-team) and dependency hops (which can jump to any team), so it
  routinely crosses teams — a single tag would misrepresent it.
- **Biggest epic by days of work** — the single largest work item on the chain, e.g. "Epic X.2 — 41
  days". Answers "what's the biggest piece of scope on this chain?" — the epic to split or descope
  if you want to shorten it.
- **Biggest epic by queued delay** — the hop with the longest queued gap before it started, e.g.
  "Epic X.4 — 38 days queued behind ADJ3's other epics". Answers a different question — "where's the
  capacity bottleneck?" — and descoping the epic above wouldn't touch this number, since some other
  epic would just queue in its place. Both are shown because they can and often do point at
  different epics.
- **Other epics blocked by this chain** — the fan-out, as a list, with the total days across it, e.g.
  "119 days across 6 blocked epics".

Encoding rules for the bar carry over unchanged from the earlier draft: palette `#0c66e4` /
`#b65c02`, validated (CVD ΔE 30.2 protan, 26.3 tritan, normal-vision 34.2), a legend since there are
two series, and values also present as text so nothing is color-only.

### Team load

A section of this report (drawn as "Team load callout" in the mockup), not a separate report — it
comes from the same trace, and the two corroborate: ADJ3 filling 92% of the plan is _why_ 115 of the
top path's 257 days are queued.

Horizontal bars, one series in one color with the largest emphasized — explicitly **not** a value
ramp, which would double-encode bar length as hue. Titled "Team load in this plan", subtitled with
the out-of-plan exclusion, and worded as an observation rather than a verdict, for the reasons under
"Queued time is a floor" above.

This supersedes the raw `Total Working Days` currently printed per team in
[`AutoScheduler.tsx:237`](../../src/react/reports/AutoScheduler/AutoScheduler.tsx), which cannot
answer "is this team over capacity?" because it is not measured against anything.

### In the Auto-Scheduler

**A button labeled "Critical paths" in the Auto-Scheduler's controls row**, alongside Report type,
Report on, the uncertainty slider, and Start date. It opens a dropdown listing the paths ranked by
criticality — each line showing the percentage, the chain (`Epic X.1 → … → Epic X.6`), and its day
span. Clicking a line highlights that path in the timeline grid below. A button at the bottom of the
dropdown, **Open full Critical Paths report**, navigates to the standalone report. This is the design
idea.md describes first; it is drawn as the third of the four placements in
[the mockup](./mockups/critical-paths.html).

The collapsed **"Critical Paths — Identify the long poles in your plan"** section at the bottom of
the page ([`AutoScheduler.tsx:273`](../../src/react/reports/AutoScheduler/AutoScheduler.tsx)) **is
deleted**, and its two jobs split: highlighting a path moves into the dropdown, the full listing
becomes the standalone report.

Highlighting keeps today's behavior: `gridifyStatsUIData` hides every row except the
highlighted path's issues (`AutoScheduler.tsx:494-508`). A real plan can be large enough that
dimming still leaves too much on screen to make the selected chain readable — hiding the rest is
what makes "just this path" legible at plan scale. The tradeoff (losing surrounding context) is
accepted;
that context is recoverable by clearing the selection.

Recorded tradeoff: of the four placements drawn in the mockup, a button-and-dropdown is the weakest
against the complaint that the report is easy to miss, because a control still has to be clicked. It
is a large improvement over a collapsed section below a multi-screen grid, so it does help — just not
as much as the always-visible strip of the top three paths above the grid would have.

### In a Report of Reports

Top 5 with "Show more", compact one-line rows (drawn as "Inside a Report of Reports" in the mockup).
Criticality requires the simulation, so
the critical-path-specific loading state from idea.md is unavoidable — and it should say what it is
doing ("Simulating 10,000 schedules to find the long poles…") rather than showing a bare spinner.

**Hold the skeleton, then reveal.** Ranking is unstable until the simulation is well along, so rows
must not stream in and reshuffle.

**Embedded instances run ~2,000 iterations, not 10,000.** Criticality is a frequency estimate and
converges much faster than a date distribution, so this is ~5× cheaper for essentially unchanged
ranking — without which a document holding three of these runs three full simulations on the main
thread. Accepted consequence: an embedded report's percentages can differ slightly from the same
report opened standalone.

---

## Decisions

| Decision                                              | Rationale                                                                                                                                                                                                                  |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fix the model before redesigning the UI               | The model fix changes what the report can say                                                                                                                                                                              |
| Criticality replaces `blocksWorkDepth` **throughout** | Cone roots _and_ next hops. Re-sorting rows at the end is not enough — the greedy pass at `CriticalPath.tsx:89-101` picks roots, so a high-criticality epic could be swallowed into another cone and never appear as a row |
| Keep the work/queued split                            | It answers "cut dependencies or add capacity?", the most actionable output of the trace — scoped explicitly to in-plan queueing                                                                                            |
| Team load lives in this report                        | Same trace; the two findings corroborate                                                                                                                                                                                   |
| "Critical paths" button + dropdown in the controls    | idea.md's first option                                                                                                                                                                                                     |
| Report of Reports: fewer iterations                   | Cheapest fix to a real cost, no new architecture                                                                                                                                                                           |

## Non-goals

- **Slack** — how far a chain can slip before the finish date moves. The classic complement to
  criticality, a property of the schedule rather than a claim about teams, and it falls out of the
  same trace. Deliberately deferred.
- **Sharing one simulation across a document** by deduping on `(jql, uncertaintyWeight)`, the way
  `ChildQueryGroups` already dedupes identical Jira requests. The right answer eventually; not
  needed once embedded instances run fewer iterations.
- **Nesting** — unchanged; a Report of Reports still cannot contain one.

## Out of scope — pre-existing bugs found while reading

- `resetLinkedIssue` calls `getEstimationData(issue, {})`, which skips the user's configured
  story-point and confidence defaults and pins `uncertaintyWeight` to the function's hardcoded 80.
- `Blocks` cycles deadlock the scheduler today (`areAllBlockersScheduled` never becomes true, so
  `earliestStartTimeFromBlockers` throws downstream). The chain trace must not hang on them, but
  fixing the scheduler's own behavior is separate.
- `CriticalPath.tsx:131` ships a `console.log` in the highlight toggle.
  </content>

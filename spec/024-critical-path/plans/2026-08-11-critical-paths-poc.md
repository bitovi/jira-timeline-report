# Critical Paths Report (POC) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working proof-of-concept of the redesigned "Critical Paths" report described in
[spec/024-critical-path/README.md](../../../spec/024-critical-path/README.md) and
[spec/024-critical-path/mockups/critical-paths.html](../../../spec/024-critical-path/mockups/critical-paths.html),
rendered below the existing `<CriticalPath>` report inside the Auto-Scheduler, with real data from the
Monte Carlo simulation — not mock data.

**Architecture:** Add a per-iteration backward trace (capacity hop vs. dependency hop, per the README)
inside `runBatch`, accumulate it into a per-issue criticality index and mean work/queued days across all
10,000 iterations, reuse the existing `CriticalPath.tsx` row-grouping shape (root epic → chain → fan-out)
with the new signal instead of `blocksWorkDepth`, and render it with a new React component that mirrors
the mockup's compact grid rows. Expanding a row reuses the existing `workItemsToHighlight` state so the
Auto-Scheduler grid hides everything not on that path — exactly like `<CriticalPath>` does today.

**Tech Stack:** React + TypeScript, Vitest + React Testing Library, Tailwind CSS, existing Monte Carlo
scheduler in `src/react/reports/AutoScheduler/scheduler/`.

## Global Constraints

- Non-destructive: `<CriticalPath>` (the existing report) is left untouched and keeps rendering. The new
  report is added _below_ it in `AutoScheduler.tsx`, for side-by-side comparison. Do not delete or modify
  `CriticalPath.tsx`.
- Reuses `workItemsToHighlight` / `setWorkItemsToHighlight` — the same `Set<string> | null` state already
  threaded through `AutoScheduler.tsx` and `gridifyStatsUIData` (`AutoScheduler.tsx:493-508`). Do not
  introduce a second highlight mechanism.
- Palette for the work/queued bar: `--series-work: #0c66e4`, `--series-wait: #b65c02` (validated CVD-safe
  pair, per the README and mockup). Always pair color with text/labels — never color-only.
- Copy rule from the README: the queued segment must never be described as "waiting on team" — use
  "queued" / "queued behind other plan work".
- Follow `.github/copilot-instructions.md`: React only for new UI (no new CanJS), Atlaskit + Tailwind for
  styling, colocated `*.test.ts(x)` files, `npm run typecheck` and `npm run test` must pass.

## Design Decisions (read before implementing — flag disagreements before Task 1)

1. **Last-finishing issue, ties broken by first-found.** Multiple issues can share the plan's `lastDay`
   in a given iteration. `runBatch` already loops `linkedIssues` computing `dueDay` per issue; the trace
   starts from whichever issue _first_ reaches the running `lastDay` maximum (strict `>`, not `>=`), i.e.
   the same issue order used elsewhere in the file. This is a simplification — ties are rare and this
   keeps the trace deterministic per iteration.
2. **Row/chain construction reuses today's shape, with the new signal.** `CriticalPath.tsx` already
   builds rows by: pick the highest-signal un-claimed root, walk forward through `linkedBlocks` picking
   the highest-signal branch each time (the "chain"), and fold every other branch into "other blocked
   work" (the fan-out). This POC keeps that exact shape (`recursivelyAddToCriticalPath` /
   `recursivelyAddToOtherBlockedWork`), swapping the sort key from `blocksWorkDepth` to the new
   `criticalityIndex` (falling back to `blocksWorkDepth` to break ties). This is _not_ the same thing as
   "the modal per-iteration traced chain" — it's today's proven greedy construction, driven by the new
   empirical signal instead of the old summed-P80 one. Flagging this because the README's wording ("a
   row's chain is fixed once by the criticality-ordered greedy pass") is consistent with this approach,
   but doesn't fully pin down the algorithm — if you want the row's chain to instead be the literal most
   common per-iteration traced path, that's a follow-up, not in this POC.
3. **Row's "Days" column is `meanWorkDays + meanQueuedDays` summed across the chain**, not a percentile
   chain span computed via `getUncertaintyThresholdData`. The README calls for the latter; this POC uses
   the simpler sum (which the README also states holds by construction) to avoid adding a second
   per-chain simulation-array tracking pass. Flagged as a follow-up, not blocking for a POC.
4. **Criticality index and mean work/queued days are per-_issue_, accumulated globally** across all
   iterations (not scoped to a specific row's chain). A row's "Work / queued" bar and "Days" total are
   then the sum of each chain member's own mean values. This matches the README's "Queued — ... reported
   split is the mean share of span across iterations" for a single issue, extended by summation across a
   chain.
5. **No team tag anywhere** (per the mockup decision earlier in this session) — a chain can cross teams,
   so no row- or chain-level team label is shown.

## File Structure

- Modify `src/react/reports/AutoScheduler/scheduler/workplan.ts` — export `ScheduledWorkNode` (currently
  private) so the trace can type the node-lookup map.
- Create `src/react/reports/AutoScheduler/scheduler/critical-path-trace.ts` — pure function that walks
  backward from a given issue, classifying each hop as `capacity` / `dependency` / `root`.
- Create `src/react/reports/AutoScheduler/scheduler/critical-path-trace.test.ts` — unit tests for the
  trace with hand-built fixtures (no real Monte Carlo run needed).
- Create `src/react/reports/AutoScheduler/scheduler/criticality-accumulator.ts` — `CriticalityAccumulator`
  class that turns a stream of per-iteration traces into per-issue criticality index + mean work/queued
  days, and can `merge()` across batches.
- Create `src/react/reports/AutoScheduler/scheduler/criticality-accumulator.test.ts` — unit tests.
- Modify `src/react/reports/AutoScheduler/scheduler/monte-carlo.ts` — `runBatch` builds the per-iteration
  node lookup, finds the last-finishing issue, runs the trace, and folds it into a `CriticalityAccumulator`
  returned on `BatchDatas`.
- Modify `src/react/reports/AutoScheduler/scheduler/monte-carlo.test.ts` — add a test with a small linked
  fixture asserting the returned accumulator has sane counts.
- Modify `src/react/reports/AutoScheduler/scheduler/stats-analyzer.ts` — `StatsAnalyzer` keeps a running
  `CriticalityAccumulator`, merges each batch into it, and each `SimulationIssueResult` in `dataForUI()`
  gains `criticalityIndex`, `meanWorkDays`, `meanQueuedDays`.
- Create `src/react/reports/AutoScheduler/scheduler/stats-analyzer.test.ts` — unit test for the new fields
  (no test file exists for this module yet).
- Create `src/react/reports/AutoScheduler/CriticalPathsReport/build-critical-paths.ts` — row builder:
  adapts `CriticalPath.tsx`'s recursive chain/fan-out construction to the new signal and new fields
  (criticality %, work/queued days, biggest-by-work, biggest-by-queued-delay).
- Create `src/react/reports/AutoScheduler/CriticalPathsReport/build-critical-paths.test.ts`.
- Create `src/react/reports/AutoScheduler/CriticalPathsReport/CriticalPathsReport.tsx` — the UI component,
  mirroring the mockup: CSS Grid header + rows, first→…→last chain text, work/queued bar, expand for
  detail, wired to `workItemsToHighlight`.
- Create `src/react/reports/AutoScheduler/CriticalPathsReport/CriticalPathsReport.test.tsx` — RTL test.
- Create `src/react/reports/AutoScheduler/CriticalPathsReport/index.ts` — barrel export.
- Modify `src/react/reports/AutoScheduler/AutoScheduler.tsx` — render `<CriticalPathsReport>` directly
  below the existing `<CriticalPath>` (~line 329-333).

---

### Task 1: Export `ScheduledWorkNode` from `workplan.ts`

**Files:**

- Modify: `src/react/reports/AutoScheduler/scheduler/workplan.ts:17`

**Interfaces:**

- Produces: `ScheduledWorkNode` (exported class/type), already has public `.work: ScheduledWorkItem`,
  `.previous: ScheduledWorkNode | null`, `.next: ScheduledWorkNode | null` — used by Task 2's node lookup.

- [ ] **Step 1: Export the class**

Change line 17 of `workplan.ts` from:

```ts
class ScheduledWorkNode {
```

to:

```ts
export class ScheduledWorkNode {
```

- [ ] **Step 2: Verify no other change is needed**

Run: `npm run typecheck`
Expected: no new errors (the class was already structurally public via `WorkPlans.workNodes()`'s return
type; this just allows importing the type by name elsewhere).

- [ ] **Step 3: Commit**

```bash
git add src/react/reports/AutoScheduler/scheduler/workplan.ts
git commit -m "chore: export ScheduledWorkNode for critical-path trace"
```

---

### Task 2: Backward driving-chain trace

**Files:**

- Create: `src/react/reports/AutoScheduler/scheduler/critical-path-trace.ts`
- Test: `src/react/reports/AutoScheduler/scheduler/critical-path-trace.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks except the exported `ScheduledWorkNode` type (Task 1) for typing
  the node-lookup map (structurally — the test fixtures below don't need the real class).
- Produces:

  - `type Hop = { issueKey: string; hopType: 'capacity' | 'dependency' | 'root'; workDays: number; queuedDays: number }`
  - `function earliestStartFromBlockers(issue: TraceLinkedIssue): number`
  - `function traceDrivingChain(startIssue: TraceLinkedIssue, nodeByWorkItem: Map<TraceWorkItem, { work: TraceWorkItem; previous: { work: TraceWorkItem } | null }>, issueByWorkItem: Map<TraceWorkItem, TraceLinkedIssue>): Hop[]`
  - `interface TraceWorkItem { startDay: number; daysOfWork: number; artificiallyDelayed: boolean }`
  - `interface TraceLinkedIssue { key: string; mutableWorkItem: TraceWorkItem; linkedBlockedBy: TraceLinkedIssue[] }`
  - Used directly by Task 4 (`monte-carlo.ts`) and Task 6 (`build-critical-paths.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
// src/react/reports/AutoScheduler/scheduler/critical-path-trace.test.ts
import { describe, it, expect } from 'vitest';
import {
  traceDrivingChain,
  earliestStartFromBlockers,
  type TraceLinkedIssue,
  type TraceWorkItem,
} from './critical-path-trace';

function makeIssue(key: string, startDay: number, daysOfWork: number, artificiallyDelayed = false): TraceLinkedIssue {
  return {
    key,
    mutableWorkItem: { startDay, daysOfWork, artificiallyDelayed },
    linkedBlockedBy: [],
  };
}

function nodeMapFrom(chainInStartOrder: TraceLinkedIssue[]) {
  // Builds a same-team single-track node chain: chainInStartOrder[0] is earliest on the track.
  const nodeByWorkItem = new Map<TraceWorkItem, { work: TraceWorkItem; previous: { work: TraceWorkItem } | null }>();
  let previous: { work: TraceWorkItem } | null = null;
  for (const issue of chainInStartOrder) {
    const node = { work: issue.mutableWorkItem, previous };
    nodeByWorkItem.set(issue.mutableWorkItem, node);
    previous = node;
  }
  return nodeByWorkItem;
}

function issueMapFrom(issues: TraceLinkedIssue[]) {
  const issueByWorkItem = new Map<TraceWorkItem, TraceLinkedIssue>();
  issues.forEach((issue) => issueByWorkItem.set(issue.mutableWorkItem, issue));
  return issueByWorkItem;
}

describe('earliestStartFromBlockers', () => {
  it('is 0 with no blockers', () => {
    const issue = makeIssue('A', 0, 5);
    expect(earliestStartFromBlockers(issue)).toBe(0);
  });

  it('is the max end day across blockers', () => {
    const blockerA = makeIssue('B1', 0, 3); // ends day 3
    const blockerB = makeIssue('B2', 0, 7); // ends day 7
    const issue = makeIssue('A', 7, 2);
    issue.linkedBlockedBy = [blockerA, blockerB];
    expect(earliestStartFromBlockers(issue)).toBe(7);
  });
});

describe('traceDrivingChain', () => {
  it('follows a capacity hop to the track predecessor', () => {
    // Same team, one track: B finishes day 5, A starts day 5 with no blockers — but marked
    // artificiallyDelayed because the track, not a dependency, is what pushed it.
    const trackPredecessor = makeIssue('B', 0, 5);
    const startIssue = makeIssue('A', 5, 4, true);
    const nodeByWorkItem = nodeMapFrom([trackPredecessor, startIssue]);
    const issueByWorkItem = issueMapFrom([trackPredecessor, startIssue]);

    const hops = traceDrivingChain(startIssue, nodeByWorkItem, issueByWorkItem);

    expect(hops).toEqual([
      { issueKey: 'A', hopType: 'capacity', workDays: 4, queuedDays: 0 },
      { issueKey: 'B', hopType: 'root', workDays: 5, queuedDays: 0 },
    ]);
  });

  it('follows a dependency hop to the blocker with the latest end day', () => {
    const earlyBlocker = makeIssue('B1', 0, 3); // ends day 3
    const lateBlocker = makeIssue('B2', 0, 6); // ends day 6 — this is the real driver
    const startIssue = makeIssue('A', 6, 2, false); // starts exactly when its last blocker ends
    startIssue.linkedBlockedBy = [earlyBlocker, lateBlocker];
    const nodeByWorkItem = nodeMapFrom([]); // no track predecessor involved
    const issueByWorkItem = issueMapFrom([earlyBlocker, lateBlocker, startIssue]);

    const hops = traceDrivingChain(startIssue, nodeByWorkItem, issueByWorkItem);

    expect(hops).toEqual([
      { issueKey: 'A', hopType: 'dependency', workDays: 2, queuedDays: 0 },
      { issueKey: 'B2', hopType: 'root', workDays: 6, queuedDays: 0 },
    ]);
  });

  it('reports queued days when a capacity-delayed issue started later than its blockers required', () => {
    const trackPredecessor = makeIssue('B', 0, 10); // ends day 10
    // A's blockers were all done by day 2, but the track wasn't free until day 10.
    const blocker = makeIssue('C', 0, 2);
    const startIssue = makeIssue('A', 10, 3, true);
    startIssue.linkedBlockedBy = [blocker];
    const nodeByWorkItem = nodeMapFrom([trackPredecessor, startIssue]);
    const issueByWorkItem = issueMapFrom([trackPredecessor, blocker, startIssue]);

    const hops = traceDrivingChain(startIssue, nodeByWorkItem, issueByWorkItem);

    expect(hops[0]).toEqual({ issueKey: 'A', hopType: 'capacity', workDays: 3, queuedDays: 8 });
  });

  it('stops at a root issue with no blockers and no track predecessor', () => {
    const startIssue = makeIssue('A', 0, 4);
    const hops = traceDrivingChain(startIssue, nodeMapFrom([]), issueMapFrom([startIssue]));
    expect(hops).toEqual([{ issueKey: 'A', hopType: 'root', workDays: 4, queuedDays: 0 }]);
  });

  it('does not loop forever if the graph has a cycle', () => {
    const a = makeIssue('A', 5, 1, true);
    const b = makeIssue('B', 0, 5, true);
    // A's track predecessor is B, and (pathologically) B's track predecessor is A.
    const nodeByWorkItem = new Map<TraceWorkItem, { work: TraceWorkItem; previous: { work: TraceWorkItem } | null }>();
    const nodeA = { work: a.mutableWorkItem, previous: null as { work: TraceWorkItem } | null };
    const nodeB = { work: b.mutableWorkItem, previous: null as { work: TraceWorkItem } | null };
    nodeA.previous = nodeB;
    nodeB.previous = nodeA;
    nodeByWorkItem.set(a.mutableWorkItem, nodeA);
    nodeByWorkItem.set(b.mutableWorkItem, nodeB);
    const issueByWorkItem = issueMapFrom([a, b]);

    const hops = traceDrivingChain(a, nodeByWorkItem, issueByWorkItem);

    expect(hops.map((h) => h.issueKey)).toEqual(['A', 'B']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/react/reports/AutoScheduler/scheduler/critical-path-trace.test.ts`
Expected: FAIL — `Cannot find module './critical-path-trace'`

- [ ] **Step 3: Write the implementation**

```ts
// src/react/reports/AutoScheduler/scheduler/critical-path-trace.ts

export interface TraceWorkItem {
  startDay: number;
  daysOfWork: number;
  artificiallyDelayed: boolean;
}

export interface TraceLinkedIssue {
  key: string;
  mutableWorkItem: TraceWorkItem;
  linkedBlockedBy: TraceLinkedIssue[];
}

export interface TraceNode {
  work: TraceWorkItem;
  previous: TraceNode | null;
}

export type HopType = 'capacity' | 'dependency' | 'root';

export interface Hop {
  issueKey: string;
  hopType: HopType;
  workDays: number;
  queuedDays: number;
}

/** The earliest day this issue could have started, given only its blockers (ignores team capacity). */
export function earliestStartFromBlockers(issue: TraceLinkedIssue): number {
  return issue.linkedBlockedBy.reduce((prev, blocker) => {
    return Math.max(prev, blocker.mutableWorkItem.startDay + blocker.mutableWorkItem.daysOfWork);
  }, 0);
}

function argmaxBlockerByEndDay(blockers: TraceLinkedIssue[]): TraceLinkedIssue {
  return blockers.reduce((best, blocker) => {
    const bestEnd = best.mutableWorkItem.startDay + best.mutableWorkItem.daysOfWork;
    const end = blocker.mutableWorkItem.startDay + blocker.mutableWorkItem.daysOfWork;
    return end > bestEnd ? blocker : best;
  });
}

/**
 * Walks backward from `startIssue` (typically the last-finishing item in a single Monte Carlo
 * iteration), classifying each hop as a capacity hop (the item's own team track was busy) or a
 * dependency hop (the item started exactly when its blockers allowed). Stops at a "root" hop: an
 * issue with no blockers and no track predecessor. See spec/024-critical-path/README.md, "The fix:
 * trace the driving chain per iteration".
 */
export function traceDrivingChain(
  startIssue: TraceLinkedIssue,
  nodeByWorkItem: Map<TraceWorkItem, TraceNode>,
  issueByWorkItem: Map<TraceWorkItem, TraceLinkedIssue>,
): Hop[] {
  const hops: Hop[] = [];
  const visited = new Set<string>();
  let current: TraceLinkedIssue | null = startIssue;

  while (current && !visited.has(current.key)) {
    visited.add(current.key);
    const work = current.mutableWorkItem;
    const queuedDays = Math.max(0, work.startDay - earliestStartFromBlockers(current));
    const workDays = work.daysOfWork;

    if (work.artificiallyDelayed) {
      const node = nodeByWorkItem.get(work);
      const previousWork = node?.previous?.work ?? null;
      const next = previousWork ? (issueByWorkItem.get(previousWork) ?? null) : null;
      hops.push({ issueKey: current.key, hopType: next ? 'capacity' : 'root', workDays, queuedDays });
      current = next;
    } else if (current.linkedBlockedBy.length > 0) {
      hops.push({ issueKey: current.key, hopType: 'dependency', workDays, queuedDays });
      current = argmaxBlockerByEndDay(current.linkedBlockedBy);
    } else {
      hops.push({ issueKey: current.key, hopType: 'root', workDays, queuedDays });
      current = null;
    }
  }

  return hops;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/react/reports/AutoScheduler/scheduler/critical-path-trace.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/react/reports/AutoScheduler/scheduler/critical-path-trace.ts src/react/reports/AutoScheduler/scheduler/critical-path-trace.test.ts
git commit -m "feat: add backward driving-chain trace (capacity/dependency hops)"
```

---

### Task 3: Criticality accumulator

**Files:**

- Create: `src/react/reports/AutoScheduler/scheduler/criticality-accumulator.ts`
- Test: `src/react/reports/AutoScheduler/scheduler/criticality-accumulator.test.ts`

**Interfaces:**

- Consumes: `Hop[]` (Task 2).
- Produces: `class CriticalityAccumulator` with `addIteration(hops: Hop[]): void`, `merge(other: CriticalityAccumulator): void`, `criticalityIndex(issueKey: string): number`, `meanWorkDays(issueKey: string): number`, `meanQueuedDays(issueKey: string): number`, `iterations: number` (readonly-in-spirit counter). Used by Task 4 (`monte-carlo.ts`) and Task 5 (`stats-analyzer.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
// src/react/reports/AutoScheduler/scheduler/criticality-accumulator.test.ts
import { describe, it, expect } from 'vitest';
import { CriticalityAccumulator } from './criticality-accumulator';
import type { Hop } from './critical-path-trace';

function hop(issueKey: string, workDays: number, queuedDays: number): Hop {
  return { issueKey, hopType: 'dependency', workDays, queuedDays };
}

describe('CriticalityAccumulator', () => {
  it('starts every issue at 0 criticality before any iteration is added', () => {
    const acc = new CriticalityAccumulator();
    expect(acc.criticalityIndex('A')).toBe(0);
    expect(acc.meanWorkDays('A')).toBe(0);
    expect(acc.meanQueuedDays('A')).toBe(0);
  });

  it('computes criticality index as the fraction of iterations an issue was on the chain', () => {
    const acc = new CriticalityAccumulator();
    acc.addIteration([hop('A', 5, 0), hop('B', 3, 0)]);
    acc.addIteration([hop('B', 4, 1)]);
    acc.addIteration([hop('B', 2, 0)]);
    acc.addIteration([]); // an iteration where neither was on the traced chain

    expect(acc.criticalityIndex('A')).toBeCloseTo(1 / 4);
    expect(acc.criticalityIndex('B')).toBeCloseTo(3 / 4);
    expect(acc.criticalityIndex('C')).toBe(0);
  });

  it('computes mean work/queued days only across iterations the issue was on the chain', () => {
    const acc = new CriticalityAccumulator();
    acc.addIteration([hop('B', 4, 0)]);
    acc.addIteration([hop('B', 2, 2)]);

    expect(acc.meanWorkDays('B')).toBeCloseTo(3); // (4 + 2) / 2
    expect(acc.meanQueuedDays('B')).toBeCloseTo(1); // (0 + 2) / 2
  });

  it('merges two accumulators additively', () => {
    const a = new CriticalityAccumulator();
    a.addIteration([hop('A', 5, 0)]);
    const b = new CriticalityAccumulator();
    b.addIteration([hop('A', 3, 1)]);
    b.addIteration([]);

    a.merge(b);

    expect(a.iterations).toBe(3);
    expect(a.criticalityIndex('A')).toBeCloseTo(2 / 3);
    expect(a.meanWorkDays('A')).toBeCloseTo(4); // (5 + 3) / 2
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/react/reports/AutoScheduler/scheduler/criticality-accumulator.test.ts`
Expected: FAIL — `Cannot find module './criticality-accumulator'`

- [ ] **Step 3: Write the implementation**

```ts
// src/react/reports/AutoScheduler/scheduler/criticality-accumulator.ts
import type { Hop } from './critical-path-trace';

/**
 * Turns a stream of per-iteration `traceDrivingChain` results into, per issue: the fraction of
 * iterations it appeared on the traced driving chain (its criticality index), and its mean work/queued
 * days across only the iterations it was on the chain. See spec/024-critical-path/README.md, "Three
 * definitions the implementation must not drift from".
 */
export class CriticalityAccumulator {
  iterations = 0;
  private onChainCount = new Map<string, number>();
  private workDaysSum = new Map<string, number>();
  private queuedDaysSum = new Map<string, number>();

  addIteration(hops: Hop[]): void {
    this.iterations++;
    for (const hop of hops) {
      this.onChainCount.set(hop.issueKey, (this.onChainCount.get(hop.issueKey) ?? 0) + 1);
      this.workDaysSum.set(hop.issueKey, (this.workDaysSum.get(hop.issueKey) ?? 0) + hop.workDays);
      this.queuedDaysSum.set(hop.issueKey, (this.queuedDaysSum.get(hop.issueKey) ?? 0) + hop.queuedDays);
    }
  }

  merge(other: CriticalityAccumulator): void {
    this.iterations += other.iterations;
    for (const [key, count] of other.onChainCount) {
      this.onChainCount.set(key, (this.onChainCount.get(key) ?? 0) + count);
    }
    for (const [key, sum] of other.workDaysSum) {
      this.workDaysSum.set(key, (this.workDaysSum.get(key) ?? 0) + sum);
    }
    for (const [key, sum] of other.queuedDaysSum) {
      this.queuedDaysSum.set(key, (this.queuedDaysSum.get(key) ?? 0) + sum);
    }
  }

  criticalityIndex(issueKey: string): number {
    if (this.iterations === 0) return 0;
    return (this.onChainCount.get(issueKey) ?? 0) / this.iterations;
  }

  meanWorkDays(issueKey: string): number {
    const onChain = this.onChainCount.get(issueKey) ?? 0;
    if (onChain === 0) return 0;
    return (this.workDaysSum.get(issueKey) ?? 0) / onChain;
  }

  meanQueuedDays(issueKey: string): number {
    const onChain = this.onChainCount.get(issueKey) ?? 0;
    if (onChain === 0) return 0;
    return (this.queuedDaysSum.get(issueKey) ?? 0) / onChain;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/react/reports/AutoScheduler/scheduler/criticality-accumulator.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/react/reports/AutoScheduler/scheduler/criticality-accumulator.ts src/react/reports/AutoScheduler/scheduler/criticality-accumulator.test.ts
git commit -m "feat: add CriticalityAccumulator for per-issue criticality index and work/queued days"
```

---

### Task 4: Wire the trace into `runBatch`

**Files:**

- Modify: `src/react/reports/AutoScheduler/scheduler/monte-carlo.ts`
- Modify: `src/react/reports/AutoScheduler/scheduler/monte-carlo.test.ts`

**Interfaces:**

- Consumes: `traceDrivingChain`, `TraceLinkedIssue`, `TraceNode`, `TraceWorkItem` (Task 2);
  `CriticalityAccumulator` (Task 3); `ScheduledWorkNode` (Task 1, via `WorkPlans.workNodes()`'s return
  type, already used internally by `schedule.ts`).
- Produces: `BatchDatas` gains `criticalityAccumulator: CriticalityAccumulator`, one per `runBatch` call
  (i.e., per batch of `batchSize` iterations) — consumed by Task 5 (`stats-analyzer.ts`).

- [ ] **Step 1: Write the failing test**

Add to the bottom of `monte-carlo.test.ts` (new `describe` block; keep existing tests as-is):

```ts
// Add near the top of monte-carlo.test.ts, alongside the existing imports:
import type { DerivedIssue } from '../../../../jira/derived/derive';
import { runMonteCarlo } from './monte-carlo';

// New import for this task:
// (place with the other imports at the top of the file)
// import { linkIssues } from './link-issues';

function makeTeam(name: string) {
  return { name, parallelWorkLimit: 1, velocity: 1 } as DerivedIssue['team'];
}

function makeDerivedIssue(overrides: Partial<DerivedIssue> & { key: string }): DerivedIssue {
  return {
    parentKey: null,
    team: makeTeam('team-a'),
    derivedTiming: { deterministicTotalDaysOfWork: 5, probablisticTotalDaysOfWork: 5 },
    issue: { fields: { 'Linked Issues': [] } },
    type: 'Epic',
    ...overrides,
  } as unknown as DerivedIssue;
}

describe('runBatch criticality accumulation (via runMonteCarlo)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accumulates a criticality index for every issue across a batch', () => {
    // Two issues, same team (parallelWorkLimit: 1, so one track): B blocks A. Every iteration, A is
    // the last-finishing item and the trace should walk backward through the dependency hop to B.
    const blocker: DerivedIssue = makeDerivedIssue({ key: 'B' });
    const blocked: DerivedIssue = makeDerivedIssue({
      key: 'A',
      issue: { fields: { 'Linked Issues': [{ type: { name: 'Blocks' }, outwardIssue: { key: 'B' } }] } },
    } as any);

    const onBatch = vi.fn();
    const { runBatchAndLoop } = runMonteCarlo([blocked, blocker], {
      onBatch,
      onComplete: vi.fn(),
      batches: 1,
      batchSize: 10,
      timeBetweenBatches: 1,
      probabilisticallySelectIssueTiming: false,
    });

    runBatchAndLoop();
    vi.advanceTimersByTime(10);

    expect(onBatch).toHaveBeenCalledTimes(1);
    const { batchData } = onBatch.mock.calls[0][0];
    expect(batchData.criticalityAccumulator.iterations).toBe(10);
    expect(batchData.criticalityAccumulator.criticalityIndex('A')).toBe(1);
    expect(batchData.criticalityAccumulator.criticalityIndex('B')).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/react/reports/AutoScheduler/scheduler/monte-carlo.test.ts`
Expected: FAIL — `batchData.criticalityAccumulator` is `undefined`

- [ ] **Step 3: Implement**

Modify `monte-carlo.ts`:

```ts
import type { DerivedIssue } from '../../../../jira/derived/derive';
import type { LinkedIssue } from './link-issues';

import { resetLinkedIssue, linkIssues } from './link-issues';
import { scheduleIssues } from './schedule';
import { traceDrivingChain, type TraceLinkedIssue, type TraceWorkItem, type TraceNode } from './critical-path-trace';
import { CriticalityAccumulator } from './criticality-accumulator';
```

(keep the rest of `runMonteCarlo` unchanged), then replace `runBatch` with:

```ts
export type BatchDatas = {
  batchIssueData: BatchIssueData[];
  lastDays: number[];
  criticalityAccumulator: CriticalityAccumulator;
};

function buildNodeByWorkItem(teamWork: ReturnType<typeof scheduleIssues>): Map<TraceWorkItem, TraceNode> {
  const nodeByWorkItem = new Map<TraceWorkItem, TraceNode>();
  Object.values(teamWork).forEach((team) => {
    team.workPlans.workNodes().forEach((node) => {
      nodeByWorkItem.set(node.work as TraceWorkItem, node as unknown as TraceNode);
    });
  });
  return nodeByWorkItem;
}

function runBatch(linkedIssues: LinkedIssue[], { batchSize }: { batchSize: number }): BatchDatas {
  const items: BatchIssueData[] = linkedIssues.map((linkedIssue) => ({
    linkedIssue,
    startDays: [],
    dueDays: [],
    daysOfWork: [],
    trackNumbers: [],
  }));

  // Stable across every iteration of this batch — object identity of `mutableWorkItem` never changes,
  // only its properties are reset. Used by the trace to walk from a ScheduledWorkNode's `.work` back to
  // the LinkedIssue that owns it.
  const issueByWorkItem = new Map<TraceWorkItem, TraceLinkedIssue>();
  linkedIssues.forEach((issue) =>
    issueByWorkItem.set(issue.mutableWorkItem as TraceWorkItem, issue as unknown as TraceLinkedIssue),
  );

  const lastDays: number[] = [];
  const criticalityAccumulator = new CriticalityAccumulator();

  for (let i = 0; i < batchSize; i++) {
    // Reset state
    for (const linkedIssue of linkedIssues) {
      resetLinkedIssue(linkedIssue);
    }

    const teamWork = scheduleIssues(linkedIssues);

    Object.values(teamWork).forEach((team) => {
      team.workPlans.plans.forEach((plan, index) => {
        for (const workItem of plan) {
          workItem.work.track = index;
        }
      });
    });

    let lastDay = 0;
    let lastIssue: LinkedIssue | null = null;

    for (let li = 0; li < linkedIssues.length; li++) {
      const linkedIssue = linkedIssues[li];
      const workItem = linkedIssue.mutableWorkItem;
      const startDay = workItem.startDay as number;
      const daysOfWork = workItem.daysOfWork;
      const dueDay = startDay + daysOfWork;

      items[li].startDays.push(startDay);
      items[li].daysOfWork.push(daysOfWork);
      items[li].dueDays.push(dueDay);
      items[li].trackNumbers.push(workItem.track as number);

      if (dueDay > lastDay) {
        lastDay = dueDay;
        lastIssue = linkedIssue;
      }
    }

    lastDays[i] = lastDay;

    if (lastIssue) {
      const nodeByWorkItem = buildNodeByWorkItem(teamWork);
      const hops = traceDrivingChain(lastIssue as unknown as TraceLinkedIssue, nodeByWorkItem, issueByWorkItem);
      criticalityAccumulator.addIteration(hops);
    }
  }

  return { batchIssueData: items, lastDays, criticalityAccumulator };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/react/reports/AutoScheduler/scheduler/monte-carlo.test.ts`
Expected: PASS (all tests, including the new one)

- [ ] **Step 5: Commit**

```bash
git add src/react/reports/AutoScheduler/scheduler/monte-carlo.ts src/react/reports/AutoScheduler/scheduler/monte-carlo.test.ts
git commit -m "feat: trace the driving chain per Monte Carlo iteration and accumulate criticality"
```

---

### Task 5: Expose criticality data on `StatsUIData`

**Files:**

- Modify: `src/react/reports/AutoScheduler/scheduler/stats-analyzer.ts`
- Create: `src/react/reports/AutoScheduler/scheduler/stats-analyzer.test.ts`

**Interfaces:**

- Consumes: `CriticalityAccumulator` (Task 3), `BatchDatas.criticalityAccumulator` (Task 4).
- Produces: every entry of `StatsUIData['simulationIssueResults']` (i.e. `SimulationIssueResult`) gains
  `criticalityIndex: number`, `meanWorkDays: number`, `meanQueuedDays: number` — consumed by Task 6
  (`build-critical-paths.ts`).

- [ ] **Step 1: Write the failing test**

```ts
// src/react/reports/AutoScheduler/scheduler/stats-analyzer.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DerivedIssue } from '../../../../jira/derived/derive';
import { StatsAnalyzer } from './stats-analyzer';

function makeTeam(name: string) {
  return { name, parallelWorkLimit: 1, velocity: 1 } as DerivedIssue['team'];
}

function makeDerivedIssue(overrides: Partial<DerivedIssue> & { key: string }): DerivedIssue {
  return {
    parentKey: null,
    team: makeTeam('team-a'),
    derivedTiming: { deterministicTotalDaysOfWork: 5, probablisticTotalDaysOfWork: 5 },
    issue: { fields: { 'Linked Issues': [] } },
    type: 'Epic',
    ...overrides,
  } as unknown as DerivedIssue;
}

describe('StatsAnalyzer criticality fields', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('adds criticalityIndex, meanWorkDays, meanQueuedDays to every simulation issue result', () => {
    const blocker = makeDerivedIssue({ key: 'B' });
    const blocked = makeDerivedIssue({
      key: 'A',
      issue: { fields: { 'Linked Issues': [{ type: { name: 'Blocks' }, outwardIssue: { key: 'B' } }] } },
    } as any);

    let latestUIData: any = null;
    const analyzer = new StatsAnalyzer({
      issues: [blocked, blocker],
      uncertaintyWeight: 'average',
      setUIState: (data) => {
        latestUIData = data;
      },
    });

    vi.advanceTimersByTime(2000); // enough for the default batch count to finish
    analyzer.teardown();

    expect(latestUIData).not.toBeNull();
    const results = latestUIData.simulationIssueResults;
    const byKey = Object.fromEntries(results.map((r: any) => [r.linkedIssue.key, r]));

    expect(byKey['A'].criticalityIndex).toBeGreaterThan(0);
    expect(byKey['B'].criticalityIndex).toBeGreaterThan(0);
    expect(typeof byKey['A'].meanWorkDays).toBe('number');
    expect(typeof byKey['A'].meanQueuedDays).toBe('number');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/react/reports/AutoScheduler/scheduler/stats-analyzer.test.ts`
Expected: FAIL — `criticalityIndex` is `undefined`

- [ ] **Step 3: Implement**

In `stats-analyzer.ts`, add the import and a running accumulator field, merge it in `onBatch`, and attach
the per-issue fields in `dataForUI()`:

```ts
import { CriticalityAccumulator } from './criticality-accumulator';
```

```ts
export class StatsAnalyzer {
  simulationIssues: SimulationData[];
  lastDays: number[];
  percentComplete: number;
  uncertaintyWeight: number | 'average';
  setUIState: (data: StatsUIData) => void;
  _teardown: () => void;
  criticalityAccumulator = new CriticalityAccumulator();
  // ...unchanged constructor body...

  onBatch({ batchData, percentComplete }: { batchData: BatchDatas; percentComplete: number }) {
    this.percentComplete = percentComplete;

    for (let i = 0; i < this.simulationIssues.length; i++) {
      const simulationIssue = this.simulationIssues[i];
      const batchForIssue = batchData.batchIssueData[i];
      insertSortedArrayInPlace(simulationIssue.daysOfWork, batchForIssue.daysOfWork);
      insertSortedArrayInPlace(simulationIssue.dueDays, batchForIssue.dueDays);
      insertSortedArrayInPlace(simulationIssue.startDays, batchForIssue.startDays);
      insertSortedArrayInPlace(simulationIssue.trackNumbers, batchForIssue.trackNumbers);
    }
    insertSortedArrayInPlace(this.lastDays, batchData.lastDays);
    this.criticalityAccumulator.merge(batchData.criticalityAccumulator);

    this.setUIState(this.dataForUI());
  }
```

Then in `dataForUI()`, change the `simulationIssueResults` mapping to attach the three fields:

```ts
const simulationIssueResults = this.simulationIssues.map((simulationIssue) => {
  const result = getUncertaintyThresholdData(simulationIssue, this.uncertaintyWeight);
  const key = simulationIssue.linkedIssue.key;
  return {
    ...result,
    criticalityIndex: this.criticalityAccumulator.criticalityIndex(key),
    meanWorkDays: this.criticalityAccumulator.meanWorkDays(key),
    meanQueuedDays: this.criticalityAccumulator.meanQueuedDays(key),
  };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/react/reports/AutoScheduler/scheduler/stats-analyzer.test.ts`
Expected: PASS

Also re-run the full scheduler test folder to make sure nothing else broke:

Run: `npx vitest run src/react/reports/AutoScheduler/scheduler`
Expected: PASS (all files)

- [ ] **Step 5: Commit**

```bash
git add src/react/reports/AutoScheduler/scheduler/stats-analyzer.ts src/react/reports/AutoScheduler/scheduler/stats-analyzer.test.ts
git commit -m "feat: expose criticalityIndex/meanWorkDays/meanQueuedDays on SimulationIssueResult"
```

---

### Task 6: Build ranked rows for the new report

**Files:**

- Create: `src/react/reports/AutoScheduler/CriticalPathsReport/build-critical-paths.ts`
- Create: `src/react/reports/AutoScheduler/CriticalPathsReport/build-critical-paths.test.ts`

**Interfaces:**

- Consumes: `SimulationIssueResult`, `StatsUIData` (Task 5, now carrying `criticalityIndex` /
  `meanWorkDays` / `meanQueuedDays`).
- Produces:

```ts
export type CriticalPathRow = {
  rootKey: string;
  criticalityIndex: number;
  chain: SimulationIssueResult[]; // ordered root -> ... -> last epic
  totalWorkDays: number;
  totalQueuedDays: number;
  totalDays: number; // totalWorkDays + totalQueuedDays
  biggestByWork: SimulationIssueResult;
  biggestByQueuedDelay: SimulationIssueResult;
  fanOut: SimulationIssueResult[];
  fanOutTotalDays: number;
};
export function buildCriticalPaths(uiData: StatsUIData): CriticalPathRow[];
```

Consumed by Task 7 (`CriticalPathsReport.tsx`).

- [ ] **Step 1: Write the failing test**

```ts
// src/react/reports/AutoScheduler/CriticalPathsReport/build-critical-paths.test.ts
import { describe, it, expect } from 'vitest';
import { buildCriticalPaths } from './build-critical-paths';
import type { SimulationIssueResult, StatsUIData } from '../scheduler/stats-analyzer';

function issue(overrides: Partial<SimulationIssueResult> & { key: string }): SimulationIssueResult {
  return {
    linkedIssue: { key: overrides.key, summary: overrides.key, url: `#${overrides.key}`, linkedBlocks: [] },
    adjustedDaysOfWork: 5,
    criticalityIndex: 0,
    meanWorkDays: 0,
    meanQueuedDays: 0,
    ...overrides,
  } as unknown as SimulationIssueResult;
}

describe('buildCriticalPaths', () => {
  it('builds one row per root epic, ranked by criticality index, with a fan-out of everything else it blocks', () => {
    // C -> blocks -> B -> blocks -> A (chain), and C also blocks D (the fan-out).
    const d = issue({ key: 'D', linkedIssue: { key: 'D', summary: 'D', url: '#D', linkedBlocks: [] } as any });
    const a = issue({
      key: 'A',
      criticalityIndex: 0.9,
      meanWorkDays: 10,
      meanQueuedDays: 1,
      linkedIssue: { key: 'A', summary: 'A', url: '#A', linkedBlocks: [] } as any,
    });
    const b = issue({
      key: 'B',
      criticalityIndex: 0.9,
      meanWorkDays: 6,
      meanQueuedDays: 0,
      linkedIssue: { key: 'B', summary: 'B', url: '#B', linkedBlocks: [{ key: 'A' }] } as any,
    });
    const c = issue({
      key: 'C',
      criticalityIndex: 0.9,
      meanWorkDays: 4,
      meanQueuedDays: 2,
      linkedIssue: { key: 'C', summary: 'C', url: '#C', linkedBlocks: [{ key: 'B' }, { key: 'D' }] } as any,
    });

    const uiData = { simulationIssueResults: [d, a, b, c] } as unknown as StatsUIData;

    const rows = buildCriticalPaths(uiData);

    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.rootKey).toBe('C');
    expect(row.chain.map((wi) => wi.linkedIssue.key)).toEqual(['C', 'B', 'A']);
    expect(row.fanOut.map((wi) => wi.linkedIssue.key)).toEqual(['D']);
    expect(row.totalWorkDays).toBe(20); // 10 + 6 + 4
    expect(row.totalQueuedDays).toBe(3); // 1 + 0 + 2
    expect(row.totalDays).toBe(23);
    expect(row.biggestByWork.linkedIssue.key).toBe('A'); // 10 work days is the largest
    expect(row.biggestByQueuedDelay.linkedIssue.key).toBe('C'); // 2 queued days is the largest
  });

  it('ranks rows by criticality index, descending', () => {
    const low = issue({
      key: 'LOW',
      criticalityIndex: 0.1,
      linkedIssue: { key: 'LOW', summary: 'LOW', url: '#LOW', linkedBlocks: [] } as any,
    });
    const high = issue({
      key: 'HIGH',
      criticalityIndex: 0.8,
      linkedIssue: { key: 'HIGH', summary: 'HIGH', url: '#HIGH', linkedBlocks: [] } as any,
    });
    const uiData = { simulationIssueResults: [low, high] } as unknown as StatsUIData;

    const rows = buildCriticalPaths(uiData);

    expect(rows.map((r) => r.rootKey)).toEqual(['HIGH', 'LOW']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/react/reports/AutoScheduler/CriticalPathsReport/build-critical-paths.test.ts`
Expected: FAIL — `Cannot find module './build-critical-paths'`

- [ ] **Step 3: Implement**

This mirrors `CriticalPath.tsx`'s existing recursive construction (`sortWorkItemsByBlocksWorkDepth`,
`recursivelyAddToCriticalPath`, `recursivelyAddToOtherBlockedWork`), with `criticalityIndex` as the sort
key instead of `blocksWorkDepth`, and the new work/queued/biggest-by fields attached. See Design Decision
2 at the top of this plan.

```ts
// src/react/reports/AutoScheduler/CriticalPathsReport/build-critical-paths.ts
import type { SimulationIssueResult, StatsUIData } from '../scheduler/stats-analyzer';

export type CriticalPathRow = {
  rootKey: string;
  criticalityIndex: number;
  chain: SimulationIssueResult[];
  totalWorkDays: number;
  totalQueuedDays: number;
  totalDays: number;
  biggestByWork: SimulationIssueResult;
  biggestByQueuedDelay: SimulationIssueResult;
  fanOut: SimulationIssueResult[];
  fanOutTotalDays: number;
};

function byCriticalityIndex(a: SimulationIssueResult, b: SimulationIssueResult): number {
  return b.criticalityIndex - a.criticalityIndex;
}

function biggestBy(
  items: SimulationIssueResult[],
  value: (item: SimulationIssueResult) => number,
): SimulationIssueResult {
  return items.reduce((best, item) => (value(item) > value(best) ? item : best));
}

function addFanOut(
  fanOut: Map<string, SimulationIssueResult>,
  candidates: SimulationIssueResult[],
  excludedKeys: Set<string>,
  keyToWorkItem: Record<string, SimulationIssueResult>,
) {
  candidates.forEach((workItem) => {
    const key = workItem.linkedIssue.key;
    if (excludedKeys.has(key)) return;
    excludedKeys.add(key);
    if (!fanOut.has(key)) {
      fanOut.set(key, workItem);
      const nextBlocks = (workItem.linkedIssue.linkedBlocks || [])
        .map((link: { key: string }) => keyToWorkItem[link.key])
        .filter(Boolean)
        .sort(byCriticalityIndex);
      addFanOut(fanOut, nextBlocks, excludedKeys, keyToWorkItem);
    }
  });
}

function buildChain(
  root: SimulationIssueResult,
  excludedKeys: Set<string>,
  keyToWorkItem: Record<string, SimulationIssueResult>,
): { chain: SimulationIssueResult[]; fanOut: SimulationIssueResult[] } {
  const chain: SimulationIssueResult[] = [root];
  const fanOut = new Map<string, SimulationIssueResult>();
  let current = root;

  while (true) {
    const candidates = (current.linkedIssue.linkedBlocks || [])
      .map((link: { key: string }) => keyToWorkItem[link.key])
      .filter(Boolean)
      .sort(byCriticalityIndex);
    if (!candidates.length) break;

    const [next, ...rest] = candidates;
    chain.push(next);
    excludedKeys.add(next.linkedIssue.key);
    addFanOut(fanOut, rest, excludedKeys, keyToWorkItem);
    current = next;
  }

  return { chain, fanOut: Array.from(fanOut.values()) };
}

export function buildCriticalPaths(uiData: StatsUIData): CriticalPathRow[] {
  const keyToWorkItem: Record<string, SimulationIssueResult> = {};
  uiData.simulationIssueResults.forEach((item) => {
    keyToWorkItem[item.linkedIssue.key] = item;
  });

  const sortedRoots = [...uiData.simulationIssueResults].sort(byCriticalityIndex);
  const excludedKeys = new Set<string>();
  const rows: CriticalPathRow[] = [];

  for (const candidate of sortedRoots) {
    const key = candidate.linkedIssue.key;
    if (excludedKeys.has(key)) continue;
    excludedKeys.add(key);

    const { chain, fanOut } = buildChain(candidate, excludedKeys, keyToWorkItem);

    const totalWorkDays = chain.reduce((sum, wi) => sum + wi.meanWorkDays, 0);
    const totalQueuedDays = chain.reduce((sum, wi) => sum + wi.meanQueuedDays, 0);
    const fanOutTotalDays = fanOut.reduce((sum, wi) => sum + wi.adjustedDaysOfWork, 0);

    rows.push({
      rootKey: key,
      criticalityIndex: candidate.criticalityIndex,
      chain,
      totalWorkDays,
      totalQueuedDays,
      totalDays: totalWorkDays + totalQueuedDays,
      biggestByWork: biggestBy(chain, (wi) => wi.meanWorkDays),
      biggestByQueuedDelay: biggestBy(chain, (wi) => wi.meanQueuedDays),
      fanOut,
      fanOutTotalDays,
    });
  }

  return rows.sort(byCriticalityIndex);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/react/reports/AutoScheduler/CriticalPathsReport/build-critical-paths.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/react/reports/AutoScheduler/CriticalPathsReport/build-critical-paths.ts src/react/reports/AutoScheduler/CriticalPathsReport/build-critical-paths.test.ts
git commit -m "feat: build ranked critical-path rows from criticality index"
```

---

### Task 7: `CriticalPathsReport` UI component

**Files:**

- Create: `src/react/reports/AutoScheduler/CriticalPathsReport/CriticalPathsReport.tsx`
- Create: `src/react/reports/AutoScheduler/CriticalPathsReport/CriticalPathsReport.test.tsx`
- Create: `src/react/reports/AutoScheduler/CriticalPathsReport/index.ts`

**Interfaces:**

- Consumes: `buildCriticalPaths`, `CriticalPathRow` (Task 6); `StatsUIData` (Task 5).
- Produces: `CriticalPathsReport(props: { uiData: StatsUIData; workItemsToHighlight: Set<string> | null; setWorkItemsToHighlight: React.Dispatch<React.SetStateAction<Set<string> | null>> })` — mounted by Task 8.

- [ ] **Step 1: Write the failing test**

```tsx
// src/react/reports/AutoScheduler/CriticalPathsReport/CriticalPathsReport.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CriticalPathsReport } from './CriticalPathsReport';
import type { StatsUIData, SimulationIssueResult } from '../scheduler/stats-analyzer';

function issue(overrides: Partial<SimulationIssueResult> & { key: string; blocks?: string[] }): SimulationIssueResult {
  const { blocks = [], ...rest } = overrides;
  return {
    linkedIssue: {
      key: rest.key,
      summary: rest.key,
      url: `#${rest.key}`,
      linkedBlocks: blocks.map((key) => ({ key })),
    },
    adjustedDaysOfWork: 5,
    criticalityIndex: 0,
    meanWorkDays: 0,
    meanQueuedDays: 0,
    ...rest,
  } as unknown as SimulationIssueResult;
}

describe('CriticalPathsReport', () => {
  it('renders one row per root epic with rank, percent, chain summary, and days', () => {
    const b = issue({ key: 'B', criticalityIndex: 0.78, meanWorkDays: 20, meanQueuedDays: 5 });
    const a = issue({ key: 'A', criticalityIndex: 0.78, meanWorkDays: 10, meanQueuedDays: 2, blocks: ['B'] });
    const uiData = { simulationIssueResults: [b, a] } as unknown as StatsUIData;

    render(<CriticalPathsReport uiData={uiData} workItemsToHighlight={null} setWorkItemsToHighlight={vi.fn()} />);

    expect(screen.getByText('78%')).toBeInTheDocument();
    expect(screen.getByText('37 d')).toBeInTheDocument(); // 10+20 work + 2+5 queued
  });

  it('highlights the row-s chain and fan-out when expanded, and clears highlighting when collapsed', () => {
    const b = issue({ key: 'B', criticalityIndex: 0.78, meanWorkDays: 20, meanQueuedDays: 5 });
    const a = issue({ key: 'A', criticalityIndex: 0.78, meanWorkDays: 10, meanQueuedDays: 2, blocks: ['B'] });
    const uiData = { simulationIssueResults: [b, a] } as unknown as StatsUIData;
    const setWorkItemsToHighlight = vi.fn();

    render(
      <CriticalPathsReport
        uiData={uiData}
        workItemsToHighlight={null}
        setWorkItemsToHighlight={setWorkItemsToHighlight}
      />,
    );

    const summary = screen.getByText('78%').closest('summary')!;
    fireEvent.click(summary); // expand

    expect(setWorkItemsToHighlight).toHaveBeenCalledWith(new Set(['A', 'B']));

    fireEvent.click(summary); // collapse
    expect(setWorkItemsToHighlight).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/react/reports/AutoScheduler/CriticalPathsReport/CriticalPathsReport.test.tsx`
Expected: FAIL — `Cannot find module './CriticalPathsReport'`

- [ ] **Step 3: Implement**

```tsx
// src/react/reports/AutoScheduler/CriticalPathsReport/CriticalPathsReport.tsx
import React from 'react';
import type { StatsUIData } from '../scheduler/stats-analyzer';
import { buildCriticalPaths, type CriticalPathRow } from './build-critical-paths';

interface CriticalPathsReportProps {
  uiData: StatsUIData;
  workItemsToHighlight: Set<string> | null;
  setWorkItemsToHighlight: React.Dispatch<React.SetStateAction<Set<string> | null>>;
}

const SERIES_WORK = '#0c66e4';
const SERIES_QUEUED = '#b65c02';

function chainKeys(row: CriticalPathRow): Set<string> {
  return new Set([...row.chain.map((wi) => wi.linkedIssue.key), ...row.fanOut.map((wi) => wi.linkedIssue.key)]);
}

function chainSummaryText(row: CriticalPathRow): string {
  const first = row.chain[0].linkedIssue.summary;
  if (row.chain.length === 1) return first;
  const last = row.chain[row.chain.length - 1].linkedIssue.summary;
  return `${first} → … → ${last}`;
}

export const CriticalPathsReport: React.FC<CriticalPathsReportProps> = ({
  uiData,
  workItemsToHighlight,
  setWorkItemsToHighlight,
}) => {
  const rows = React.useMemo(() => buildCriticalPaths(uiData), [uiData]);
  const maxTotalDays = Math.max(1, ...rows.map((row) => row.totalDays));

  function isExpanded(row: CriticalPathRow): boolean {
    return !!workItemsToHighlight && workItemsToHighlight.has(row.rootKey);
  }

  function onToggle(row: CriticalPathRow, event: React.SyntheticEvent<HTMLDetailsElement>) {
    const open = (event.target as HTMLDetailsElement).open;
    setWorkItemsToHighlight(open ? chainKeys(row) : null);
  }

  return (
    <div className="bg-white border border-neutral-30 rounded shadow-sm mt-4">
      <div className="px-4 py-3 border-b border-neutral-30">
        <p className="font-bold text-base">Critical Paths (new)</p>
        <p className="text-xs text-neutral-500">
          The chains that decide when this plan finishes. Ranked by how often each one drove the finish date across the
          simulation.
        </p>
      </div>

      <div
        className="px-4 pt-1 pb-2 border-b border-neutral-30 text-[11px] font-semibold text-neutral-500 uppercase"
        style={{ display: 'grid', gridTemplateColumns: '14px 14px 36px minmax(0, 1fr) 130px 48px', columnGap: 10 }}
      >
        <span style={{ gridColumn: '1 / span 3' }}>Criticality index</span>
        <span>Critical path</span>
        <span className="flex gap-2 text-[10px] font-medium normal-case text-neutral-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: SERIES_WORK }} /> Work
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: SERIES_QUEUED }} /> Queued
          </span>
        </span>
        <span className="text-right">Total days</span>
      </div>

      {rows.map((row, idx) => (
        <details
          key={row.rootKey}
          open={isExpanded(row)}
          onToggle={(e) => onToggle(row, e)}
          className="border-b border-neutral-30 last:border-b-0"
        >
          <summary
            className="cursor-pointer px-4 py-2 hover:bg-neutral-20"
            style={{
              display: 'grid',
              gridTemplateColumns: '14px 14px 36px minmax(0, 1fr) 130px 48px',
              columnGap: 10,
              alignItems: 'center',
            }}
          >
            <span className="text-right text-xs text-neutral-500">{idx + 1}</span>
            <span className="text-right text-sm font-semibold">{Math.round(row.criticalityIndex * 100)}%</span>
            <span className="truncate text-sm text-blue-600">{chainSummaryText(row)}</span>
            <span className="flex h-2" style={{ width: `${Math.round((row.totalDays / maxTotalDays) * 100)}%` }}>
              <span style={{ flex: row.totalWorkDays || 0.0001, background: SERIES_WORK }} />
              {row.totalQueuedDays > 0 && (
                <span style={{ flex: row.totalQueuedDays, background: SERIES_QUEUED, marginLeft: 2 }} />
              )}
            </span>
            <span className="text-right text-sm text-neutral-500">{Math.round(row.totalDays)} d</span>
          </summary>

          <div className="px-4 pb-4 pl-10 grid gap-3">
            <div>
              <div className="text-xs text-neutral-500">Full chain</div>
              <div className="text-sm">
                {row.chain.map((wi, i) => (
                  <React.Fragment key={wi.linkedIssue.key}>
                    {i > 0 && <span className="mx-1 text-neutral-400">→</span>}
                    <a className="text-blue-600" href={wi.linkedIssue.url} target="_blank" rel="noopener noreferrer">
                      {wi.linkedIssue.summary}
                    </a>
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Biggest epic by days of work</div>
              <div className="text-sm">
                {row.biggestByWork.linkedIssue.summary} — {Math.round(row.biggestByWork.meanWorkDays)} days
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Biggest epic by queued delay</div>
              <div className="text-sm">
                {row.biggestByQueuedDelay.linkedIssue.summary} — {Math.round(row.biggestByQueuedDelay.meanQueuedDays)}{' '}
                days queued behind other plan work
              </div>
            </div>
            {row.fanOut.length > 0 && (
              <div>
                <div className="text-xs text-neutral-500">
                  Other epics blocked by this chain · {Math.round(row.fanOutTotalDays)} days total
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {row.fanOut.map((wi) => (
                    <a
                      key={wi.linkedIssue.key}
                      className="text-xs bg-neutral-10 border border-neutral-30 rounded px-1.5 py-0.5 text-blue-600"
                      href={wi.linkedIssue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {wi.linkedIssue.summary}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  );
};
```

```ts
// src/react/reports/AutoScheduler/CriticalPathsReport/index.ts
export { CriticalPathsReport } from './CriticalPathsReport';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/react/reports/AutoScheduler/CriticalPathsReport/CriticalPathsReport.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/react/reports/AutoScheduler/CriticalPathsReport
git commit -m "feat: add CriticalPathsReport UI component"
```

---

### Task 8: Mount the new report in `AutoScheduler.tsx`

**Files:**

- Modify: `src/react/reports/AutoScheduler/AutoScheduler.tsx:24,329-333`

**Interfaces:**

- Consumes: `CriticalPathsReport` (Task 7), existing `uiData`, `workItemsToHighlight`,
  `setWorkItemsToHighlight` state already in `AutoScheduler.tsx`.

- [ ] **Step 1: Add the import**

```ts
import { CriticalPath } from './CriticalPath';
import { CriticalPathsReport } from './CriticalPathsReport';
```

- [ ] **Step 2: Render it below `<CriticalPath>`**

```tsx
      {/* Critical Path Report */}
      <CriticalPath
        uiData={uiData}
        workItemsToHighlight={workItemsToHighlight}
        setWorkItemsToHighlight={setWorkItemsToHighlight}
      />
      {/* Critical Paths Report (POC of spec/024-critical-path) */}
      <CriticalPathsReport
        uiData={uiData}
        workItemsToHighlight={workItemsToHighlight}
        setWorkItemsToHighlight={setWorkItemsToHighlight}
      />
    </div>
  );
};
```

- [ ] **Step 3: Typecheck and run the full scheduler + report test suite**

Run: `npm run typecheck`
Expected: no new errors

Run: `npx vitest run src/react/reports/AutoScheduler`
Expected: PASS (all files)

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, open the Auto-Scheduler report on a real plan, scroll to the bottom, confirm:

- The new "Critical Paths (new)" card renders below the existing "Critical Paths" card.
- Expanding a row hides every issue not on that path in the grid above (same as the old report's "Show
  critical path and blocked work" button).
- Collapsing the row (or expanding a different one) restores/updates the grid correctly.

- [ ] **Step 5: Commit**

```bash
git add src/react/reports/AutoScheduler/AutoScheduler.tsx
git commit -m "feat: mount CriticalPathsReport below the existing Critical Paths report"
```

---

## Follow-ups (explicitly out of scope for this POC)

- Design Decision 2: validate whether the row's chain should instead be the literal most-common
  per-iteration traced path, rather than today's greedy forward-through-`linkedBlocks` construction with
  the new signal.
- Design Decision 3: switch the "Days" column from `meanWorkDays + meanQueuedDays` summed across the
  chain to a true percentile chain span via `getUncertaintyThresholdData`, per the README.
- Remove the old `<CriticalPath>` report once the new one is validated against real plans (not part of
  this plan — a separate, deliberate cutover).
- "Show more" beyond the top 5 rows (mockup detail not yet wired into the component).
- Team-load section and Report-of-Reports placement from the mockup (separate mockup sections, not part
  of this plan).

## Self-Review

**Spec coverage:** Criticality index (Task 2-5) ✅. Row/chain/fan-out construction (Task 6) ✅. Compact
grid UI with header, chain first/last, work/queued bar, expand-for-detail (Task 7) ✅. Wired to
`workItemsToHighlight` so expanding hides non-path issues (Task 7-8) ✅. No team tag (Task 7 — never
added) ✅. "Queued" copy avoids "waiting on team" (Task 7 copy) ✅.

**Placeholder scan:** No TBD/TODO markers; every step has runnable code.

**Type consistency:** `Hop` (Task 2) is consumed unchanged through `CriticalityAccumulator` (Task 3),
`BatchDatas.criticalityAccumulator` (Task 4), `StatsAnalyzer.criticalityAccumulator` (Task 5),
`CriticalPathRow` (Task 6), and `CriticalPathsReport` (Task 7) — same field names throughout
(`criticalityIndex`, `meanWorkDays`, `meanQueuedDays`, `totalWorkDays`, `totalQueuedDays`, `totalDays`).

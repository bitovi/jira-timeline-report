# Critical Path Epics Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a report to the Auto-Scheduler that ranks epics by how many days each one adds to the plan's critical path, where "critical path" means the longest chain of `Blocks` links measured on sampled durations with team contention ignored.

**Architecture:** Each Monte Carlo iteration already re-samples every epic's duration. Immediately after that resampling — and before scheduling — we run a longest-path dynamic program over the `Blocks` graph and record which epics were on the winning chain and how many days each contributed. A streaming accumulator turns those per-iteration results into two per-epic numbers plus a table of distinct paths and their frequencies. A React report renders the ranked epics; clicking a row filters the Gantt above to the epics that share a critical path with the clicked one.

**Placement and cost:** the report is a **collapsed section directly below the existing capacity-aware `CriticalPathsReport`**. The longest-path work is gated behind a `trackCriticalPath` flag that is off until the user expands it for the first time. Expanding flips the flag, which restarts the simulation with tracking on; collapsing does not turn it back off, so the restart happens at most once per data set.

**Tech Stack:** TypeScript (strict), React 18, Vitest + @testing-library/react, Tailwind CSS.

## Global Constraints

- Prettier: single quotes, 120 print width. Run `npx prettier --write <files>` before every commit.
- TypeScript strict mode with `noImplicitAny` and `strictNullChecks`. `npm run typecheck` must pass.
- Never create new CanJS UI components. All new UI is React.
- Unit tests are colocated with source as `*.test.ts` / `*.test.tsx`.
- Run tests with `npx vitest run <path>` (the `npm run test` script runs the whole suite).
- Do not modify `traceDrivingChain`, `CriticalityAccumulator`, or `CriticalPathsReport`. Those implement the **capacity-aware** report and are a separate feature. This plan adds a parallel, capacity-blind computation.

## Background the implementer needs

The Auto-Scheduler runs 500 batches of 20 iterations (10,000 runs). Per iteration, `runBatch` in
`src/react/reports/AutoScheduler/scheduler/monte-carlo.ts`:

1. calls `resetLinkedIssue` on every issue, which re-samples `mutableWorkItem.daysOfWork`
2. calls `scheduleIssues`, which assigns `mutableWorkItem.startDay` respecting blockers **and** team capacity
3. finds the last-finishing issue and traces the driving chain backward

This plan inserts a new step between 1 and 2, gated on a `trackCriticalPath` flag.

**Why it must run inside the loop, and why that forces a restart rather than lazy evaluation.**
The DP reads `mutableWorkItem.daysOfWork`, which is overwritten by the next call to
`resetLinkedIssue`. The per-iteration values do survive one batch inside
`batchIssueData[i].daysOfWork`, but `StatsAnalyzer.onBatch` then runs `insertSortedArrayInPlace` on
each epic's array independently, which sorts them and **permanently destroys the alignment between
epics within an iteration**. After that there is no way to reconstruct "what did every epic sample
on run 4,271", so the longest path for a past iteration is unrecoverable.

That rules out computing this on demand from stored results. The only two choices are to always pay
for it, or to skip it and re-run the simulation when someone asks. This plan takes the second: the
flag defaults to `false`, and `AutoScheduler` flips it when the section is first expanded, which
re-creates the `StatsAnalyzer` — the same restart that already happens whenever `primary` changes.

Running it **before** `scheduleIssues` rather than after is a separate point: the report deliberately
excludes team contention, so it must not see anything the scheduler decides.

Graph direction on `LinkedIssue` (defined in `scheduler/link-issues.ts`):

- `linkedBlocks` — issues this one blocks (successors)
- `linkedBlockedBy` — issues that block this one (predecessors)

**Why the per-epic numbers sum to the path length.** For one iteration, the critical path length is
the sum of the durations of the epics on it. Averaging over N iterations and swapping the order of
summation gives: mean path length = sum over epics of (that epic's total contributed days / N).
So "days added" per epic sums exactly to the mean critical path length. This identity is the
report's core property and Task 3 tests it directly.

## File Structure

| File                                                            | Responsibility                                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `scheduler/longest-path.ts` (create)                            | Pure longest-path DP over a `Blocks` graph. No knowledge of Monte Carlo.                         |
| `scheduler/longest-path.test.ts` (create)                       | Diamond, ties, cycles, empty input.                                                              |
| `scheduler/critical-path-accumulator.ts` (create)               | Streams per-iteration paths into per-epic totals and path frequencies. Mergeable across batches. |
| `scheduler/critical-path-accumulator.test.ts` (create)          | The sum-to-total identity, merge, path queries.                                                  |
| `scheduler/monte-carlo.ts` (modify)                             | Call the DP per iteration **when tracking is on**, expose the accumulator on `BatchDatas`.       |
| `scheduler/stats-analyzer.ts` (modify)                          | Accept the flag, merge batch accumulators, expose results lazily on `StatsUIData`.               |
| `CriticalPathEpicsReport/build-critical-path-epics.ts` (create) | `StatsUIData` → sorted rows, and the click → highlight-set function.                             |
| `CriticalPathEpicsReport/CriticalPathEpicsReport.tsx` (create)  | Collapsible section: header, the table, the routes card, click handling.                         |
| `CriticalPathEpicsReport/index.ts` (create)                     | Barrel export.                                                                                   |
| `AutoScheduler.tsx` (modify)                                    | Own the expand + latched tracking state, restart the simulation, mount the report.               |

Following the convention already set by `critical-path-trace.ts`, the new scheduler modules declare
**narrow structural interfaces** for their inputs rather than importing `LinkedIssue`. This is what
makes them testable without building `DerivedIssue` fixtures, which the repo does not have.

---

### Task 1: Longest-path computation

**Files:**

- Create: `src/react/reports/AutoScheduler/scheduler/longest-path.ts`
- Test: `src/react/reports/AutoScheduler/scheduler/longest-path.test.ts`

**Interfaces:**

- Consumes: nothing from other tasks.
- Produces: `findLongestPath(issues: PathIssue[]): LongestPath`, plus the exported types
  `PathIssue` and `LongestPath`. `LongestPath` is `{ keys: string[]; days: number[]; totalDays: number }`
  where `days[i]` is the duration of `keys[i]` on this run, and `sum(days) === totalDays`.

- [ ] **Step 1: Write the failing test**

Create `src/react/reports/AutoScheduler/scheduler/longest-path.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findLongestPath, type PathIssue } from './longest-path';

function makeIssue(key: string, daysOfWork: number): PathIssue {
  return { key, mutableWorkItem: { daysOfWork }, linkedBlocks: [] };
}

/** `blocker` blocks `blocked`. */
function block(blocker: PathIssue, blocked: PathIssue): void {
  blocker.linkedBlocks.push(blocked);
}

describe('findLongestPath', () => {
  it('returns an empty path for no issues', () => {
    expect(findLongestPath([])).toEqual({ keys: [], days: [], totalDays: 0 });
  });

  it('returns the single issue when nothing is linked', () => {
    const a = makeIssue('A', 7);
    expect(findLongestPath([a])).toEqual({ keys: ['A'], days: [7], totalDays: 7 });
  });

  it('picks the longest branch of a diamond', () => {
    // S blocks M1 and M2; both block E. S=10, M1=22, M2=18, E=10.
    const s = makeIssue('S', 10);
    const m1 = makeIssue('M1', 22);
    const m2 = makeIssue('M2', 18);
    const e = makeIssue('E', 10);
    block(s, m1);
    block(s, m2);
    block(m1, e);
    block(m2, e);

    const path = findLongestPath([s, m1, m2, e]);

    expect(path.keys).toEqual(['S', 'M1', 'E']);
    expect(path.days).toEqual([10, 22, 10]);
    expect(path.totalDays).toBe(42);
  });

  it('picks the longest of several disconnected components', () => {
    const a = makeIssue('A', 5);
    const b = makeIssue('B', 5);
    block(a, b); // total 10
    const c = makeIssue('C', 20);
    const d = makeIssue('D', 22);
    block(c, d); // total 42

    const path = findLongestPath([a, b, c, d]);

    expect(path.keys).toEqual(['C', 'D']);
    expect(path.totalDays).toBe(42);
  });

  it('breaks ties between equal branches by issue key so the result does not jitter', () => {
    const s = makeIssue('S', 1);
    const z = makeIssue('Z', 5);
    const a = makeIssue('A', 5);
    block(s, z);
    block(s, a);

    expect(findLongestPath([s, z, a]).keys).toEqual(['S', 'A']);
  });

  it('terminates on a cycle instead of recursing forever', () => {
    const a = makeIssue('A', 3);
    const b = makeIssue('B', 4);
    block(a, b);
    block(b, a); // data error: A blocks B blocks A

    const path = findLongestPath([a, b]);

    expect(path.totalDays).toBeGreaterThan(0);
    expect(new Set(path.keys).size).toBe(path.keys.length); // no key repeats
  });

  it('always reports days that sum to totalDays', () => {
    const a = makeIssue('A', 4.5);
    const b = makeIssue('B', 2.25);
    const c = makeIssue('C', 1.5);
    block(a, b);
    block(b, c);

    const path = findLongestPath([a, b, c]);

    expect(path.days.reduce((sum, d) => sum + d, 0)).toBeCloseTo(path.totalDays, 10);
  });

  it('does not hand back a shared empty path object', () => {
    const first = findLongestPath([]);
    first.keys.push('MUTATED');

    expect(findLongestPath([])).toEqual({ keys: [], days: [], totalDays: 0 });
  });

  // This is why the longest path is recomputed on every Monte Carlo iteration instead of once.
  // See the A/B fixture in spec/024-critical-path/dependency-floor.md section 6.
  it('lets the shorter deterministic branch win once durations are sampled', () => {
    // A: 10 -> [9, 9, 9 in parallel] -> 10, deterministic total 29.
    // B: 10 -> 10 -> 10,               deterministic total 30.
    function buildPlan(sample: (mean: number) => number) {
      const a1 = makeIssue('A1', sample(10));
      const a2 = makeIssue('A2', sample(9));
      const a3 = makeIssue('A3', sample(9));
      const a4 = makeIssue('A4', sample(9));
      const a5 = makeIssue('A5', sample(10));
      for (const parallel of [a2, a3, a4]) {
        block(a1, parallel);
        block(parallel, a5);
      }

      const b1 = makeIssue('B1', sample(10));
      const b2 = makeIssue('B2', sample(10));
      const b3 = makeIssue('B3', sample(10));
      block(b1, b2);
      block(b2, b3);

      return [a1, a2, a3, a4, a5, b1, b2, b3];
    }

    expect(findLongestPath(buildPlan((mean) => mean)).keys[0]).toBe('B1');

    // A deterministic LCG so the assertion below cannot flake.
    let seed = 1;
    const sample = (mean: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return mean * (0.5 + (seed / 2147483648) * 1.5); // 0.5x to 2x the mean
    };

    let aWins = 0;
    for (let run = 0; run < 500; run++) {
      if (findLongestPath(buildPlan(sample)).keys[0] === 'A1') aWins++;
    }

    // The exact rate does not matter; that A wins often at all is the whole point. Computing the
    // path once from the means would report B every time and hide branch A completely.
    expect(aWins).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/react/reports/AutoScheduler/scheduler/longest-path.test.ts`
Expected: FAIL — `Failed to resolve import "./longest-path"`.

- [ ] **Step 3: Write the implementation**

Create `src/react/reports/AutoScheduler/scheduler/longest-path.ts`:

```ts
export interface PathWorkItem {
  daysOfWork: number;
}

/**
 * The minimum shape `findLongestPath` needs. `LinkedIssue` satisfies it structurally, but keeping
 * the interface narrow means tests can build graphs without constructing `DerivedIssue` fixtures.
 */
export interface PathIssue {
  key: string;
  mutableWorkItem: PathWorkItem;
  /** Issues this one blocks — i.e. successors in the dependency graph. */
  linkedBlocks: PathIssue[];
}

export interface LongestPath {
  /** Issue keys in dependency order, from the start of the chain to the end. */
  keys: string[];
  /** `days[i]` is `keys[i]`'s sampled duration on this run. Sums to `totalDays`. */
  days: number[];
  totalDays: number;
}

/** A fresh object each time, because callers own what they are handed and `keys` is mutable. */
const emptyPath = (): LongestPath => ({ keys: [], days: [], totalDays: 0 });

/**
 * Finds the longest chain of `Blocks` links, weighted by each issue's current
 * `mutableWorkItem.daysOfWork`. Team capacity is deliberately ignored: this answers "how long
 * would this plan take if nothing ever waited for a free track", which is the quantity the
 * critical-path report decomposes. See spec/024-critical-path/dependency-floor.md.
 *
 * Runs in O(V + E) per call via memoisation, which matters because it runs once per Monte Carlo
 * iteration (10,000 times per simulation).
 */
export function findLongestPath(issues: PathIssue[]): LongestPath {
  if (issues.length === 0) return emptyPath();

  // Longest total duration of any chain that *starts* at this issue, including its own days.
  const forwardDays = new Map<string, number>();
  // The successor to step to in order to realise that longest chain.
  const nextIssue = new Map<string, PathIssue | null>();
  const inProgress = new Set<string>();

  function visit(issue: PathIssue): number {
    const memo = forwardDays.get(issue.key);
    if (memo !== undefined) return memo;

    // A cycle means the `Blocks` links in Jira contradict each other. There is no longest path
    // through a cycle, so we stop the walk here rather than hang the simulation.
    if (inProgress.has(issue.key)) return 0;
    inProgress.add(issue.key);

    let best: PathIssue | null = null;
    let bestDays = 0;
    for (const successor of issue.linkedBlocks) {
      const days = visit(successor);
      const better = best === null || days > bestDays || (days === bestDays && successor.key < best.key);
      if (better) {
        best = successor;
        bestDays = days;
      }
    }

    inProgress.delete(issue.key);
    const total = issue.mutableWorkItem.daysOfWork + (best === null ? 0 : bestDays);
    forwardDays.set(issue.key, total);
    nextIssue.set(issue.key, best);
    return total;
  }

  let start: PathIssue | null = null;
  let startDays = -1;
  for (const issue of issues) {
    const days = visit(issue);
    const better = start === null || days > startDays || (days === startDays && issue.key < start.key);
    if (better) {
      start = issue;
      startDays = days;
    }
  }

  if (start === null) return emptyPath();

  const keys: string[] = [];
  const days: number[] = [];
  let totalDays = 0;
  const walked = new Set<string>();
  let current: PathIssue | null = start;
  while (current !== null && !walked.has(current.key)) {
    walked.add(current.key);
    keys.push(current.key);
    days.push(current.mutableWorkItem.daysOfWork);
    totalDays += current.mutableWorkItem.daysOfWork;
    current = nextIssue.get(current.key) ?? null;
  }

  return { keys, days, totalDays };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/react/reports/AutoScheduler/scheduler/longest-path.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Typecheck and format**

Run: `npm run typecheck` — expected: no output, exit 0.
Run: `npx prettier --write src/react/reports/AutoScheduler/scheduler/longest-path.ts src/react/reports/AutoScheduler/scheduler/longest-path.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/react/reports/AutoScheduler/scheduler/longest-path.ts src/react/reports/AutoScheduler/scheduler/longest-path.test.ts
git commit -m "feat(auto-scheduler): add capacity-blind longest-path computation"
```

---

### Task 2: Critical path accumulator

**Files:**

- Create: `src/react/reports/AutoScheduler/scheduler/critical-path-accumulator.ts`
- Test: `src/react/reports/AutoScheduler/scheduler/critical-path-accumulator.test.ts`

**Interfaces:**

- Consumes: `LongestPath` from `./longest-path` (Task 1).
- Produces: class `CriticalPathAccumulator` with `iterations: number`,
  `addIteration(path: LongestPath): void`, `merge(other: CriticalPathAccumulator): void`,
  `daysAdded(issueKey: string): number`, `onPathIndex(issueKey: string): number`,
  `meanPathLength(): number`, `topPaths(limit: number): PathFrequency[]`,
  `readonly pathCount: number`.
  Exported type `PathFrequency` is `{ keys: string[]; count: number }`.

- [ ] **Step 1: Write the failing test**

Create `src/react/reports/AutoScheduler/scheduler/critical-path-accumulator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CriticalPathAccumulator } from './critical-path-accumulator';
import type { LongestPath } from './longest-path';

function path(keys: string[], days: number[]): LongestPath {
  return { keys, days, totalDays: days.reduce((sum, d) => sum + d, 0) };
}

/**
 * Four hand-computed iterations of a plan where S blocks M1 and M2, both block E, and separately
 * C1 blocks C2. Winners and totals are worked out in spec/024-critical-path/dependency-floor.md.
 */
const fourIterations: LongestPath[] = [
  path(['S', 'M1', 'E'], [10, 22, 10]), // 42
  path(['S', 'M2', 'E'], [9, 24, 11]), // 44
  path(['C1', 'C2'], [20, 22]), // 42
  path(['S', 'M1', 'E'], [10, 25, 10]), // 45
];

describe('CriticalPathAccumulator', () => {
  it('reports zero for everything before any iteration', () => {
    const accumulator = new CriticalPathAccumulator();
    expect(accumulator.iterations).toBe(0);
    expect(accumulator.daysAdded('A')).toBe(0);
    expect(accumulator.onPathIndex('A')).toBe(0);
    expect(accumulator.meanPathLength()).toBe(0);
  });

  it('reports the mean path length', () => {
    const accumulator = new CriticalPathAccumulator();
    fourIterations.forEach((p) => accumulator.addIteration(p));
    expect(accumulator.meanPathLength()).toBeCloseTo(43.25, 10);
  });

  it('reports days added per epic', () => {
    const accumulator = new CriticalPathAccumulator();
    fourIterations.forEach((p) => accumulator.addIteration(p));

    expect(accumulator.daysAdded('M1')).toBeCloseTo(11.75, 10); // (22 + 25) / 4
    expect(accumulator.daysAdded('E')).toBeCloseTo(7.75, 10); // (10 + 11 + 10) / 4
    expect(accumulator.daysAdded('S')).toBeCloseTo(7.25, 10); // (10 + 9 + 10) / 4
    expect(accumulator.daysAdded('M2')).toBeCloseTo(6.0, 10); // 24 / 4
    expect(accumulator.daysAdded('C2')).toBeCloseTo(5.5, 10); // 22 / 4
    expect(accumulator.daysAdded('C1')).toBeCloseTo(5.0, 10); // 20 / 4
    expect(accumulator.daysAdded('NEVER-ON-A-PATH')).toBe(0);
  });

  it('days added across every epic sums to the mean path length', () => {
    const accumulator = new CriticalPathAccumulator();
    fourIterations.forEach((p) => accumulator.addIteration(p));

    const keys = ['S', 'M1', 'M2', 'E', 'C1', 'C2'];
    const sum = keys.reduce((total, key) => total + accumulator.daysAdded(key), 0);

    expect(sum).toBeCloseTo(accumulator.meanPathLength(), 10);
  });

  it('reports how often each epic was on the critical path', () => {
    const accumulator = new CriticalPathAccumulator();
    fourIterations.forEach((p) => accumulator.addIteration(p));

    expect(accumulator.onPathIndex('S')).toBeCloseTo(0.75, 10); // 3 of 4
    expect(accumulator.onPathIndex('M1')).toBeCloseTo(0.5, 10); // 2 of 4
    expect(accumulator.onPathIndex('C1')).toBeCloseTo(0.25, 10); // 1 of 4
    expect(accumulator.onPathIndex('NEVER-ON-A-PATH')).toBe(0);
  });

  it('ranks distinct paths by how often they won, breaking ties deterministically', () => {
    const accumulator = new CriticalPathAccumulator();
    fourIterations.forEach((p) => accumulator.addIteration(p));

    const top = accumulator.topPaths(10);

    expect(top[0]).toEqual({ keys: ['S', 'M1', 'E'], count: 2 });
    expect(top.slice(1).map((p) => p.keys)).toEqual([
      ['C1', 'C2'],
      ['S', 'M2', 'E'],
    ]);
  });

  it('limits topPaths to the requested count', () => {
    const accumulator = new CriticalPathAccumulator();
    fourIterations.forEach((p) => accumulator.addIteration(p));
    expect(accumulator.topPaths(1)).toHaveLength(1);
  });

  it('counts an iteration even when the path is empty', () => {
    const accumulator = new CriticalPathAccumulator();
    accumulator.addIteration({ keys: [], days: [], totalDays: 0 });
    expect(accumulator.iterations).toBe(1);
    expect(accumulator.topPaths(10)).toEqual([]);
  });

  it('merges two accumulators as if all iterations ran on one', () => {
    const first = new CriticalPathAccumulator();
    fourIterations.slice(0, 2).forEach((p) => first.addIteration(p));
    const second = new CriticalPathAccumulator();
    fourIterations.slice(2).forEach((p) => second.addIteration(p));

    first.merge(second);

    const combined = new CriticalPathAccumulator();
    fourIterations.forEach((p) => combined.addIteration(p));

    expect(first.iterations).toBe(combined.iterations);
    expect(first.meanPathLength()).toBeCloseTo(combined.meanPathLength(), 10);
    expect(first.daysAdded('M1')).toBeCloseTo(combined.daysAdded('M1'), 10);
    expect(first.onPathIndex('S')).toBeCloseTo(combined.onPathIndex('S'), 10);
    expect(first.topPaths(10)).toEqual(combined.topPaths(10));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/react/reports/AutoScheduler/scheduler/critical-path-accumulator.test.ts`
Expected: FAIL — `Failed to resolve import "./critical-path-accumulator"`.

- [ ] **Step 3: Write the implementation**

Create `src/react/reports/AutoScheduler/scheduler/critical-path-accumulator.ts`:

```ts
import type { LongestPath } from './longest-path';

export interface PathFrequency {
  keys: string[];
  count: number;
}

/**
 * Turns a stream of per-iteration `findLongestPath` results into, per issue: the average number of
 * days it contributed to the critical path across *all* iterations, and the fraction of iterations
 * it was on the path at all.
 *
 * `daysAdded` deliberately divides by every iteration rather than only the ones the issue appeared
 * in. That is what makes the numbers additive: summing `daysAdded` over every issue reproduces
 * `meanPathLength()` exactly. See spec/024-critical-path/dependency-floor.md.
 */
export class CriticalPathAccumulator {
  iterations = 0;
  private totalDaysSum = 0;
  private onPathCount = new Map<string, number>();
  private daysSum = new Map<string, number>();
  private pathCounts = new Map<string, PathFrequency>();

  addIteration(path: LongestPath): void {
    this.iterations++;
    this.totalDaysSum += path.totalDays;

    for (let i = 0; i < path.keys.length; i++) {
      const key = path.keys[i];
      this.onPathCount.set(key, (this.onPathCount.get(key) ?? 0) + 1);
      this.daysSum.set(key, (this.daysSum.get(key) ?? 0) + path.days[i]);
    }

    if (path.keys.length === 0) return;
    const pathId = path.keys.join('\u0000');
    const existing = this.pathCounts.get(pathId);
    if (existing) {
      existing.count++;
    } else {
      this.pathCounts.set(pathId, { keys: [...path.keys], count: 1 });
    }
  }

  merge(other: CriticalPathAccumulator): void {
    this.iterations += other.iterations;
    this.totalDaysSum += other.totalDaysSum;

    for (const [key, count] of other.onPathCount) {
      this.onPathCount.set(key, (this.onPathCount.get(key) ?? 0) + count);
    }
    for (const [key, sum] of other.daysSum) {
      this.daysSum.set(key, (this.daysSum.get(key) ?? 0) + sum);
    }
    for (const [pathId, frequency] of other.pathCounts) {
      const existing = this.pathCounts.get(pathId);
      if (existing) {
        existing.count += frequency.count;
      } else {
        this.pathCounts.set(pathId, { keys: [...frequency.keys], count: frequency.count });
      }
    }
  }

  /** Average days this issue contributed to the critical path, across every iteration. */
  daysAdded(issueKey: string): number {
    if (this.iterations === 0) return 0;
    return (this.daysSum.get(issueKey) ?? 0) / this.iterations;
  }

  /** Fraction of iterations in which this issue was on the critical path. */
  onPathIndex(issueKey: string): number {
    if (this.iterations === 0) return 0;
    return (this.onPathCount.get(issueKey) ?? 0) / this.iterations;
  }

  meanPathLength(): number {
    if (this.iterations === 0) return 0;
    return this.totalDaysSum / this.iterations;
  }

  /** Distinct paths, most frequent first. Ties break on the joined key so the order is stable. */
  topPaths(limit: number): PathFrequency[] {
    return (
      [...this.pathCounts.entries()]
        .sort(([idA, a], [idB, b]) => (b.count !== a.count ? b.count - a.count : idA < idB ? -1 : 1))
        .slice(0, limit)
        // Copies, because `addIteration` and `merge` mutate the stored entries in place. Handing
        // out the live objects would mutate a `StatsUIData` React has already rendered.
        .map(([, frequency]) => ({ keys: [...frequency.keys], count: frequency.count }))
    );
  }

  /** How many distinct paths have been seen. Lets the UI say "N other routes" without sorting. */
  get pathCount(): number {
    return this.pathCounts.size;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/react/reports/AutoScheduler/scheduler/critical-path-accumulator.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Typecheck and format**

Run: `npm run typecheck` — expected: no output, exit 0.
Run: `npx prettier --write src/react/reports/AutoScheduler/scheduler/critical-path-accumulator.ts src/react/reports/AutoScheduler/scheduler/critical-path-accumulator.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/react/reports/AutoScheduler/scheduler/critical-path-accumulator.ts src/react/reports/AutoScheduler/scheduler/critical-path-accumulator.test.ts
git commit -m "feat(auto-scheduler): accumulate per-epic critical path contribution"
```

---

### Task 3: Wire the computation into the simulation

**Files:**

- Modify: `src/react/reports/AutoScheduler/scheduler/monte-carlo.ts`
- Modify: `src/react/reports/AutoScheduler/scheduler/stats-analyzer.ts`
- Test: `src/react/reports/AutoScheduler/scheduler/monte-carlo.test.ts` (add one test)

**Interfaces:**

- Consumes: `findLongestPath` (Task 1); `CriticalPathAccumulator` and
  `PathFrequency` (Task 2).
- Produces:
  - `runMonteCarlo` and `StatsAnalyzer` both gain a `trackCriticalPath?: boolean` option,
    defaulting to `false`.
  - `BatchDatas` gains `criticalPathAccumulator: CriticalPathAccumulator` (present always, but left
    at zero iterations when tracking is off).
  - `StatsUIData` gains
    `criticalPath: { meanLength: number; iterations: number; distinctPathCount: number; topPaths(limit: number): PathFrequency[] } | null`
    — `null` whenever tracking is off.
  - Every entry of `StatsUIData['simulationIssueResults']` gains `sequencingDaysAdded: number`
    and `sequencingCriticalityIndex: number` (both `0` when tracking is off).

The `sequencing` prefix keeps these clear of the existing capacity-**aware** `criticalityIndex` on
the same row object, and matches `dependency-floor.md` section 2's "sequencing criticality index".

`topPaths` is exposed as a **function, not a precomputed array**, because `dataForUI` runs once per
batch (500 times per simulation) and the routes card only ever shows five rows. Making it lazy means
the sort happens when something renders, not when something might. `iterations` is exposed so the
routes card can show each route's share of **all** runs rather than its share of the five shown.

- [ ] **Step 1: Write the failing test**

Append this to the `describe('runMonteCarlo', ...)` block in
`src/react/reports/AutoScheduler/scheduler/monte-carlo.test.ts`, immediately before its closing `});`:

```ts
it('records one critical path iteration per run when tracking is on', () => {
  const onBatch = vi.fn();
  const onComplete = vi.fn();

  const { runBatchAndLoop } = runMonteCarlo(noIssues, {
    onBatch,
    onComplete,
    batches: 1,
    batchSize: 3,
    timeBetweenBatches: 1,
    trackCriticalPath: true,
  });

  runBatchAndLoop();

  const { batchData } = onBatch.mock.calls[0][0];
  expect(batchData.criticalPathAccumulator.iterations).toBe(3);
  expect(batchData.criticalPathAccumulator.meanPathLength()).toBe(0); // no issues, no path
});

it('does no critical path work when tracking is off', () => {
  const onBatch = vi.fn();
  const onComplete = vi.fn();

  const { runBatchAndLoop } = runMonteCarlo(noIssues, {
    onBatch,
    onComplete,
    batches: 1,
    batchSize: 3,
    timeBetweenBatches: 1,
    // trackCriticalPath omitted — defaults to false
  });

  runBatchAndLoop();

  const { batchData } = onBatch.mock.calls[0][0];
  expect(batchData.criticalPathAccumulator.iterations).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/react/reports/AutoScheduler/scheduler/monte-carlo.test.ts`
Expected: FAIL — `Cannot read properties of undefined (reading 'iterations')`.

- [ ] **Step 3: Update `monte-carlo.ts`**

In `src/react/reports/AutoScheduler/scheduler/monte-carlo.ts`, add these two imports below the
existing `CriticalityAccumulator` import:

```ts
import { findLongestPath } from './longest-path';
import { CriticalPathAccumulator } from './critical-path-accumulator';
```

Add the field to `BatchDatas`:

```ts
export type BatchDatas = {
  batchIssueData: BatchIssueData[];
  lastDays: number[];
  criticalityAccumulator: CriticalityAccumulator;
  criticalPathAccumulator: CriticalPathAccumulator;
};
```

Add the option to `runMonteCarlo`'s destructured second argument and its type, next to
`probabilisticallySelectIssueTiming`:

```ts
    probabilisticallySelectIssueTiming = true,
    trackCriticalPath = false,
  }: {
    // …existing members…
    probabilisticallySelectIssueTiming?: boolean;
    trackCriticalPath?: boolean;
  },
```

Pass it down at the `runBatch` call site inside `runBatchAndLoop`:

```ts
const batchData = runBatch(linkedIssues, { batchSize, trackCriticalPath });
```

Widen `runBatch`'s signature to match:

```ts
function runBatch(
  linkedIssues: LinkedIssue[],
  { batchSize, trackCriticalPath }: { batchSize: number; trackCriticalPath: boolean },
): BatchDatas {
```

Inside `runBatch`, declare the accumulator next to the existing one:

```ts
const lastDays: number[] = [];
const criticalityAccumulator = new CriticalityAccumulator();
const criticalPathAccumulator = new CriticalPathAccumulator();
```

Inside the `for (let i = 0; i < batchSize; i++)` loop, immediately after the reset loop and
**before** `const teamWork = scheduleIssues(linkedIssues);`, insert:

```ts
// Runs on the freshly sampled durations and before scheduling, because the critical path
// deliberately ignores team capacity — it is the finish this plan would reach if nothing ever
// waited for a free track. See spec/024-critical-path/dependency-floor.md.
//
// Gated because it cannot be deferred: `onBatch` sorts each epic's `daysOfWork` independently,
// so once a batch is merged the per-iteration samples can no longer be lined up. Skipping it
// here means the report needs a simulation restart to appear, which is what expanding it does.
if (trackCriticalPath) {
  criticalPathAccumulator.addIteration(findLongestPath(linkedIssues));
}
```

> No cast is needed: `LinkedIssue` satisfies `PathIssue` structurally. If it ever stops doing so
> that should be a compile error, not something a double cast hides.

Change the return statement at the end of `runBatch` to:

```ts
return { batchIssueData: items, lastDays, criticalityAccumulator, criticalPathAccumulator };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/react/reports/AutoScheduler/scheduler/monte-carlo.test.ts`
Expected: PASS — all tests including the new one.

- [ ] **Step 5: Update `stats-analyzer.ts`**

In `src/react/reports/AutoScheduler/scheduler/stats-analyzer.ts`, add the import below the existing
`CriticalityAccumulator` import:

```ts
import { CriticalPathAccumulator } from './critical-path-accumulator';
```

Add the fields next to the existing accumulator on the class:

```ts
criticalityAccumulator = new CriticalityAccumulator();
criticalPathAccumulator = new CriticalPathAccumulator();
trackCriticalPath: boolean;
```

Accept the flag in the constructor and forward it to `runMonteCarlo`:

```ts
  constructor({
    issues,
    uncertaintyWeight,
    setUIState,
    trackCriticalPath = false,
  }: {
    issues: DerivedIssue[];
    uncertaintyWeight: number | 'average';
    setUIState: (data: StatsUIData) => void;
    trackCriticalPath?: boolean;
  }) {
    this.trackCriticalPath = trackCriticalPath;
    const { linkedIssues, runBatchAndLoop, teardown } = runMonteCarlo(issues, {
      onBatch: this.onBatch.bind(this),
      onComplete: this.onComplete.bind(this),
      trackCriticalPath,
    });
```

> `this.trackCriticalPath` must be assigned **before** `runMonteCarlo`, because the existing
> constructor calls `runBatchAndLoop()` at its end, which synchronously reaches `dataForUI`.

In `onBatch`, below the existing merge:

```ts
this.criticalityAccumulator.merge(batchData.criticalityAccumulator);
this.criticalPathAccumulator.merge(batchData.criticalPathAccumulator);
```

In `dataForUI`, extend the per-issue result object:

```ts
const simulationIssueResults = this.simulationIssues.map((simulationIssue) => {
  const result = getUncertaintyThresholdData(simulationIssue, this.uncertaintyWeight);
  const key = simulationIssue.linkedIssue.key;
  return {
    ...result,
    criticalityIndex: this.criticalityAccumulator.criticalityIndex(key),
    meanWorkDays: this.criticalityAccumulator.meanWorkDays(key),
    meanQueuedDays: this.criticalityAccumulator.meanQueuedDays(key),
    sequencingDaysAdded: this.criticalPathAccumulator.daysAdded(key),
    sequencingCriticalityIndex: this.criticalPathAccumulator.onPathIndex(key),
  };
});
```

Directly above the final `return {` of `dataForUI`, add:

```ts
// `topPaths` is a thunk, not an array: `dataForUI` runs once per batch and the routes card shows
// five rows, so sorting the whole path map here would throw away 499 of every 500 results.
// `null` when tracking is off, so the report can tell "no data yet" from "nothing on any path".
const criticalPath = this.trackCriticalPath
  ? {
      meanLength: this.criticalPathAccumulator.meanPathLength(),
      iterations: this.criticalPathAccumulator.iterations,
      distinctPathCount: this.criticalPathAccumulator.pathCount,
      topPaths: (limit: number) => this.criticalPathAccumulator.topPaths(limit),
    }
  : null;
```

Add `criticalPath` to the returned object:

```ts
return {
  percentComplete: this.percentComplete,
  uncertaintyWeight: this.uncertaintyWeight,
  endDaySimulationResult,
  overallConfidence,
  simulationIssueResults,
  teams,
  criticalPath,
};
```

- [ ] **Step 6: Verify the whole scheduler suite and types**

Run: `npx vitest run src/react/reports/AutoScheduler`
Expected: PASS — all existing tests still pass.
Run: `npm run typecheck` — expected: no output, exit 0.

- [ ] **Step 7: Format and commit**

```bash
npx prettier --write src/react/reports/AutoScheduler/scheduler/monte-carlo.ts src/react/reports/AutoScheduler/scheduler/stats-analyzer.ts src/react/reports/AutoScheduler/scheduler/monte-carlo.test.ts
git add src/react/reports/AutoScheduler/scheduler/monte-carlo.ts src/react/reports/AutoScheduler/scheduler/stats-analyzer.ts src/react/reports/AutoScheduler/scheduler/monte-carlo.test.ts
git commit -m "feat(auto-scheduler): expose critical path stats on simulation UI data"
```

---

### Task 4: Build the report rows and the highlight set

**Files:**

- Create: `src/react/reports/AutoScheduler/CriticalPathEpicsReport/build-critical-path-epics.ts`
- Test: `src/react/reports/AutoScheduler/CriticalPathEpicsReport/build-critical-path-epics.test.ts`

**Interfaces:**

- Consumes: `StatsUIData` from `../scheduler/stats-analyzer` (Task 3), `PathFrequency` from
  `../scheduler/critical-path-accumulator` (Task 2).
- Produces: `buildCriticalPathEpics(uiData: StatsUIData): CriticalPathEpicRow[]` and
  `highlightKeysFor(paths: PathFrequency[], issueKey: string): Set<string>`.
  `CriticalPathEpicRow` is `{ key, summary, url, teamName, daysAdded, onPathIndex }`.

- [ ] **Step 1: Write the failing test**

Create `src/react/reports/AutoScheduler/CriticalPathEpicsReport/build-critical-path-epics.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildCriticalPathEpics, highlightKeysFor } from './build-critical-path-epics';
import type { StatsUIData } from '../scheduler/stats-analyzer';

function uiDataWith(
  results: Array<{ key: string; team: string; sequencingDaysAdded: number; sequencingCriticalityIndex: number }>,
): StatsUIData {
  return {
    simulationIssueResults: results.map((result) => ({
      linkedIssue: {
        key: result.key,
        summary: `Summary of ${result.key}`,
        url: `#${result.key}`,
        team: { name: result.team },
      },
      sequencingDaysAdded: result.sequencingDaysAdded,
      sequencingCriticalityIndex: result.sequencingCriticalityIndex,
    })),
    criticalPath: null,
  } as unknown as StatsUIData;
}

describe('buildCriticalPathEpics', () => {
  it('ranks epics by days added, not by how often they are on the path', () => {
    const uiData = uiDataWith([
      { key: 'CHECKOUT', team: 'Alpha', sequencingDaysAdded: 7.8, sequencingCriticalityIndex: 0.68 },
      { key: 'PAYMENTS', team: 'Beta', sequencingDaysAdded: 11.8, sequencingCriticalityIndex: 0.41 },
      { key: 'SEARCH', team: 'Gamma', sequencingDaysAdded: 6.0, sequencingCriticalityIndex: 0.26 },
    ]);

    expect(buildCriticalPathEpics(uiData).map((row) => row.key)).toEqual(['PAYMENTS', 'CHECKOUT', 'SEARCH']);
  });

  it('carries summary, url and team through to the row', () => {
    const uiData = uiDataWith([
      { key: 'PAYMENTS', team: 'Beta', sequencingDaysAdded: 11.8, sequencingCriticalityIndex: 0.41 },
    ]);

    expect(buildCriticalPathEpics(uiData)[0]).toEqual({
      key: 'PAYMENTS',
      summary: 'Summary of PAYMENTS',
      url: '#PAYMENTS',
      teamName: 'Beta',
      daysAdded: 11.8,
      onPathIndex: 0.41,
    });
  });

  it('keeps epics that never reach the critical path, ordered last', () => {
    const uiData = uiDataWith([
      { key: 'RATINGS', team: 'Gamma', sequencingDaysAdded: 0, sequencingCriticalityIndex: 0 },
      { key: 'PAYMENTS', team: 'Beta', sequencingDaysAdded: 11.8, sequencingCriticalityIndex: 0.41 },
    ]);

    expect(buildCriticalPathEpics(uiData).map((row) => row.key)).toEqual(['PAYMENTS', 'RATINGS']);
  });

  it('breaks ties on key so the order does not jitter between batches', () => {
    const uiData = uiDataWith([
      { key: 'ZULU', team: 'Alpha', sequencingDaysAdded: 5, sequencingCriticalityIndex: 0.5 },
      { key: 'ALPHA', team: 'Alpha', sequencingDaysAdded: 5, sequencingCriticalityIndex: 0.5 },
    ]);

    expect(buildCriticalPathEpics(uiData).map((row) => row.key)).toEqual(['ALPHA', 'ZULU']);
  });
});

describe('highlightKeysFor', () => {
  const paths = [
    { keys: ['IDENTITY', 'CHECKOUT', 'PAYMENTS'], count: 41 },
    { keys: ['SELLER', 'SEARCH'], count: 26 },
    { keys: ['IDENTITY', 'CHECKOUT', 'FRAUD'], count: 18 },
  ];

  it('returns every epic on every path containing the clicked epic', () => {
    expect(highlightKeysFor(paths, 'CHECKOUT')).toEqual(new Set(['IDENTITY', 'CHECKOUT', 'PAYMENTS', 'FRAUD']));
  });

  it('returns just the one path when the epic sits on only one', () => {
    expect(highlightKeysFor(paths, 'SEARCH')).toEqual(new Set(['SELLER', 'SEARCH']));
  });

  it('falls back to the epic alone when it is never on a critical path', () => {
    expect(highlightKeysFor(paths, 'RATINGS')).toEqual(new Set(['RATINGS']));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/react/reports/AutoScheduler/CriticalPathEpicsReport`
Expected: FAIL — `Failed to resolve import "./build-critical-path-epics"`.

- [ ] **Step 3: Write the implementation**

Create `src/react/reports/AutoScheduler/CriticalPathEpicsReport/build-critical-path-epics.ts`:

```ts
import type { StatsUIData } from '../scheduler/stats-analyzer';
import type { PathFrequency } from '../scheduler/critical-path-accumulator';

export type CriticalPathEpicRow = {
  key: string;
  summary: string;
  url: string;
  teamName: string;
  /** Average days this epic contributed to the critical path. Sums to the path length. */
  daysAdded: number;
  /** Fraction of simulation runs in which this epic was on the critical path. */
  onPathIndex: number;
};

/**
 * Ranks by days added rather than by `onPathIndex`, because the percentage is size-blind: a short
 * epic that is always on the path would outrank a long one that is usually on it, while being
 * worth far less to shorten. See spec/024-critical-path/mockups/earliest-finish.html section 4.
 */
export function buildCriticalPathEpics(uiData: StatsUIData): CriticalPathEpicRow[] {
  return uiData.simulationIssueResults
    .map((result) => ({
      key: result.linkedIssue.key,
      summary: result.linkedIssue.summary,
      url: result.linkedIssue.url,
      teamName: result.linkedIssue.team.name,
      daysAdded: result.sequencingDaysAdded,
      onPathIndex: result.sequencingCriticalityIndex,
    }))
    .sort((a, b) => (b.daysAdded !== a.daysAdded ? b.daysAdded - a.daysAdded : a.key < b.key ? -1 : 1));
}

/**
 * The epics to show in the Gantt when a row is clicked: everything that shared a critical path
 * with the clicked epic in at least one simulation run. An epic that never reached the critical
 * path highlights only itself, so the grid never blanks out.
 */
export function highlightKeysFor(paths: PathFrequency[], issueKey: string): Set<string> {
  const keys = new Set<string>();
  for (const path of paths) {
    if (!path.keys.includes(issueKey)) continue;
    for (const key of path.keys) keys.add(key);
  }
  if (keys.size === 0) keys.add(issueKey);
  return keys;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/react/reports/AutoScheduler/CriticalPathEpicsReport`
Expected: PASS — 7 tests.

- [ ] **Step 5: Typecheck, format, commit**

```bash
npm run typecheck
npx prettier --write src/react/reports/AutoScheduler/CriticalPathEpicsReport/
git add src/react/reports/AutoScheduler/CriticalPathEpicsReport/
git commit -m "feat(auto-scheduler): build critical path epic rows and highlight sets"
```

---

### Task 5: The report component

**Files:**

- Create: `src/react/reports/AutoScheduler/CriticalPathEpicsReport/CriticalPathEpicsReport.tsx`
- Create: `src/react/reports/AutoScheduler/CriticalPathEpicsReport/index.ts`
- Test: `src/react/reports/AutoScheduler/CriticalPathEpicsReport/CriticalPathEpicsReport.test.tsx`

**Interfaces:**

- Consumes: `buildCriticalPathEpics`, `highlightKeysFor` (Task 4); `StatsUIData` (Task 3).
- Produces: `CriticalPathEpicsReport` React component with props
  `{ uiData: StatsUIData; expanded: boolean; onExpandedChange: (expanded: boolean) => void; workItemsToHighlight: Set<string> | null; setWorkItemsToHighlight: React.Dispatch<React.SetStateAction<Set<string> | null>> }`.

The expanded state is **controlled by `AutoScheduler`**, not owned here, because expanding has to
restart the simulation (Task 6). The body is conditionally rendered rather than hidden with CSS, so
nothing sorts or maps while collapsed.

`workItemsToHighlight` is read as well as written. `CriticalPathsReport` derives its state from that
prop so the components writing to it stay consistent; this report keeps a local `selectedKey` but
clears it whenever the prop changes to a set it did not write. Fully deriving — recomputing which
row matches the current set — would mean sorting every path on every render.

The header is a `<button aria-expanded>` rather than `<details>`/`<summary>`. `CriticalPathsReport`
uses `<details>`, but jsdom does not fire `toggle` on a `<summary>` click, which would make the
expand test unreliable; a button is also what carries the state correctly when it is controlled.

- [ ] **Step 1: Write the failing test**

Create `src/react/reports/AutoScheduler/CriticalPathEpicsReport/CriticalPathEpicsReport.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CriticalPathEpicsReport } from './CriticalPathEpicsReport';
import type { StatsUIData } from '../scheduler/stats-analyzer';

const routes = [
  { keys: ['IDENTITY', 'CHECKOUT', 'PAYMENTS'], count: 55 },
  { keys: ['IDENTITY', 'CHECKOUT', 'FRAUD'], count: 18 },
];

function epic(key: string, summary: string, team: string, daysAdded: number, onPathIndex: number) {
  return {
    linkedIssue: { key, summary, url: `#${key}`, team: { name: team } },
    sequencingDaysAdded: daysAdded,
    sequencingCriticalityIndex: onPathIndex,
  };
}

const uiData = {
  simulationIssueResults: [
    epic('CHECKOUT', 'Checkout rewrite', 'Alpha', 7.8, 0.68),
    epic('PAYMENTS', 'Payments API', 'Beta', 11.75, 0.41),
    epic('IDENTITY', 'Identity service', 'Alpha', 4.2, 0.9),
    epic('FRAUD', 'Fraud checks', 'Gamma', 0, 0),
  ],
  criticalPath: {
    meanLength: 43.0,
    iterations: 100,
    // Only two routes are listed above, so the card has ten more to summarise.
    distinctPathCount: 12,
    topPaths: (limit: number) => routes.slice(0, limit),
  },
} as unknown as StatsUIData;

/** Same simulation, but tracking has only just been switched on, so no batch has landed yet. */
const uiDataNotYetComputed = { ...uiData, criticalPath: null } as unknown as StatsUIData;

function renderReport(props: Partial<React.ComponentProps<typeof CriticalPathEpicsReport>> = {}) {
  const setWorkItemsToHighlight = vi.fn();
  const onExpandedChange = vi.fn();
  const allProps = {
    uiData,
    expanded: true,
    workItemsToHighlight: null,
    onExpandedChange,
    setWorkItemsToHighlight,
    ...props,
  } as React.ComponentProps<typeof CriticalPathEpicsReport>;

  const { rerender } = render(<CriticalPathEpicsReport {...allProps} />);

  return {
    setWorkItemsToHighlight,
    onExpandedChange,
    setHighlightFromElsewhere: (workItemsToHighlight: Set<string> | null) =>
      rerender(<CriticalPathEpicsReport {...allProps} workItemsToHighlight={workItemsToHighlight} />),
  };
}

describe('CriticalPathEpicsReport', () => {
  it('renders only the header while collapsed', () => {
    renderReport({ expanded: false });

    expect(screen.getByRole('button', { name: /Epics on the critical path/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Payments API')).not.toBeInTheDocument();
  });

  it('asks to be expanded when the header is clicked', () => {
    const { onExpandedChange } = renderReport({ expanded: false });

    fireEvent.click(screen.getByRole('button', { name: /Epics on the critical path/ }));

    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  it('says it is still calculating when tracking has just been switched on', () => {
    renderReport({ uiData: uiDataNotYetComputed });

    expect(screen.getByText(/Calculating/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('lists epics ranked by days added, with the team and the percentage', () => {
    renderReport();

    const rows = screen.getAllByRole('row');
    // header, four epics, footer
    expect(rows).toHaveLength(6);
    expect(rows[1]).toHaveTextContent('Payments API');
    expect(rows[1]).toHaveTextContent('11.8');
    expect(rows[1]).toHaveTextContent('41%');
    expect(rows[2]).toHaveTextContent('Checkout rewrite');
  });

  it('folds epics past the tenth into a residual row so the column still sums to the footer', () => {
    const manyEpics = {
      ...uiData,
      // 12 down to 1, summing to 78.
      simulationIssueResults: Array.from({ length: 12 }, (_, index) =>
        epic(`E${index}`, `Epic ${index}`, 'Alpha', 12 - index, 0.5),
      ),
    } as unknown as StatsUIData;

    renderReport({ uiData: manyEpics });

    // header, ten epics, residual, footer
    expect(screen.getAllByRole('row')).toHaveLength(13);
    expect(screen.getByText('2 other epics')).toBeInTheDocument();
    expect(screen.getByText('3.0')).toBeInTheDocument(); // the 2 + 1 the table stopped listing
  });

  it('shows the critical path length as the column total', () => {
    renderReport();

    expect(screen.getByText('Critical path length')).toBeInTheDocument();
    expect(screen.getByText('43.0')).toBeInTheDocument();
  });

  it('highlights every epic sharing a critical path with the clicked epic', () => {
    const { setWorkItemsToHighlight } = renderReport();

    fireEvent.click(screen.getByRole('button', { name: /Checkout rewrite/ }));

    expect(setWorkItemsToHighlight).toHaveBeenCalledWith(new Set(['IDENTITY', 'CHECKOUT', 'PAYMENTS', 'FRAUD']));
  });

  it('clears the highlight when the selected epic is clicked again', () => {
    const { setWorkItemsToHighlight } = renderReport();

    const button = screen.getByRole('button', { name: /Checkout rewrite/ });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(setWorkItemsToHighlight).toHaveBeenLastCalledWith(null);
  });

  it('lists the most common critical paths by summary, as a share of every run', () => {
    renderReport();

    expect(screen.getByText('Most common critical paths')).toBeInTheDocument();
    // Summaries, not keys.
    expect(screen.getByText('Identity service → Checkout rewrite → Payments API')).toBeInTheDocument();
    expect(screen.getByText('55%')).toBeInTheDocument(); // 55 of 100 iterations, not 55 of 73
  });

  it('summarises the routes it did not list', () => {
    renderReport();

    expect(screen.getByText('10 other routes')).toBeInTheDocument(); // 12 distinct, 2 shown
    expect(screen.getByText('27%')).toBeInTheDocument(); // the 100 - 55 - 18 runs they account for
  });

  it('hides routes that do not contain the selected epic', () => {
    renderReport();

    fireEvent.click(screen.getByRole('button', { name: /Payments API/ }));

    expect(screen.getByText('Identity service → Checkout rewrite → Payments API')).toBeInTheDocument();
    // Hidden outright rather than dimmed — PAYMENTS is not on the FRAUD route.
    expect(screen.queryByText('Identity service → Checkout rewrite → Fraud checks')).not.toBeInTheDocument();
  });

  it('drops its own selection when another report changes the highlight', () => {
    const { setHighlightFromElsewhere } = renderReport();

    fireEvent.click(screen.getByRole('button', { name: /Payments API/ }));
    expect(screen.queryByText('Identity service → Checkout rewrite → Fraud checks')).not.toBeInTheDocument();

    setHighlightFromElsewhere(new Set(['SELLER', 'SEARCH']));

    // The grid no longer shows this report's chain, so it stops filtering to it.
    expect(screen.getByText('Identity service → Checkout rewrite → Fraud checks')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/react/reports/AutoScheduler/CriticalPathEpicsReport`
Expected: FAIL — `Failed to resolve import "./CriticalPathEpicsReport"`.

- [ ] **Step 3: Write the component**

Create `src/react/reports/AutoScheduler/CriticalPathEpicsReport/CriticalPathEpicsReport.tsx`:

```tsx
import React from 'react';
import type { StatsUIData } from '../scheduler/stats-analyzer';
import { buildCriticalPathEpics, highlightKeysFor } from './build-critical-path-epics';

interface CriticalPathEpicsReportProps {
  uiData: StatsUIData;
  /** Controlled by `AutoScheduler`: expanding restarts the simulation with tracking on. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  workItemsToHighlight: Set<string> | null;
  setWorkItemsToHighlight: React.Dispatch<React.SetStateAction<Set<string> | null>>;
}

/** Routes shown for context. The epic table beside it carries the ranking, so this can be short. */
const ROUTES_SHOWN = 5;
/** Epic rows listed before the tail is folded into one residual row. */
const EPIC_ROWS_SHOWN = 10;

export const CriticalPathEpicsReport: React.FC<CriticalPathEpicsReportProps> = ({
  uiData,
  expanded,
  onExpandedChange,
  workItemsToHighlight,
  setWorkItemsToHighlight,
}) => {
  return (
    <div className="bg-white border border-neutral-30 rounded shadow-sm mt-4">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => onExpandedChange(!expanded)}
        className="w-full text-left px-4 py-3 hover:bg-neutral-20"
      >
        <p className="font-bold text-base">
          <span className="mr-2 text-neutral-500">{expanded ? '▾' : '▸'}</span>
          Epics on the critical path
        </p>
        <p className="text-xs text-neutral-500">
          Ranked by the days each adds · ignoring team contention · average of all simulation runs
        </p>
      </button>
      {/* Rendered conditionally, not hidden: nothing should sort or map while collapsed. */}
      {expanded && (
        <CriticalPathEpicsBody
          uiData={uiData}
          workItemsToHighlight={workItemsToHighlight}
          setWorkItemsToHighlight={setWorkItemsToHighlight}
        />
      )}
    </div>
  );
};

const CriticalPathEpicsBody: React.FC<{
  uiData: StatsUIData;
  workItemsToHighlight: Set<string> | null;
  setWorkItemsToHighlight: React.Dispatch<React.SetStateAction<Set<string> | null>>;
}> = ({ uiData, workItemsToHighlight, setWorkItemsToHighlight }) => {
  const criticalPath = uiData.criticalPath;
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const highlightWeWrote = React.useRef<Set<string> | null>(null);

  // `CriticalPathsReport` and the Gantt write to the same shared set. When one of them does, this
  // report's row selection no longer describes what the grid is showing, so it is dropped. Fully
  // deriving the selection instead would mean sorting every path on every render.
  React.useEffect(() => {
    if (workItemsToHighlight !== highlightWeWrote.current) setSelectedKey(null);
  }, [workItemsToHighlight]);

  const allRows = React.useMemo(() => buildCriticalPathEpics(uiData), [uiData]);
  const rows = allRows.slice(0, EPIC_ROWS_SHOWN);
  const otherRows = allRows.slice(EPIC_ROWS_SHOWN);
  const otherRowDaysAdded = otherRows.reduce((sum, row) => sum + row.daysAdded, 0);

  /** Routes carry keys only, so readable labels have to come back from the simulation results. */
  const summaryByKey = React.useMemo(
    () => new Map(uiData.simulationIssueResults.map((r) => [r.linkedIssue.key, r.linkedIssue.summary])),
    [uiData],
  );

  const { routes, otherRouteCount, otherRouteRuns } = React.useMemo(() => {
    if (!criticalPath) return { routes: [], otherRouteCount: 0, otherRouteRuns: 0 };
    // Hidden, not dimmed: with a hundred epics on screen a dimmed row is still noise, and the
    // point of the click is to isolate the blocking chain. Asks for every route rather than the
    // top five so a rarely-winning route containing the selected epic is not lost behind them.
    const matching = selectedKey
      ? criticalPath.topPaths(Number.POSITIVE_INFINITY).filter((path) => path.keys.includes(selectedKey))
      : null;
    const shown = (matching ?? criticalPath.topPaths(ROUTES_SHOWN)).slice(0, ROUTES_SHOWN);
    const shownRuns = shown.reduce((sum, path) => sum + path.count, 0);
    return {
      routes: shown,
      otherRouteCount: (matching ? matching.length : criticalPath.distinctPathCount) - shown.length,
      otherRouteRuns:
        (matching ? matching.reduce((sum, path) => sum + path.count, 0) : criticalPath.iterations) - shownRuns,
    };
  }, [criticalPath, selectedKey]);

  function onRowClick(key: string) {
    if (selectedKey === key || !criticalPath) {
      setSelectedKey(null);
      highlightWeWrote.current = null;
      setWorkItemsToHighlight(null);
      return;
    }
    setSelectedKey(key);
    // Every route, not just the five shown: an epic can sit on a rare route and would otherwise
    // highlight only itself while still reporting a non-zero percentage. Clicks are rare, so
    // paying for the full sort here is cheap.
    const keys = highlightKeysFor(criticalPath.topPaths(Number.POSITIVE_INFINITY), key);
    highlightWeWrote.current = keys;
    setWorkItemsToHighlight(keys);
  }

  // Null between the user expanding the section and the first batch of the restarted,
  // critical-path-tracking simulation landing. See Task 6.
  if (!criticalPath) {
    return <div className="px-4 py-6 text-sm text-neutral-500">Calculating critical paths…</div>;
  }

  // Share of every run, not of the routes shown — otherwise a route that wins 41 of 10,000 runs
  // would read as a majority just because it tops a short list.
  const percentOfRuns = (count: number) =>
    criticalPath.iterations === 0 ? 0 : Math.round((count / criticalPath.iterations) * 100);
  const routeLabel = (keys: string[]) => keys.map((key) => summaryByKey.get(key) ?? key).join(' → ');

  return (
    <div className="flex gap-4 p-4 pt-0 items-start">
      <div className="flex-1 min-w-0 border-t border-neutral-30">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] font-semibold text-neutral-500 uppercase">
              <th className="px-4 py-2 text-left font-semibold">Epic</th>
              <th className="px-4 py-2 text-right font-semibold">Days added</th>
              <th className="px-4 py-2 text-right font-semibold">How often on the critical path</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={selectedKey === row.key ? 'bg-blue-50' : undefined}>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    className="text-blue-600 text-left hover:underline"
                    onClick={() => onRowClick(row.key)}
                  >
                    {row.summary}
                  </button>
                  <span className="text-neutral-500"> · {row.teamName}</span>
                </td>
                <td className="px-4 py-2 text-right font-semibold">{row.daysAdded.toFixed(1)}</td>
                <td className="px-4 py-2 text-right">{Math.round(row.onPathIndex * 100)}%</td>
              </tr>
            ))}
          </tbody>
          {otherRows.length > 0 && (
            // Keeps the column honest: the listed values plus this one still add up to the footer.
            <tbody>
              <tr className="text-neutral-500">
                <td className="px-4 py-2">{otherRows.length} other epics</td>
                <td className="px-4 py-2 text-right">{otherRowDaysAdded.toFixed(1)}</td>
                <td />
              </tr>
            </tbody>
          )}
          <tfoot>
            <tr className="border-t border-neutral-30">
              <td className="px-4 py-2">Critical path length</td>
              <td className="px-4 py-2 text-right">{criticalPath.meanLength.toFixed(1)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="border border-neutral-30 rounded w-72 shrink-0">
        <div className="px-4 py-3 border-b border-neutral-30">
          <p className="font-bold text-base">Most common critical paths</p>
          <p className="text-xs text-neutral-500">Context only — the table on the left carries the ranking</p>
        </div>
        <div className="px-4 py-2 grid gap-2">
          {routes.map((path) => (
            <div key={path.keys.join('>')} className="text-xs">
              <span className="font-semibold mr-2">{percentOfRuns(path.count)}%</span>
              <span className="text-neutral-600">{routeLabel(path.keys)}</span>
            </div>
          ))}
          {otherRouteCount > 0 && (
            // Also the only cue that a click filtered the list, since non-matching routes vanish.
            <div className="text-xs text-neutral-500">
              <span className="font-semibold mr-2">{percentOfRuns(otherRouteRuns)}%</span>
              <span>
                {otherRouteCount} other route{otherRouteCount === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

Create `src/react/reports/AutoScheduler/CriticalPathEpicsReport/index.ts`:

```ts
export { CriticalPathEpicsReport } from './CriticalPathEpicsReport';
export { buildCriticalPathEpics, highlightKeysFor } from './build-critical-path-epics';
export type { CriticalPathEpicRow } from './build-critical-path-epics';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/react/reports/AutoScheduler/CriticalPathEpicsReport`
Expected: PASS — 19 tests across both files.

- [ ] **Step 5: Typecheck, format, commit**

```bash
npm run typecheck
npx prettier --write src/react/reports/AutoScheduler/CriticalPathEpicsReport/
git add src/react/reports/AutoScheduler/CriticalPathEpicsReport/
git commit -m "feat(auto-scheduler): add Epics on the critical path report"
```

---

### Task 6: Mount the report in the Auto-Scheduler

**Files:**

- Modify: `src/react/reports/AutoScheduler/AutoScheduler.tsx`

**Interfaces:**

- Consumes: `CriticalPathEpicsReport` (Task 5).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the import**

In `src/react/reports/AutoScheduler/AutoScheduler.tsx`, below the existing
`import { CriticalPathsReport } from './CriticalPathsReport';`:

```ts
import { CriticalPathEpicsReport } from './CriticalPathEpicsReport';
```

- [ ] **Step 2: Own the expand state and the tracking latch**

Beside the existing `workItemsToHighlight` state:

```tsx
// Collapsed by default. Expanding switches the simulation into critical-path mode, which needs a
// restart: the per-iteration sampled durations the longest-path pass reads are destroyed by
// `insertSortedArrayInPlace` in `onBatch`, so they cannot be recovered after a batch is merged.
const [criticalPathEpicsExpanded, setCriticalPathEpicsExpanded] = useState(false);
// Latched on purpose. Collapsing leaves tracking on, so the restart is paid at most once.
const [trackCriticalPath, setTrackCriticalPath] = useState(false);

const onCriticalPathEpicsExpandedChange = useCallback((expanded: boolean) => {
  setCriticalPathEpicsExpanded(expanded);
  if (expanded) setTrackCriticalPath(true);
}, []);
```

Add `trackCriticalPath` to the `StatsAnalyzer` construction and to the effect's dependency array:

```tsx
const analyzer = new StatsAnalyzer({
  issues: primary,
  uncertaintyWeight,
  setUIState: setUIData,
  trackCriticalPath,
});
// …
}, [primary, trackCriticalPath]);
```

> This is the only intended restart trigger being added. `uncertaintyWeight` must stay out of the
> dependency array, as it is today.

- [ ] **Step 3: Render it**

Immediately below the existing `<CriticalPathsReport ... />` element, as its sibling:

```tsx
{
  /* Epics on the critical path (spec/024-critical-path) */
}
<CriticalPathEpicsReport
  uiData={uiData}
  expanded={criticalPathEpicsExpanded}
  onExpandedChange={onCriticalPathEpicsExpandedChange}
  workItemsToHighlight={workItemsToHighlight}
  setWorkItemsToHighlight={setWorkItemsToHighlight}
/>;
```

> Written as two statements above only because a Markdown fence cannot carry the surrounding JSX. In
> the file this is one element inside the existing JSX tree, with the comment as `{/* … */}` on the
> line before it — no stray semicolons, no separate expression container.

`workItemsToHighlight` is passed in as well as out so the report can drop its own row selection when
another report takes over the grid — see Q5.

- [ ] **Step 4: Verify the full suite and types**

Run: `npm run typecheck` — expected: no output, exit 0.
Run: `npx vitest run src/react/reports/AutoScheduler`
Expected: PASS — every file.

- [ ] **Step 5: Verify by hand**

Run: `npm run dev`
Open the Auto-Scheduler report. Confirm:

1. A collapsed section titled "Epics on the critical path" sits directly below the existing
   "Critical Paths" report, and nothing under it is rendered.
2. Expanding it restarts the simulation — the progress bar goes back to 0% and "Calculating
   critical paths…" shows until the first batch lands.
3. Once populated, the "Days added" column is sorted descending and its values sum to the "Critical
   path length" in the footer.
4. Clicking an epic filters the Gantt above to that epic and everything sharing a critical path
   with it, and the routes card drops every route that does not contain it; clicking the same epic
   again restores both.
5. Collapsing the section does **not** restart the simulation, and re-expanding it is instant.
6. Moving the uncertainty slider does not restart the simulation (the progress bar should not
   reset), and the numbers stay stable.

- [ ] **Step 6: Format and commit**

```bash
npx prettier --write src/react/reports/AutoScheduler/AutoScheduler.tsx
git add src/react/reports/AutoScheduler/AutoScheduler.tsx
git commit -m "feat(auto-scheduler): mount the critical path epics report"
```

---

## Known gaps this plan does not close

- There are still no `DerivedIssue` fixtures, so `runMonteCarlo` is only tested against an empty
  issue set. The new logic is covered through the narrow structural interfaces instead. Building
  real fixtures is worth a separate task if the scheduler grows more integration-level behaviour.
- `runMonteCarlo`'s `probabilisticallySelectIssueTiming` option is accepted and passed to
  `linkIssues`, which ignores it — `resetLinkedIssue` always samples probabilistically. That dead
  flag is untouched here.
- The contention gap (plan finish minus critical path length) is not surfaced. It belongs on the
  capacity-aware report, per `spec/024-critical-path/mockups/earliest-finish.html` section 7.
- Expanding the section **restarts the simulation**, so every number on the page re-converges from a
  fresh sample and shifts slightly. Accepted for this initial effort; the alternative is paying for
  the longest-path pass on every run whether or not anyone looks at it.
- Collapsing the section does not turn tracking back off, so the cost stays paid for the rest of the
  session. That is deliberate — un-latching would make collapse-then-expand restart a second time.

---

## Questions

Raised by a spec review on 2026-08-12 and answered on 2026-08-16. Every question is resolved and
its answer is already applied to the tasks above; they are kept as a record of what was decided and
why. The one loose end is noted under Q6.

### Q1 — What should clicking a row actually do? (Tasks 4, 5, 6) — **RESOLVED**

`earliest-finish.html` section 6 says a click "highlights that epic in the grid above" and "dims
routes in the right-hand card that do not contain it".

**Answer: keep the union, and hide rather than dim.**

- The highlight set stays the **union of every epic on every route containing the clicked one**
  (`highlightKeysFor`), matching what `CriticalPathsReport` already does. Highlighting only the
  clicked epic would collapse the Gantt to a single bar, since `gridifyStatsUIData` filters rows out
  rather than tinting them — and the chain is the thing worth looking at.
- The routes card **hides** routes that do not contain the selected epic instead of dimming them.
  With a hundred epics on screen, a dimmed row is still noise; the point of the click is to isolate
  the blocking chain.

This overrides section 6's "dims" wording on both counts.

### Q2 — Should the highlight set be computed from the full path data rather than the capped list? (Tasks 3, 4) — **RESOLVED**

The original concern: `highlightKeysFor` received a `MAX_TRACKED_PATHS = 200` truncation of the
path list, so an epic showing a non-zero "how often on the critical path" — computed from **all**
iterations — could still highlight only itself. Combined with the Gantt's filtering behaviour, the
grid would collapse to one row and look broken.

The cap is gone. `dataForUI` now exposes `topPaths(limit)` as a thunk, so display asks for five and
`onRowClick` asks for `Number.POSITIVE_INFINITY`. Clicks are rare enough to afford the full sort.
Q1 kept the union highlight, so this fix is load-bearing rather than hypothetical.

### Q3 — How many epic rows should the table show? (Tasks 4, 5) — **RESOLVED**

Task 4 step 1 asserts epics with zero days added are kept and sorted last. The mockup shows eight
epics with one zero row styled as de-emphasised. A real plan feeding the Auto-Scheduler has far more
than eight, and most will be `0.0 / 0%`.

**Answer: top N plus a residual row**, with `EPIC_ROWS_SHOWN = 10`. `buildCriticalPathEpics` still
returns every epic — it stays a pure, fully tested transform — and Task 5 slices it, folding the
remainder into an "N other epics · X d" row so the column still visibly sums to the "Critical path
length" footer.

### Q4 — Should the routes card show issue keys or summaries? (Task 5) — **RESOLVED**

**Answer: summaries, and yes to the residual row.** The component builds a key → summary map from
`uiData.simulationIssueResults`, falling back to the raw key when an epic is missing from it.

The "N other routes" row matters more than it did in the mockup, because Q1 makes a click **hide**
non-matching routes — without the residual there is no cue that the list was filtered at all.

### Q5 — Should selection be derived from `workItemsToHighlight` instead of local state? (Task 5) — **RESOLVED**

`CriticalPathsReport` deliberately derives its expanded state from the shared `workItemsToHighlight`
prop so the components writing to that state stay consistent. The plan originally kept a private
`selectedKey` and did not accept the prop, so clicking a chain in `CriticalPathsReport` or a bar in
`CriticalPath` would leave this report showing a stale highlighted row — and, after Q1, a stale
filtered routes card.

**Answer: derive, cheaply.** The report accepts `workItemsToHighlight`, keeps `selectedKey` local,
and clears it in an effect whenever the prop changes to a set it did not write (tracked in a ref).
Fully deriving — recomputing which row matches the current set — would need a full path sort on
every render.

### Q6 — Should the computation run in `runBatch`'s loop or in `StatsAnalyzer.onBatch`? (Task 3) — **PARTLY RESOLVED**

The plan's original rationale for the hot loop — that it "must not depend on anything the scheduler
decides" — did not hold, and has been rewritten. The hot loop is kept, but for the real reason:
`onBatch` runs `insertSortedArrayInPlace` on each epic's `daysOfWork` independently, which destroys
the per-iteration alignment the longest-path pass needs. `dependency-floor.md` section 3 recommends
`onBatch` on the basis that alignment survives within a batch — true only **before** that sort, so
the recommendation would require reordering `onBatch` as well.

The cost objection is answered separately: the pass is now gated behind `trackCriticalPath` and only
turns on when the report is expanded.

Still open: whether to instead restructure `onBatch` so the DP can live there, which would remove
the restart-on-expand entirely. Out of scope for this initial effort.

### Q7 — Should `criticalPathIndex` be renamed? (Task 3) — **RESOLVED**

`dataForUI` would have returned both `criticalityIndex` (capacity-aware, from
`CriticalityAccumulator`) and `criticalPathIndex` (capacity-blind, new) on the same object. They
differ by one character and mean genuinely different things.

**Answer: renamed** to `sequencingCriticalityIndex` and `sequencingDaysAdded`, following
`dependency-floor.md` section 2's "sequencing criticality index". `CriticalPathEpicRow` keeps the
shorter `daysAdded` / `onPathIndex`, which are unambiguous inside the report.

### Q8 — Should `topPaths` return copies, and should the path map be bounded? (Task 2) — **RESOLVED**

1. **Fixed.** `topPaths` returned the live `PathFrequency` objects out of `pathCounts`, and both
   `addIteration` and `merge` mutate them in place (`existing.count++`), so every `StatsUIData`
   already handed to React mutated underneath its consumer. It now returns
   `{ keys: [...], count }` copies.
2. **Fixed.** `dataForUI` no longer sorts anything: `topPaths` is exposed as a thunk and only runs
   when something renders or a row is clicked. `pathCounts` is still unbounded in memory — section 4
   of `dependency-floor.md` notes five binary forks alone produce 32 routes, and a wide plan can
   produce thousands — but nothing walks it per batch any more. Cap at accumulation time if the map
   itself turns out to be the problem.

### Q9 — Should the A/B fixture test be added? (Task 1) — **RESOLVED**

`dependency-floor.md` section 6 lists thirteen tests; this plan implemented four. The significant
omission was the README A/B fixture:

```
Path A:  10 → [9, 9, 9 in parallel] → 10
Path B:  10 → 10 → 10
```

Deterministically B wins (30 vs 29); with sampled durations A wins often enough to matter. That is
the **entire justification** for recomputing per iteration rather than once, and nothing asserted it
— someone could have hoisted the DP out of the loop with every test still green.

**Answer: added** to Task 1, using a seeded LCG over `PathIssue` graphs so it needs no `DerivedIssue`
fixtures and cannot flake. Task 1 goes from 7 tests to 9 (the other is the `emptyPath` regression).

### Q10 — Does `dependency-floor.md` need a correction note? — **RESOLVED**

Two of its statements are superseded by `mockups/earliest-finish.html` section 7, and this plan
correctly follows the mockup:

| `dependency-floor.md`                                | `earliest-finish.html` §7 (later)          |
| ---------------------------------------------------- | ------------------------------------------ |
| §2: report the floor at the selected percentile      | "Averages throughout, not percentiles"     |
| §1, §4: the contention gap is this report's headline | The gap moves to the capacity-aware report |

**Answer: annotated the source**, not just the plan — the stale statements would otherwise mislead
anyone reading `dependency-floor.md` directly. It now carries a "Partly superseded" banner at the
top plus inline notes at both places.

### Q11 — Minor items — **RESOLVED**

- ~~**Task 6, Step 2** — the JSX snippet is prettier-mangled into a standalone statement.~~ Fixed:
  the snippet now carries a note that it is one element inside the existing tree.
- ~~**Task 6, Step 4, item 2** — "check with a calculator" is not a workable manual check.~~ Fixed:
  replaced with "sorted descending and sums to the footer".
- ~~**Task 3** — `linkedIssues as unknown as PathIssue[]` is not needed.~~ Dropped: `LinkedIssue`
  satisfies `PathIssue` structurally, and if that ever stops being true it should be a compile
  error rather than something a double cast hides.
- ~~**Task 3** — `topPaths(MAX_TRACKED_PATHS) as PathFrequency[]` is a redundant cast.~~ Both the
  cast and the `PathFrequency` import are gone with the thunk.
- ~~**Task 1** — `EMPTY_PATH` is a shared module-level object returned to callers.~~ Replaced with
  an `emptyPath()` factory, plus a regression test.
- **Task 5** — the mockup's rank column (1–8) and its de-emphasised styling for zero rows are
  dropped. **Confirmed as intentional**: the table is now truncated to ten rows plus a residual
  (Q3), so a rank column adds little.
- ~~**`earliest-finish.html` §8** asks whether this lives in a "Critical paths" dropdown or as a
  permanent card.~~ A collapsed expand/collapse section directly below the existing capacity-aware
  report, computed on first expand.

### Q12 — Route shares were being divided by the wrong denominator (Task 5)

Raised while wiring up the expand gating, and fixed in place rather than left open. The original
Task 5 divided each route's count by the sum of the counts **shown**, so a route winning 41 of
10,000 runs displayed as 69% purely because it topped a five-row list. The denominator is now
`criticalPath.iterations`, which matches `earliest-finish.html` section 3 where the shares
(41/26/18/9/6) add up to 100 across every run.

Flagging it only in case the mockup's percentages were meant as shares of the shown routes after
all — they are not, on the evidence, but the mockup does not say so outright.

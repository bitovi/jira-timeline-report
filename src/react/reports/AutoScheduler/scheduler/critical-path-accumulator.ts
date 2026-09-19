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

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

  it('hands out copies, so a rendered StatsUIData cannot mutate underneath React', () => {
    const accumulator = new CriticalPathAccumulator();
    fourIterations.forEach((p) => accumulator.addIteration(p));

    const before = accumulator.topPaths(1)[0];
    accumulator.addIteration(path(['S', 'M1', 'E'], [10, 22, 10]));

    expect(before.count).toBe(2);
    expect(accumulator.topPaths(1)[0].count).toBe(3);
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

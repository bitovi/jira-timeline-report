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

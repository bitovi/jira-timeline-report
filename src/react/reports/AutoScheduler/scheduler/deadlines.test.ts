import { describe, it, expect } from 'vitest';

import { computeDeadlines, type DeadlineIssue } from './deadlines';

function node(key: string, daysOfWork: number, frozenStartDay?: number): DeadlineIssue {
  return {
    key,
    frozen: frozenStartDay === undefined ? null : {},
    linkedBlocks: [],
    mutableWorkItem: { daysOfWork, frozenStartDay },
  };
}

function blocks(blocker: DeadlineIssue, ...blocked: DeadlineIssue[]) {
  blocker.linkedBlocks.push(...blocked);
}

describe('computeDeadlines', () => {
  it('walks a single chain back from a frozen item', () => {
    const a = node('A', 3);
    const b = node('B', 4);
    const frozen = node('F', 5, 20);
    blocks(a, b);
    blocks(b, frozen);

    computeDeadlines([a, b, frozen]);

    expect(frozen.mutableWorkItem.latestFinish).toBe(20);
    expect(frozen.mutableWorkItem.mustStartBy).toBeUndefined();
    expect(b.mutableWorkItem).toMatchObject({ latestFinish: 20, mustStartBy: 16 });
    expect(a.mutableWorkItem).toMatchObject({ latestFinish: 16, mustStartBy: 13 });
  });

  it('gives every blocker in a fan-in the frozen start as its deadline', () => {
    const a = node('A', 3);
    const b = node('B', 8);
    const frozen = node('F', 5, 10);
    blocks(a, frozen);
    blocks(b, frozen);

    computeDeadlines([a, b, frozen]);

    expect(a.mutableWorkItem).toMatchObject({ latestFinish: 10, mustStartBy: 7 });
    expect(b.mutableWorkItem).toMatchObject({ latestFinish: 10, mustStartBy: 2 });
  });

  it('takes the earliest of two frozen successors', () => {
    const a = node('A', 2);
    const early = node('E', 5, 6);
    const late = node('L', 5, 30);
    blocks(a, late, early);

    computeDeadlines([a, early, late]);

    expect(a.mutableWorkItem.latestFinish).toBe(6);
  });

  it('leaves work with nothing frozen downstream unconstrained', () => {
    const a = node('A', 2);
    const b = node('B', 2);
    blocks(a, b);

    computeDeadlines([a, b]);

    expect(a.mutableWorkItem.latestFinish).toBe(Number.POSITIVE_INFINITY);
    expect(a.mutableWorkItem.mustStartBy).toBeUndefined();
  });

  it('reports a mustStartBy before day 0 when the frozen item starts too soon', () => {
    const a = node('A', 10);
    const frozen = node('F', 5, 4);
    blocks(a, frozen);

    computeDeadlines([a, frozen]);

    expect(a.mutableWorkItem.mustStartBy).toBe(-6);
  });
});

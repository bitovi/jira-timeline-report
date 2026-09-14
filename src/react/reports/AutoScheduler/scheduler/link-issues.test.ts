import { describe, it, expect } from 'vitest';

import type { DerivedIssue } from '../../../../jira/derived/derive';
import { linkIssues, BlocksCycleError } from './link-issues';

function makeTeam(name: string) {
  return { name, parallelWorkLimit: 1, velocity: 1, pointsPerDayPerTrack: 1 } as DerivedIssue['team'];
}

function makeDerivedIssue(overrides: Partial<DerivedIssue> & { key: string }): DerivedIssue {
  return {
    key: overrides.key,
    summary: `Summary of ${overrides.key}`,
    url: `#${overrides.key}`,
    parentKey: null,
    team: makeTeam('team-a'),
    derivedTiming: {
      deterministicTotalDaysOfWork: 5,
      probablisticTotalDaysOfWork: 5,
    },
    issue: { fields: { 'Linked Issues': [] } },
    type: 'Epic',
    ...overrides,
  } as unknown as DerivedIssue;
}

function blocks(key: string) {
  return { type: { name: 'Blocks' }, outwardIssue: { key } };
}

describe('linkIssues', () => {
  it('throws a BlocksCycleError naming the chain instead of recursing forever on a Blocks cycle', () => {
    // Data error: A blocks B blocks A. Jira allows this even though it is contradictory.
    const a = makeDerivedIssue({
      key: 'A',
      issue: { fields: { 'Linked Issues': [blocks('B')] } },
    } as Partial<DerivedIssue> & { key: string });
    const b = makeDerivedIssue({
      key: 'B',
      issue: { fields: { 'Linked Issues': [blocks('A')] } },
    } as Partial<DerivedIssue> & { key: string });

    let error: unknown;
    try {
      linkIssues([a, b], false);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(BlocksCycleError);
    expect((error as BlocksCycleError).cycle.map((issue) => issue.key)).toEqual(['A', 'B', 'A']);
  });

  it('still computes the correct depth for a non-cyclic chain', () => {
    // B blocks A: A's depth is its own days plus B's.
    const a = makeDerivedIssue({
      key: 'A',
      issue: { fields: { 'Linked Issues': [blocks('B')] } },
    } as Partial<DerivedIssue> & { key: string });
    const b = makeDerivedIssue({ key: 'B' });

    const linked = linkIssues([a, b], false);

    expect(linked.find((issue) => issue.key === 'A')!.blocksWorkDepth).toBe(10);
    expect(linked.find((issue) => issue.key === 'B')!.blocksWorkDepth).toBe(5);
  });
});

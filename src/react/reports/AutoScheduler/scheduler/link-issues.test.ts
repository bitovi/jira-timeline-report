import { describe, it, expect } from 'vitest';

import type { DerivedIssue } from '../../../../jira/derived/derive';
import { linkIssues, BlocksCycleError, resetLinkedIssue } from './link-issues';

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

describe('linkIssues frozen offsets', () => {
  // Monday. Jira dates are local midnights, as `normalizeIssue` parses them.
  const startDate = new Date(Date.UTC(2026, 0, 5));
  const withDates = (key: string, start?: Date, due?: Date) =>
    makeDerivedIssue({
      key,
      derivedTiming: { deterministicTotalDaysOfWork: 5, probablisticTotalDaysOfWork: 5, start, due },
    } as Partial<DerivedIssue> & { key: string });
  const frozenOf = (issue: DerivedIssue) =>
    linkIssues([issue], false, { frozenKeys: new Set([issue.key]), startDate })[0].frozen;

  it('computes both offsets when Jira has a start and a due date', () => {
    // Mon 12th → 5; due Fri 23rd (inclusive) → 15, exclusive.
    expect(frozenOf(withDates('A', new Date(2026, 0, 12), new Date(2026, 0, 23)))).toEqual({ startDay: 5, dueDay: 15 });
  });

  it('computes only the due offset when there is no start', () => {
    expect(frozenOf(withDates('A', undefined, new Date(2026, 0, 9)))).toEqual({ startDay: null, dueDay: 5 });
  });

  it('computes only the start offset when there is no due', () => {
    expect(frozenOf(withDates('A', new Date(2026, 0, 7)))).toEqual({ startDay: 2, dueDay: null });
  });

  it('moves a weekend start to the following Monday', () => {
    expect(frozenOf(withDates('A', new Date(2026, 0, 10), new Date(2026, 0, 16)))).toEqual({ startDay: 5, dueDay: 10 });
  });

  it('ignores a frozen key with no Jira dates, and keys that are not frozen', () => {
    expect(frozenOf(withDates('A'))).toBeNull();
    const linked = linkIssues([withDates('B', new Date(2026, 0, 12))], false, { frozenKeys: new Set(), startDate });
    expect(linked[0].frozen).toBeNull();
  });

  it('sizes an item frozen with both dates by its whole span, without sampling', () => {
    const issue = linkIssues([withDates('A', new Date(2025, 11, 29), new Date(2026, 0, 16))], false, {
      frozenKeys: new Set(['A']),
      startDate,
    })[0];
    resetLinkedIssue(issue);

    expect(issue.mutableWorkItem).toMatchObject({ frozenStartDay: -5, frozenDueDay: 10, daysOfWork: 15 });
  });
});

describe('linkIssues schedule directions', () => {
  const startDate = new Date(Date.UTC(2026, 0, 5));
  const dated = { start: new Date(2026, 0, 12), due: new Date(2026, 0, 16) };
  const issue = (key: string, blocksKeys: string[] = [], frozenDates = false) =>
    makeDerivedIssue({
      key,
      issue: { fields: { 'Linked Issues': blocksKeys.map(blocks) } },
      derivedTiming: {
        deterministicTotalDaysOfWork: 5,
        probablisticTotalDaysOfWork: 5,
        ...(frozenDates ? dated : {}),
      },
    } as Partial<DerivedIssue> & { key: string });
  const directions = (issues: DerivedIssue[], frozen: string[]) =>
    Object.fromEntries(
      linkIssues(issues, false, { frozenKeys: new Set(frozen), startDate }).map((linked) => [
        linked.key,
        linked.scheduleDirection,
      ]),
    );

  it('is forward for everything when nothing is frozen', () => {
    expect(directions([issue('A', ['B']), issue('B')], [])).toEqual({ A: 'forward', B: 'forward' });
  });

  it('schedules a chain and a fan-in into a frozen item backward, and what follows it forward', () => {
    expect(
      directions([issue('A', ['B']), issue('B', ['F']), issue('C', ['F']), issue('F', ['D'], true), issue('D')], ['F']),
    ).toEqual({ A: 'backward', B: 'backward', C: 'backward', F: 'frozen', D: 'forward' });
  });

  it('schedules work between two frozen items forward', () => {
    expect(directions([issue('A', ['B'], true), issue('B', ['C']), issue('C', [], true)], ['A', 'C'])).toEqual({
      A: 'frozen',
      B: 'forward',
      C: 'frozen',
    });
  });

  it('keeps work forward when its only route to a frozen item runs through forward work', () => {
    // X → Y → F, with Y after frozen G: Y is forward, so X can't be placed backward from F.
    expect(
      directions([issue('X', ['Y']), issue('G', ['Y'], true), issue('Y', ['F']), issue('F', [], true)], ['G', 'F']),
    ).toMatchObject({ X: 'forward', Y: 'forward' });
  });
});

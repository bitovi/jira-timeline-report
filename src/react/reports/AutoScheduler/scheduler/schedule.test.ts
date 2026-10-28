import { describe, it, expect } from 'vitest';

import type { DerivedIssue } from '../../../../jira/derived/derive';
import { linkIssues, resetLinkedIssue, type LinkedIssue } from './link-issues';
import { scheduleIssues } from './schedule';
import { isLateForFrozen } from './monte-carlo';

// Monday 2026-01-05. Jira dates are local midnights, as `normalizeIssue` parses them.
const PLAN_START = new Date(Date.UTC(2026, 0, 5));
const day = (offset: number) => {
  const date = new Date(2026, 0, 5);
  date.setDate(date.getDate() + Math.floor(offset / 5) * 7 + (offset % 5));
  return date;
};
/** The last (inclusive) Jira due date for an exclusive business-day offset. */
const dueOn = (exclusiveOffset: number) => {
  const date = day(exclusiveOffset);
  date.setDate(date.getDate() - (date.getDay() === 1 ? 3 : 1));
  return date;
};

type Spec = {
  key: string;
  days?: number;
  team?: string;
  tracks?: number;
  blocks?: string[];
  start?: Date;
  due?: Date;
};

function makeIssues(specs: Spec[]): DerivedIssue[] {
  return specs.map(({ key, days = 5, team = 'a', tracks = 1, blocks = [], start, due }) => {
    return {
      key,
      summary: key,
      parentKey: null,
      type: 'Epic',
      team: { name: team, parallelWorkLimit: tracks, velocity: 1, pointsPerDayPerTrack: 1 },
      derivedTiming: { deterministicTotalDaysOfWork: days, probablisticTotalDaysOfWork: days, start, due },
      issue: {
        fields: {
          'Linked Issues': blocks.map((blocked) => ({ type: { name: 'Blocks' }, outwardIssue: { key: blocked } })),
        },
      },
    } as unknown as DerivedIssue;
  });
}

/** Deterministic run: unfrozen items get their spec's days; frozen ones go through `resetLinkedIssue`. */
function schedule(specs: Spec[], frozen: string[] = []) {
  const linked = linkIssues(makeIssues(specs), false, { frozenKeys: new Set(frozen), startDate: PLAN_START });
  for (const issue of linked) {
    if (issue.frozen) {
      resetLinkedIssue(issue);
    } else {
      issue.mutableWorkItem.startDay = null;
      issue.mutableWorkItem.artificiallyDelayed = undefined;
      issue.mutableWorkItem.daysOfWork = specs.find((spec) => spec.key === issue.key)!.days ?? 5;
    }
  }
  const teamWork = scheduleIssues(linked);
  Object.values(teamWork).forEach((team) =>
    team.workPlans.plans.forEach((plan, index) => {
      for (const node of plan) node.work.track = index;
    }),
  );
  const byKey = Object.fromEntries(linked.map((issue) => [issue.key, issue])) as Record<string, LinkedIssue>;
  const at = (key: string) => {
    const work = byKey[key].mutableWorkItem;
    return { start: work.startDay, end: (work.startDay as number) + work.daysOfWork, track: work.track };
  };
  return { byKey, at };
}

describe('scheduleIssues', () => {
  it('schedules exactly as before when nothing is frozen', () => {
    // A blocks B; C and D compete with them for two tracks. Values are what the scheduler produced
    // before frozen items existed, pinned so the no-frozen path can't drift.
    const { at } = schedule([
      { key: 'A', days: 4, tracks: 2, blocks: ['B'] },
      { key: 'B', days: 6, tracks: 2 },
      { key: 'C', days: 8, tracks: 2 },
      { key: 'D', days: 3, tracks: 2 },
    ]);

    expect(at('A')).toEqual({ start: 0, end: 4, track: 0 });
    expect(at('B')).toEqual({ start: 4, end: 10, track: 1 });
    expect(at('C')).toEqual({ start: 4, end: 12, track: 0 });
    expect(at('D')).toEqual({ start: 0, end: 3, track: 1 });
  });

  it('places a blocker of a frozen item just before it, as late as possible', () => {
    // X must finish by day 5 for frozen F (another team). Y has nothing frozen downstream.
    const { at, byKey } = schedule(
      [
        { key: 'X', days: 3, blocks: ['F'] },
        { key: 'Y', days: 10 },
        { key: 'F', days: 1, team: 'b', start: day(5), due: dueOn(8) },
      ],
      ['F'],
    );

    expect(byKey.X.scheduleDirection).toBe('backward');
    expect(at('X')).toMatchObject({ start: 2, end: 5 });
    expect(at('Y')).toMatchObject({ start: 5 });
    expect(isLateForFrozen(byKey.X)).toBe(false);
  });

  it('starts a blocker before the start date when it does not fit in front of its frozen item', () => {
    // The spec/044 report: frozen at days 6–12, an 8-day blocker on the same one-track team.
    const { at, byKey } = schedule(
      [
        { key: 'BLOCKER', days: 8, blocks: ['F'] },
        { key: 'F', start: day(6), due: dueOn(12) },
      ],
      ['F'],
    );

    expect(at('BLOCKER')).toMatchObject({ start: -2, end: 6 });
    expect(at('F')).toMatchObject({ start: 6, end: 12 });
    expect(isLateForFrozen(byKey.BLOCKER)).toBe(false);
  });

  it('stacks a chain of blockers backward from the frozen item', () => {
    const { at } = schedule(
      [
        { key: 'A', days: 4, blocks: ['B'] },
        { key: 'B', days: 3, team: 'b', blocks: ['F'] },
        { key: 'F', team: 'c', start: day(5), due: dueOn(10) },
      ],
      ['F'],
    );

    expect(at('B')).toMatchObject({ start: 2, end: 5 });
    expect(at('A')).toMatchObject({ start: -2, end: 2 });
  });

  it('keeps two backward items on a one-track team from overlapping', () => {
    const { at } = schedule(
      [
        { key: 'A', days: 4, blocks: ['F'] },
        { key: 'B', days: 3, blocks: ['F'] },
        { key: 'F', team: 'b', start: day(10), due: dueOn(15) },
      ],
      ['F'],
    );

    const spans = [at('A'), at('B')].sort((x, y) => (x.start as number) - (y.start as number));
    expect(spans[1].start).toBeGreaterThanOrEqual(spans[0].end);
    expect(spans[1].end).toBe(10);
    expect(spans[0].start).toBe(3);
  });

  it('runs work between two frozen items late from the first, over capacity rather than queued behind the second', () => {
    // A → B → C with A and C frozen and only 2 days between them for a 5-day B. C holds the only
    // track, so B starts when A ends on an over-capacity track and overruns C's start by 3 days.
    const { at, byKey } = schedule(
      [
        { key: 'A', team: 'a', start: day(0), due: dueOn(5), blocks: ['B'] },
        { key: 'B', days: 5, team: 'b', blocks: ['C'] },
        { key: 'C', team: 'b', start: day(7), due: dueOn(12) },
      ],
      ['A', 'C'],
    );

    expect(byKey.B.scheduleDirection).toBe('forward');
    expect(at('B')).toMatchObject({ start: 5, end: 10, track: 1 });
    expect(at('C')).toMatchObject({ start: 7, end: 12, track: 0 });
    expect(isLateForFrozen(byKey.B)).toBe(true);
  });

  it('starts a frozen item’s dependent once the frozen item is due', () => {
    const { at } = schedule(
      [
        { key: 'F', start: day(0), due: dueOn(5), blocks: ['U'] },
        { key: 'U', days: 3, team: 'b' },
      ],
      ['F'],
    );

    expect(at('F')).toMatchObject({ start: 0, end: 5 });
    expect(at('U')).toMatchObject({ start: 5, end: 8 });
  });

  it('leaves two contradictory frozen items where they are and flags the blocker late', () => {
    const { at, byKey } = schedule(
      [
        { key: 'A', start: day(0), due: dueOn(10), blocks: ['B'] },
        { key: 'B', team: 'b', start: day(5), due: dueOn(10) },
      ],
      ['A', 'B'],
    );

    expect(at('A')).toMatchObject({ start: 0, end: 10 });
    expect(at('B')).toMatchObject({ start: 5, end: 10 });
    expect(isLateForFrozen(byKey.A)).toBe(true);
  });

  it('takes the whole track for a frozen item, whatever its estimate', () => {
    const { at } = schedule(
      [
        { key: 'F', days: 1, start: day(0), due: dueOn(10) },
        { key: 'U', days: 2 },
      ],
      ['F'],
    );

    expect(at('F')).toMatchObject({ start: 0, end: 10 });
    expect(at('U')).toMatchObject({ start: 10 });
  });

  it('holds a frozen item that started before the start date at its real dates', () => {
    const { at } = schedule(
      [
        { key: 'F', start: day(-5), due: dueOn(5) },
        { key: 'U', days: 3 },
      ],
      ['F'],
    );

    expect(at('F')).toMatchObject({ start: -5, end: 5 });
    expect(at('U')).toMatchObject({ start: 5 });
  });

  it('holds capacity before the start date for a frozen item, so backward work goes around it', () => {
    // "Payments" -5..5 holds the only track; "Build" must finish before "Launch" at day 8, so it
    // has to go before Payments entirely.
    const { at } = schedule(
      [
        { key: 'PAYMENTS', start: day(-5), due: dueOn(5) },
        { key: 'BUILD', days: 10, blocks: ['LAUNCH'] },
        { key: 'LAUNCH', start: day(8), due: dueOn(10) },
      ],
      ['PAYMENTS', 'LAUNCH'],
    );

    expect(at('BUILD')).toMatchObject({ start: -15, end: -5 });
  });

  it('lets work after a frozen item that ended before the start date begin at day 0', () => {
    const { at } = schedule(
      [
        { key: 'F', start: day(-10), due: dueOn(-5), blocks: ['D'] },
        { key: 'D', days: 3 },
        { key: 'U', days: 2 },
      ],
      ['F'],
    );

    expect(at('F')).toMatchObject({ start: -10, end: -5 });
    expect([at('D').start, at('U').start].sort()).toEqual([0, 3]);
  });

  it('puts frozen items that overlap past capacity on an overflow track, and no unfrozen work there', () => {
    const { at, byKey } = schedule(
      [
        { key: 'F1', start: day(0), due: dueOn(10) },
        { key: 'F2', start: day(5), due: dueOn(10) },
        { key: 'U', days: 2 },
      ],
      ['F1', 'F2'],
    );

    expect(at('F1').track).toBe(0);
    expect(at('F2').track).toBe(1);
    expect(at('U')).toMatchObject({ track: 0, start: 10 });
    expect(byKey.F2.team.parallelWorkLimit).toBe(1);
  });
});

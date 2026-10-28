import { describe, it, expect } from 'vitest';
import type { DerivedIssue } from '../../../../jira/derived/derive';
import { linkIssues } from './link-issues';
import { calibratePlan, runPlan } from './plan';

const startDate = new Date(Date.UTC(2026, 0, 5)); // Monday

const team = (name = 'team-a', parallelWorkLimit = 1) =>
  ({ name, parallelWorkLimit, velocity: 1, pointsPerDayPerTrack: 1 }) as DerivedIssue['team'];

function epic(key: string, { blocks, ...overrides }: { blocks?: string } & Record<string, unknown> = {}) {
  return {
    key,
    parentKey: null,
    team: team(),
    storyPointsMedian: 10,
    confidence: 50,
    derivedTiming: { deterministicTotalDaysOfWork: 10, probablisticTotalDaysOfWork: 10 },
    issue: {
      fields: { 'Linked Issues': blocks ? [{ type: { name: 'Blocks' }, outwardIssue: { key: blocks } }] : [] },
    },
    type: 'Epic',
    ...overrides,
  } as unknown as DerivedIssue;
}

const frozen = (key: string, start: Date, due: Date, overrides: Record<string, unknown> = {}) =>
  epic(key, {
    derivedTiming: { deterministicTotalDaysOfWork: 5, probablisticTotalDaysOfWork: 5, start, due },
    ...overrides,
  });

describe('runPlan', () => {
  it('stretches every length to the same percentile and stacks them on the track', () => {
    const issues = linkIssues([epic('A'), epic('B')], false);

    const median = runPlan(issues, 50);
    const high = runPlan(issues, 90);

    // At the median a lognormal's length is its median estimate: 10 days each, back to back.
    expect([...median.items.values()].map(({ startDay, dueDay }) => [startDay, dueDay]).sort()).toEqual([
      [0, 10],
      [10, 20],
    ]);
    expect(median.finish).toBe(20);
    expect(high.finish).toBeGreaterThan(20);
  });

  it('is deterministic', () => {
    const issues = linkIssues([epic('A', { blocks: 'B' }), epic('B'), epic('C', { team: team('team-b') })], false);

    expect(runPlan(issues, 73)).toEqual(runPlan(issues, 73));
  });
});

describe('calibratePlan', () => {
  const none = new Map<string, number>();

  it('ends the typical item on its own finish: half on or before, half after', () => {
    // Three 10-day (median) epics in a chain whose own finishes, like a simulation's, grow by less
    // than a full high-percentile length each: 15, 27, 38.
    const issues = linkIssues([epic('A', { blocks: 'B' }), epic('B', { blocks: 'C' }), epic('C')], false);
    const ownDue = new Map([
      ['A', 15],
      ['B', 27],
      ['C', 38],
    ]);

    const plan = calibratePlan(issues, { ownDue, start: 0, fallbackQuantile: 80 });

    // B is the median item: it lands on its own finish. With equal lengths, the first ends before its
    // own finish and the last after.
    expect(Math.abs(plan.items.get('B')!.dueDay - 27)).toBeLessThanOrEqual(0.5);
    expect(plan.items.get('A')!.dueDay).toBeLessThan(15);
    expect(plan.items.get('C')!.dueDay).toBeGreaterThan(38);
    expect(plan.quantile).toBeGreaterThan(50);
  });

  it('is not dragged by one item far off its own finish', () => {
    const issues = linkIssues(
      [epic('A'), epic('B', { team: team('team-b') }), epic('C', { team: team('team-c') })],
      false,
    );
    // All three are identical, parallel 10-day epics; C's target is an outlier.
    const plan = calibratePlan(issues, {
      ownDue: new Map([
        ['A', 12],
        ['B', 12],
        ['C', 90],
      ]),
      start: 0,
      fallbackQuantile: 80,
    });

    expect(Math.abs(plan.items.get('A')!.dueDay - 12)).toBeLessThanOrEqual(0.5);
  });

  it('calibrates on the start when only frozen items and the work feeding them are left', () => {
    // U must finish before frozen F (days 2–4), so the plan's start moves earlier as U grows.
    const issues = linkIssues(
      [
        epic('U', { blocks: 'F', confidence: 30 }),
        frozen('F', new Date(2026, 0, 7), new Date(2026, 0, 8), { team: team('team-b') }),
      ],
      false,
      { frozenKeys: new Set(['F']), startDate },
    );

    const plan = calibratePlan(issues, { ownDue: none, start: -12, fallbackQuantile: 80 });

    expect(Math.abs(plan.start - -12)).toBeLessThanOrEqual(0.5);
    expect(plan.finish).toBe(4);
  });

  it('falls back to the slider when nothing responds to the percentile', () => {
    const issues = linkIssues([frozen('F', new Date(2026, 0, 5), new Date(2026, 0, 9))], false, {
      frozenKeys: new Set(['F']),
      startDate,
    });

    expect(calibratePlan(issues, { ownDue: none, start: 0, fallbackQuantile: 80 }).quantile).toBe(80);
  });

  it('settles for the nearest end of the range when the target is out of reach', () => {
    const issues = linkIssues([epic('A')], false);
    const target = (due: number) => ({ ownDue: new Map([['A', due]]), start: 0, fallbackQuantile: 80 });

    expect(calibratePlan(issues, target(1)).quantile).toBe(1);
    expect(calibratePlan(issues, target(10_000)).quantile).toBe(99);
  });
});

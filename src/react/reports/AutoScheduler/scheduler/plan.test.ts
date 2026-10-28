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
  it('finds the percentile whose plan finishes on the target', () => {
    const issues = linkIssues([epic('A', { blocks: 'B' }), epic('B', { blocks: 'C' }), epic('C')], false);

    const plan = calibratePlan(issues, { finish: 40, start: 0, fallbackQuantile: 80 });

    expect(Math.abs(plan.finish - 40)).toBeLessThanOrEqual(0.5);
    expect(plan.quantile).toBeGreaterThan(50);
  });

  it('calibrates on the start when a frozen item pins the finish', () => {
    // U must finish before frozen F (days 2–4), so the plan's start moves earlier as U grows.
    const issues = linkIssues(
      [
        epic('U', { blocks: 'F', confidence: 30 }),
        frozen('F', new Date(2026, 0, 7), new Date(2026, 0, 8), { team: team('team-b') }),
      ],
      false,
      { frozenKeys: new Set(['F']), startDate },
    );

    const plan = calibratePlan(issues, { finish: 999, start: -12, fallbackQuantile: 80 });

    expect(Math.abs(plan.start - -12)).toBeLessThanOrEqual(0.5);
    expect(plan.finish).toBe(4);
  });

  it('falls back to the slider when nothing responds to the percentile', () => {
    const issues = linkIssues([frozen('F', new Date(2026, 0, 5), new Date(2026, 0, 9))], false, {
      frozenKeys: new Set(['F']),
      startDate,
    });

    expect(calibratePlan(issues, { finish: 30, start: 0, fallbackQuantile: 80 }).quantile).toBe(80);
  });

  it('settles for the nearest end of the range when the target is out of reach', () => {
    const issues = linkIssues([epic('A')], false);

    expect(calibratePlan(issues, { finish: 1, start: 0, fallbackQuantile: 80 }).quantile).toBe(1);
    expect(calibratePlan(issues, { finish: 10_000, start: 0, fallbackQuantile: 80 }).quantile).toBe(99);
  });
});

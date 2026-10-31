import { describe, expect, test } from 'vitest';

import { computePlanningHealth } from './planningHealth';

type Fixture = Parameters<typeof computePlanningHealth>[0][number];

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

/** An issue with no estimate, no confidence and no due date unless given. */
function issue(key: string, parentKey: string | null, extra: Partial<Fixture> = {}): Fixture {
  return { key, parentKey, dueDate: null, storyPoints: null, storyPointsMedian: null, confidence: null, ...extra };
}

const estimated = { storyPoints: 5, confidence: 80 };

describe('computePlanningHealth — rolled-up due date', () => {
  test('is the latest due date among the children', () => {
    const health = computePlanningHealth([
      issue('INIT-1', null, { dueDate: day(2026, 11, 1) }),
      issue('EPIC-1', 'INIT-1', { dueDate: day(2026, 12, 1) }),
      issue('EPIC-2', 'INIT-1', { dueDate: day(2027, 6, 1) }),
      issue('EPIC-3', 'INIT-1'),
    ]);
    expect(health.get('INIT-1')?.rolledUpDue).toEqual(day(2027, 6, 1));
  });

  test("falls back to the issue's own due date when no child has one", () => {
    const health = computePlanningHealth([
      issue('INIT-1', null, { dueDate: day(2026, 11, 1) }),
      issue('EPIC-1', 'INIT-1'),
      issue('INIT-2', null, { dueDate: day(2026, 12, 15) }),
    ]);
    expect(health.get('INIT-1')?.rolledUpDue).toEqual(day(2026, 11, 1));
    expect(health.get('INIT-2')?.rolledUpDue).toEqual(day(2026, 12, 15));
    expect(health.get('EPIC-1')?.rolledUpDue).toBeNull();
  });

  test('recurses: outcome → initiative → epic', () => {
    const health = computePlanningHealth([
      issue('OUT-1', null, { dueDate: day(2026, 11, 1) }),
      issue('INIT-1', 'OUT-1', { dueDate: day(2026, 11, 15) }),
      issue('INIT-2', 'OUT-1'),
      issue('EPIC-1', 'INIT-1', { dueDate: day(2027, 3, 1) }),
      issue('EPIC-2', 'INIT-2', { dueDate: day(2027, 1, 1) }),
    ]);
    expect(health.get('INIT-1')?.rolledUpDue).toEqual(day(2027, 3, 1));
    expect(health.get('INIT-2')?.rolledUpDue).toEqual(day(2027, 1, 1));
    expect(health.get('OUT-1')?.rolledUpDue).toEqual(day(2027, 3, 1));
  });

  test('a parentKey cycle terminates', () => {
    // Which date a cycle settles on depends on walk order; it only has to come from the cycle.
    const health = computePlanningHealth([
      issue('A', 'B', { dueDate: day(2026, 11, 1) }),
      issue('B', 'A', { dueDate: day(2026, 12, 1) }),
      issue('C', 'C', { dueDate: day(2027, 1, 1) }),
    ]);
    const cycleDates = [day(2026, 11, 1).getTime(), day(2026, 12, 1).getTime()];
    expect(cycleDates).toContain(health.get('A')?.rolledUpDue?.getTime());
    expect(cycleDates).toContain(health.get('B')?.rolledUpDue?.getTime());
    expect(health.get('C')?.rolledUpDue).toEqual(day(2027, 1, 1));
  });
});

describe('computePlanningHealth — estimate progress', () => {
  test('all four categories from direct children', () => {
    const health = computePlanningHealth([
      issue('ALL', null),
      issue('ALL-1', 'ALL', estimated),
      issue('ALL-2', 'ALL', { storyPointsMedian: 3, confidence: 50 }),
      issue('SOME', null),
      issue('SOME-1', 'SOME', estimated),
      issue('SOME-2', 'SOME', { storyPoints: 5 }),
      issue('NONE', null),
      issue('NONE-1', 'NONE', { confidence: 50 }),
      issue('EMPTY', null),
    ]);
    expect(health.get('ALL')?.estimateProgress).toBe('Estimated');
    expect(health.get('SOME')?.estimateProgress).toBe('Partially estimated');
    expect(health.get('NONE')?.estimateProgress).toBe('Unestimated');
    expect(health.get('EMPTY')?.estimateProgress).toBe('No children');
  });

  test('counts direct children only, never grandchildren', () => {
    const health = computePlanningHealth([
      issue('INIT-1', null),
      issue('EPIC-1', 'INIT-1'),
      issue('STORY-1', 'EPIC-1', estimated),
    ]);
    expect(health.get('INIT-1')?.estimateProgress).toBe('Unestimated');
    expect(health.get('EPIC-1')?.estimateProgress).toBe('Estimated');
  });

  test('applies the same rule at every level', () => {
    // outcome → initiatives, initiative → epics, epic → stories: no level is special.
    const health = computePlanningHealth([
      issue('OUT-1', null),
      issue('INIT-1', 'OUT-1', estimated),
      issue('INIT-2', 'OUT-1'),
      issue('EPIC-1', 'INIT-1', estimated),
      issue('EPIC-2', 'INIT-1', estimated),
      issue('STORY-1', 'EPIC-1'),
    ]);
    expect(health.get('OUT-1')?.estimateProgress).toBe('Partially estimated');
    expect(health.get('INIT-1')?.estimateProgress).toBe('Estimated');
    expect(health.get('EPIC-1')?.estimateProgress).toBe('Unestimated');
    expect(health.get('STORY-1')?.estimateProgress).toBe('No children');
  });
});

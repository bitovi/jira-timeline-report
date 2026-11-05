import { describe, expect, test } from 'vitest';

import { computePlanningHealth } from './planningHealth';

import type { TimingCalculation } from './planningHealth';

type Fixture = Parameters<typeof computePlanningHealth>[0][number];

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

/** An issue with no estimate, no confidence and no dates unless given. */
function issue(
  key: string,
  parentKey: string | null,
  extra: Partial<Omit<Fixture, 'derivedTiming'>> & { start?: Date; due?: Date } = {},
): Fixture {
  const { start, due, ...rest } = extra;
  return {
    key,
    parentKey,
    hierarchyLevel: 0,
    derivedTiming: { ...(start && { start }), ...(due && { due }) } as Fixture['derivedTiming'],
    storyPoints: null,
    storyPointsMedian: null,
    confidence: null,
    ...rest,
  };
}

const estimated = { storyPoints: 5, confidence: 80 };

const WORKSTREAM = 3;
const INCREMENT = 2;
const EPIC = 1;
const STORY = 0;

/** Workstream: From Increments · Increment: From Epics · Epic: From Epic · Story: widest range. */
const SETTINGS: TimingCalculation[] = [
  { hierarchyLevel: WORKSTREAM, calculation: 'childrenOnly' },
  { hierarchyLevel: INCREMENT, calculation: 'childrenOnly' },
  { hierarchyLevel: EPIC, calculation: 'parentOnly' },
  { hierarchyLevel: STORY, calculation: 'widestRange' },
];

const ws = (key: string, extra = {}) => issue(key, null, { hierarchyLevel: WORKSTREAM, ...extra });
const inc = (key: string, parent: string, extra = {}) => issue(key, parent, { hierarchyLevel: INCREMENT, ...extra });
const epic = (key: string, parent: string, extra = {}) => issue(key, parent, { hierarchyLevel: EPIC, ...extra });
const story = (key: string, parent: string, extra = {}) => issue(key, parent, { hierarchyLevel: STORY, ...extra });

describe('computePlanningHealth — rolled-up dates follow the Timing Calculation settings', () => {
  test('"From Epics" over undated epics is empty: ignores the increment\'s own and its stories\' dates', () => {
    const health = computePlanningHealth(
      [
        inc('INC-1', 'WS-1', { due: day(2030, 1, 1) }),
        epic('EPIC-1', 'INC-1'),
        story('STORY-1', 'EPIC-1', { start: day(2026, 11, 1), due: day(2029, 6, 1) }),
      ],
      SETTINGS,
    );
    expect(health.get('INC-1')).toMatchObject({ rolledUpStart: null, rolledUpDue: null });
    // "From Epic": the epic ignores its story too.
    expect(health.get('EPIC-1')).toMatchObject({ rolledUpStart: null, rolledUpDue: null });
    expect(health.get('STORY-1')?.rolledUpDue).toEqual(day(2029, 6, 1));
  });

  test('"From Epics" takes the epics\' own dates, earliest start to latest due', () => {
    const health = computePlanningHealth(
      [
        ws('WS-1'),
        inc('INC-1', 'WS-1', { due: day(2030, 1, 1) }),
        epic('EPIC-1', 'INC-1', { start: day(2026, 11, 1), due: day(2027, 1, 1) }),
        epic('EPIC-2', 'INC-1', { start: day(2026, 12, 1), due: day(2027, 3, 1) }),
        story('STORY-1', 'EPIC-2', { due: day(2029, 6, 1) }),
      ],
      SETTINGS,
    );
    expect(health.get('INC-1')).toMatchObject({ rolledUpStart: day(2026, 11, 1), rolledUpDue: day(2027, 3, 1) });
    // And on up: Workstream "From Increments".
    expect(health.get('WS-1')).toMatchObject({ rolledUpStart: day(2026, 11, 1), rolledUpDue: day(2027, 3, 1) });
  });

  test('children count whatever the hierarchy range: there is no range input at all', () => {
    // Only increments might be rows (an Increment → Increment range), but loaded epics still count.
    const health = computePlanningHealth(
      [inc('INC-1', 'WS-1'), epic('EPIC-1', 'INC-1', { due: day(2027, 2, 1) })],
      SETTINGS,
    );
    expect(health.get('INC-1')?.rolledUpDue).toEqual(day(2027, 2, 1));
  });

  test('"From Increment, then Epics" prefers the parent\'s own date', () => {
    const health = computePlanningHealth(
      [inc('INC-1', 'WS-1', { due: day(2026, 12, 1) }), epic('EPIC-1', 'INC-1', { due: day(2027, 6, 1) })],
      [{ hierarchyLevel: INCREMENT, calculation: 'parentFirstThenChildren' }],
    );
    expect(health.get('INC-1')?.rolledUpDue).toEqual(day(2026, 12, 1));
  });

  test('without settings, each level uses the pipeline default: children first, then its own', () => {
    const health = computePlanningHealth([
      inc('INC-1', 'WS-1', { due: day(2026, 12, 1) }),
      epic('EPIC-1', 'INC-1', { due: day(2027, 6, 1) }),
      inc('INC-2', 'WS-1', { due: day(2026, 12, 15) }),
    ]);
    expect(health.get('INC-1')?.rolledUpDue).toEqual(day(2027, 6, 1));
    expect(health.get('INC-2')?.rolledUpDue).toEqual(day(2026, 12, 15));
  });

  test('a parentKey cycle terminates', () => {
    const health = computePlanningHealth([
      issue('A', 'B', { due: day(2027, 1, 1) }),
      issue('B', 'A', { due: day(2027, 2, 1) }),
    ]);
    expect(health.get('A')?.rolledUpDue).toBeInstanceOf(Date);
    expect(health.get('B')?.rolledUpDue).toBeInstanceOf(Date);
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

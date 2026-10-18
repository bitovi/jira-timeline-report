import { describe, expect, test } from 'vitest';
import { scoreRollup } from './score-rollup.js';

describe('scoreRollup', () => {
  const now = new Date('2026-10-18T00:00:00.000Z');

  test('awards a proportional score when visibility is partially within the requested months', () => {
    const result = scoreRollup({
      fieldKey: 'roll-up',
      config: {
        weight: 0.5,
        defined: { months: 6, weight: 0.5 },
        refined: { months: 3, weight: 0.5 },
      },
      descendants: [{ key: 'TASK-1', fields: { duedate: '2026-12-18', 'Story points': 8 } }],
      now,
    });

    expect(result).toMatchObject({
      fieldKey: 'roll-up',
      fieldType: 'roll-up',
      passed: true,
      breakdown: {
        defined: expect.objectContaining({ months: 6, weight: 0.5, ratio: expect.closeTo(1 / 3, 4) }),
        refined: expect.objectContaining({ months: 3, weight: 0.5, ratio: expect.closeTo(2 / 3, 4) }),
      },
    });
    expect(result.maxScore).toBe(50);
    expect(result.score).toBeCloseTo(25, 4);
  });

  test('awards full points when all requested months are visible', () => {
    const result = scoreRollup({
      fieldKey: 'roll-up',
      config: {
        weight: 0.5,
        defined: { months: 6, weight: 0.5 },
        refined: { months: 3, weight: 0.5 },
      },
      descendants: [{ key: 'TASK-1', fields: { duedate: '2027-05-01', 'Story points': 8 } }],
      now,
    });

    expect(result).toMatchObject({ fieldKey: 'roll-up', fieldType: 'roll-up', passed: true });
    expect(result.maxScore).toBe(50);
    expect(result.score).toBeCloseTo(50, 4);
  });
});

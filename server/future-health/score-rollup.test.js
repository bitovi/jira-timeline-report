import { describe, expect, test } from 'vitest';
import { scoreRollup } from './score-rollup.js';

describe('scoreRollup', () => {
  const now = new Date('2026-10-18T00:00:00.000Z');

  test('awards full points for Increment defined when child completion is at least 6 months out', () => {
    const result = scoreRollup({
      fieldKey: 'defined',
      weight: 0.2,
      issue: { key: 'INC-1', fields: { issuetype: { name: 'Increment' } } },
      descendants: [{ key: 'TASK-1', fields: { duedate: '2027-05-01', 'Story points': 8 } }],
      now,
    });

    expect(result).toMatchObject({ fieldKey: 'defined', score: 20, maxScore: 20, passed: true });
  });

  test('awards full points for Increment refined when child completion is at least 3 months out and story points exist', () => {
    const result = scoreRollup({
      fieldKey: 'refined',
      weight: 0.2,
      issue: { key: 'INC-1', fields: { issuetype: { name: 'Increment' } } },
      descendants: [{ key: 'TASK-1', fields: { duedate: '2027-02-01', 'Story points': 8 } }],
      now,
    });

    expect(result).toMatchObject({ fieldKey: 'refined', score: 20, maxScore: 20, passed: true });
  });
});

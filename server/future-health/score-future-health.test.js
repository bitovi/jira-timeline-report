import { describe, expect, test } from 'vitest';
import { scoreFutureHealth } from './score-future-health.js';

describe('scoreFutureHealth', () => {
  test('returns non-debug output with weighted issue-type summaries', () => {
    const result = scoreFutureHealth({
      issueKey: 'INIT-1',
      debug: false,
      now: new Date('2026-10-18T00:00:00.000Z'),
      issues: [
        { key: 'INIT-1', fields: { issuetype: { name: 'Initiative' }, summary: 'Root' } },
        { key: 'TASK-9', fields: { issuetype: { name: 'Task' }, parent: { key: 'INIT-1' }, summary: 'Child' } },
        { key: 'BUG-1', fields: { issuetype: { name: 'Bug' }, summary: 'Ignore me' } },
      ],
      model: {
        issueType: 'Initiative',
        weight: 1,
        fields: { summary: { type: 'presence', weight: 1 } },
        child: {
          issueType: 'Task',
          weight: 0,
          fields: { summary: { type: 'presence', weight: 1 } },
        },
      },
    });

    expect(result).toEqual({
      futureHealthMetricScore: 100,
      issueTypeSummaries: [
        { issueType: 'Initiative', issueCount: 1, rawScore: 100, weightedScore: 100, weight: 1 },
        { issueType: 'Task', issueCount: 1, rawScore: 100, weightedScore: 0, weight: 0 },
      ],
    });
  });

  test('throws a structural error when the root issue is missing', () => {
    expect(() =>
      scoreFutureHealth({
        issueKey: 'INIT-404',
        debug: false,
        now: new Date('2026-10-18T00:00:00.000Z'),
        issues: [],
        model: { issueType: 'Initiative', weight: 1 },
      }),
    ).toThrow('Top-level issue INIT-404 was not found in issues');
  });
});

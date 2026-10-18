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

  test('throws a structural error when the root issue type does not match the model', () => {
    expect(() =>
      scoreFutureHealth({
        issueKey: 'INIT-1',
        debug: false,
        now: new Date('2026-10-18T00:00:00.000Z'),
        issues: [{ key: 'INIT-1', fields: { issuetype: { name: 'Task' } } }],
        model: { issueType: 'Initiative', weight: 1 },
      }),
    ).toThrow('Top-level issue INIT-1 does not match root model issueType Initiative');
  });

  test('throws a structural error when an expected child level is missing', () => {
    expect(() =>
      scoreFutureHealth({
        issueKey: 'INIT-1',
        debug: false,
        now: new Date('2026-10-18T00:00:00.000Z'),
        issues: [{ key: 'INIT-1', fields: { issuetype: { name: 'Initiative' }, summary: 'Root' } }],
        model: {
          issueType: 'Initiative',
          weight: 1,
          fields: { summary: { type: 'presence', weight: 1 } },
          child: { issueType: 'Task', weight: 0, fields: { summary: { type: 'presence', weight: 1 } } },
        },
      }),
    ).toThrow('Expected at least one Task child for INIT-1');
  });

  test('scores numeric roll-up field configs during hierarchy traversal', () => {
    const result = scoreFutureHealth({
      issueKey: 'INC-1',
      debug: false,
      now: new Date('2026-10-18T00:00:00.000Z'),
      issues: [
        { key: 'INC-1', fields: { issuetype: { name: 'Increment' } } },
        {
          key: 'TASK-1',
          fields: { issuetype: { name: 'Task' }, parent: { key: 'INC-1' }, duedate: '2027-05-01', 'Story points': 8 },
        },
      ],
      model: {
        issueType: 'Increment',
        weight: 1,
        fields: { defined: 0.5, refined: 0.5 },
        child: { issueType: 'Task', weight: 0, fields: {} },
      },
    });

    expect(result).toEqual({
      futureHealthMetricScore: 100,
      issueTypeSummaries: [
        { issueType: 'Increment', issueCount: 1, rawScore: 100, weightedScore: 100, weight: 1 },
        { issueType: 'Task', issueCount: 1, rawScore: 0, weightedScore: 0, weight: 0 },
      ],
    });
  });

  test('includes per-issue details, per-field details, reasons, and ignoredIssues in debug mode', () => {
    const result = scoreFutureHealth({
      issueKey: 'INIT-1',
      debug: true,
      now: new Date('2026-10-18T00:00:00.000Z'),
      issues: [
        { key: 'INIT-1', fields: { issuetype: { name: 'Initiative' }, summary: 'Root' } },
        { key: 'TASK-1', fields: { issuetype: { name: 'Task' }, parent: { key: 'INIT-1' }, summary: null } },
        { key: 'BUG-1', fields: { issuetype: { name: 'Bug' }, summary: 'Ignore me' } },
      ],
      model: {
        issueType: 'Initiative',
        weight: 1,
        fields: { summary: { type: 'presence', weight: 1 } },
        child: { issueType: 'Task', weight: 0, fields: { summary: { type: 'presence', weight: 1 } } },
      },
    });

    expect(result.issueTypeSummaries[0].issues[0].fields[0]).toMatchObject({ fieldKey: 'summary', passed: true });
    expect(result.issueTypeSummaries[1].issues[0].fields[0]).toMatchObject({
      fieldKey: 'summary',
      passed: false,
      reasons: ['summary has no value'],
    });
    expect(result.ignoredIssues).toEqual([
      {
        issueKey: 'BUG-1',
        issueType: 'Bug',
        reason: 'Issue type is not part of the provided model hierarchy',
      },
    ]);
  });
});

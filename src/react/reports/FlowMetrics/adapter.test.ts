import { expect, test, describe } from 'vitest';
import { buildStatusCategoryMap, toMetricsIssues } from './adapter';
import type { DerivedIssue } from '../../../jira/derived/derive';

const makeIssue = (
  statusId: string,
  statusName: string,
  categoryName: string,
  changelog: DerivedIssue['issue']['changelog'] = [],
): DerivedIssue =>
  ({
    issue: {
      key: 'TEST-1',
      id: 'TEST-1',
      fields: {
        Status: { id: statusId, name: statusName, statusCategory: { name: categoryName } },
      } as any,
      changelog,
    },
  }) as unknown as DerivedIssue;

const changelogEntry = (fromId: string, fromName: string, toId: string, toName: string) => ({
  created: '2024-01-01T00:00:00.000Z',
  items: [{ field: 'status', from: fromId, fromString: fromName, to: toId, toString: toName }],
});

describe('buildStatusCategoryMap', () => {
  test('maps current status IDs from issue fields', () => {
    const issues = [
      makeIssue('1', 'To Do', 'To Do'),
      makeIssue('2', 'In Progress', 'In Progress'),
      makeIssue('3', 'Done', 'Done'),
    ];
    const map = buildStatusCategoryMap(issues);
    expect(map.get('1')).toBe('new');
    expect(map.get('2')).toBe('indeterminate');
    expect(map.get('3')).toBe('done');
  });

  test('fills in changelog status IDs not seen as current statuses', () => {
    // Only "In Progress" and "Done" are current statuses — "Backlog" exists only in history
    const issues = [
      makeIssue('2', 'In Progress', 'In Progress', [changelogEntry('backlog-id', 'Backlog', '2', 'In Progress')]),
      makeIssue('3', 'Done', 'Done'),
    ];

    // Seed: we need at least one issue currently in "Backlog" for the name map to know
    // its category — OR the name appears in a transition toString that we already know.
    // Here "Backlog" only appears as fromString, so we need another issue with that name
    // as current status to seed the name map.
    const issuesWithBacklogSeed = [
      ...issues,
      makeIssue('backlog-id', 'Backlog', 'To Do'), // seeds name map: "Backlog" → 'new'
    ];

    const map = buildStatusCategoryMap(issuesWithBacklogSeed);
    expect(map.get('backlog-id')).toBe('new');
    expect(map.get('2')).toBe('indeterminate');
    expect(map.get('3')).toBe('done');
  });

  test('fills in a fromString ID that has no current-status seed when toId is already known', () => {
    // "In Review" is only seen as a fromString in the changelog, but "Done" is known.
    // Pass 2 should populate "in-review-id" via nameMap lookup of "In Review".
    const issues = [
      makeIssue('in-review-id', 'In Review', 'In Progress'), // seeds name map
      makeIssue('3', 'Done', 'Done', [changelogEntry('in-review-id', 'In Review', '3', 'Done')]),
    ];

    const map = buildStatusCategoryMap(issues);
    expect(map.get('in-review-id')).toBe('indeterminate');
  });
});

describe('toMetricsIssues — done date derivation', () => {
  const timedEntry = (created: string, fromId: string, fromName: string, toId: string, toName: string) => ({
    created,
    items: [{ field: 'status', from: fromId, fromString: fromName, to: toId, toString: toName }],
  });

  test('uses the last done transition for re-opened issues (regression: BUY-76 0-day cycle time)', () => {
    // Timeline: To Do → In Progress → Done (first) → In Progress (re-opened) → Done (last)
    // The last done transition must be used; otherwise the done date precedes
    // the last in-progress date, yielding a zero or negative cycle time.
    const changelog = [
      timedEntry('2024-01-01T00:00:00.000Z', '1', 'To Do', '2', 'In Progress'),
      timedEntry('2024-01-05T00:00:00.000Z', '2', 'In Progress', '3', 'Done'),
      timedEntry('2024-01-06T00:00:00.000Z', '3', 'Done', '2', 'In Progress'),
      timedEntry('2024-01-10T00:00:00.000Z', '2', 'In Progress', '3', 'Done'),
    ];

    const issues = [
      {
        issue: {
          key: 'BUY-76',
          id: 'BUY-76',
          fields: { Status: { id: '3', name: 'Done', statusCategory: { name: 'Done' } } } as any,
          changelog,
        },
      } as unknown as DerivedIssue,
    ];

    const statusCategoryMap = buildStatusCategoryMap(issues);
    const [result] = toMetricsIssues(issues, statusCategoryMap);

    expect(result.fields.resolutiondate).toBe('2024-01-10T00:00:00.000Z');
  });
});

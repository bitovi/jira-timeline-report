import { describe, expect, it } from 'vitest';
import { buildGanttRows, flattenIssueRows, toGroupHeader } from './rows';
import { hierarchyIssues, makeIssue } from '../fixtures';
import type { GanttRow, IssueOrRelease } from '../types';

const noneExpanded = () => false;
const noChildren = () => [] as IssueOrRelease[];
const isGroupRow = (row: GanttRow): row is Extract<GanttRow, { type: 'group' }> => row.type === 'group';

describe('flattenIssueRows', () => {
  it('returns a flat row per issue when nothing is expanded', () => {
    const rows = flattenIssueRows(hierarchyIssues, noneExpanded, noChildren);
    expect(rows).toEqual(
      hierarchyIssues.map((issue) => ({ type: 'issue', issue, isShowingChildren: false, depth: 0 })),
    );
  });

  it('inserts child rows at depth+1 when a parent is expanded', () => {
    const [parent, childA, childB] = hierarchyIssues;
    const getChildren = (issue: IssueOrRelease) => (issue.key === parent.key ? [childA, childB] : []);
    const isExpanded = (key: string) => key === parent.key;

    const rows = flattenIssueRows([parent], isExpanded, getChildren);

    expect(rows).toEqual([
      { type: 'issue', issue: parent, isShowingChildren: true, depth: 0 },
      { type: 'issue', issue: childA, isShowingChildren: false, depth: 1 },
      { type: 'issue', issue: childB, isShowingChildren: false, depth: 1 },
    ]);
  });
});

describe('toGroupHeader', () => {
  it('uses the group title as summary, falling back to the key', () => {
    expect(toGroupHeader({ key: 'no-team', title: 'No Team' })).toEqual({
      key: 'no-team',
      summary: 'No Team',
      status: null,
      parent: null,
    });
    expect(toGroupHeader({ key: 'no-team', title: null })).toEqual({
      key: 'no-team',
      summary: 'no-team',
      status: null,
      parent: null,
    });
  });

  it('carries the parent rollup status and reference when present', () => {
    const parent = makeIssue({ key: 'P-1', status: 'blocked' });
    expect(toGroupHeader({ key: 'P-1', title: 'Parent', parent })).toEqual({
      key: 'P-1',
      summary: 'Parent',
      status: 'blocked',
      parent,
    });
  });
});

describe('buildGanttRows', () => {
  it('flattens ungrouped when groupBy is empty', () => {
    const rows = buildGanttRows({
      primaryIssues: hierarchyIssues,
      allIssues: hierarchyIssues,
      groupBy: '',
      primaryIssueType: 'Epic',
      isExpanded: noneExpanded,
      getChildren: noChildren,
    });
    expect(rows).toHaveLength(hierarchyIssues.length);
    expect(rows.every((r) => r.type === 'issue')).toBe(true);
  });

  it('ignores groupBy when primaryIssueType is Release', () => {
    const rows = buildGanttRows({
      primaryIssues: hierarchyIssues,
      allIssues: hierarchyIssues,
      groupBy: 'team',
      primaryIssueType: 'Release',
      isExpanded: noneExpanded,
      getChildren: noChildren,
    });
    expect(rows.every((r) => r.type === 'issue')).toBe(true);
  });

  it('groups by team, falling back to "No Team" without throwing for a teamless issue', () => {
    const issues = [makeIssue({ key: 'A', team: { name: 'Payments' } }), makeIssue({ key: 'B', team: null })];
    const rows = buildGanttRows({
      primaryIssues: issues,
      allIssues: issues,
      groupBy: 'team',
      primaryIssueType: 'Epic',
      isExpanded: noneExpanded,
      getChildren: noChildren,
    });

    const groupRows = rows.filter(isGroupRow);
    expect(groupRows.map((r) => r.issue.summary)).toEqual(['Payments', 'No Team']);
  });

  it('groups by parent, ordering groups by rank, and carries the parent status', () => {
    const [parent, childA, childB] = hierarchyIssues;
    const rows = buildGanttRows({
      primaryIssues: [childA, childB],
      allIssues: hierarchyIssues,
      groupBy: 'parent',
      primaryIssueType: 'Epic',
      isExpanded: noneExpanded,
      getChildren: noChildren,
    });

    const groupRows = rows.filter(isGroupRow);
    expect(groupRows).toHaveLength(1);
    expect(groupRows[0].issue.summary).toBe(parent.summary);
    expect(groupRows[0].issue.status).toBe(parent.rollupStatuses.rollup.status);
  });
});

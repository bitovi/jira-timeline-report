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

  it('does not populate parent (no clickable tooltip) when it lacks rollupStatuses (ancestor-only fallback)', () => {
    // e.g. a grandparent resolved only via `allDerivedIssues` — a minimal ancestor ref, not a
    // full rolled-up issue, so `IssueTooltip` (which reads issue.rollupStatuses.*) must not
    // receive it.
    const ancestorOnlyParent = { key: 'GP-1', summary: 'Some Outcome' };
    expect(toGroupHeader({ key: 'GP-1', title: 'Some Outcome', parent: ancestorOnlyParent })).toEqual({
      key: 'GP-1',
      summary: 'Some Outcome',
      status: null,
      parent: null,
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

  it('groups by grandparent, carrying the grandparent status, with "No Grandparent" for a parentless parent', () => {
    const grandparent = makeIssue({ key: 'GP-1', summary: 'Initiative', status: 'blocked' });
    const parent = makeIssue({ key: 'P-1', summary: 'Epic', parentKey: 'GP-1' });
    const parentWithNoGrandparent = makeIssue({ key: 'P-2', summary: 'Orphan Epic', parentKey: null });
    const childA = makeIssue({ key: 'A', parentKey: 'P-1' });
    const childB = makeIssue({ key: 'B', parentKey: 'P-2' });
    const rows = buildGanttRows({
      primaryIssues: [childA, childB],
      allIssues: [grandparent, parent, parentWithNoGrandparent, childA, childB],
      groupBy: 'grandparent',
      primaryIssueType: 'Epic',
      isExpanded: noneExpanded,
      getChildren: noChildren,
    });

    const groupRows = rows.filter(isGroupRow);
    expect(groupRows.map((r) => r.issue.summary)).toEqual(['Initiative', 'No Grandparent']);
    expect(groupRows[0].issue.status).toBe('blocked');
    expect(groupRows[1].issue.status).toBeNull();
  });

  it('groups by grandparent using allDerivedIssues when the ancestor is outside allIssues (real-world bug repro)', () => {
    // Mirrors rolledupAndRolledBackIssuesAndReleases being scoped to primaryIssueType='Epic'
    // and below: `allIssues` contains ONLY the epics, while `allDerivedIssues` (the full,
    // unfiltered-by-hierarchy fetch) also has the Initiative and Outcome above them. These are
    // plain (pre-rollup) objects — no `rollupStatuses` — matching what a real `DerivedIssue`
    // looks like, unlike this file's `makeIssue` fixture (which always fills rollupStatuses in).
    const outcome = { key: 'OUTCOME-1', summary: 'Grow Revenue', parentKey: null };
    const initiative = { key: 'INIT-1', summary: 'Improve Checkout', parentKey: 'OUTCOME-1' };
    const epics = [
      makeIssue({ key: 'EPIC-1', parentKey: 'INIT-1' }),
      makeIssue({ key: 'EPIC-2', parentKey: 'INIT-1' }),
    ];

    const rows = buildGanttRows({
      primaryIssues: epics,
      allIssues: epics,
      allDerivedIssues: [...epics, initiative, outcome],
      groupBy: 'grandparent',
      primaryIssueType: 'Epic',
      isExpanded: noneExpanded,
      getChildren: noChildren,
    });

    const groupRows = rows.filter(isGroupRow);
    expect(groupRows.map((r) => r.issue.summary)).toEqual(['Grow Revenue']);
    // Ancestor-only fallback: no full rollup issue, so no clickable tooltip/status tint.
    expect(groupRows[0].issue.parent).toBeNull();
    expect(groupRows[0].issue.status).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import type { IssueOrRelease } from '../types';
import { groupIssues } from './groupIssues';

/** Build a minimal issue with only the fields `groupIssues` reads. */
const makeIssue = (overrides: Partial<IssueOrRelease> & { key: string }): IssueOrRelease => ({
  summary: overrides.key,
  rollupStatuses: { rollup: { status: 'ontrack' } },
  ...overrides,
});

describe('groupIssues', () => {
  it('returns a single ungrouped group (title: null) when groupBy is empty', () => {
    const issues = [makeIssue({ key: 'A-1' }), makeIssue({ key: 'A-2' })];

    const groups = groupIssues(issues, issues, '');

    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBeNull();
    expect(groups[0].issues).toEqual(issues);
  });

  describe('parent grouping', () => {
    it('groups issues by parentKey and looks up the parent summary/rank from allIssues', () => {
      const parentA = makeIssue({ key: 'PARENT-1', summary: 'Parent One', rank: '0|b' });
      const parentB = makeIssue({ key: 'PARENT-2', summary: 'Parent Two', rank: '0|a' });
      const issues = [
        makeIssue({ key: 'CHILD-1', parentKey: 'PARENT-1' }),
        makeIssue({ key: 'CHILD-2', parentKey: 'PARENT-2' }),
        makeIssue({ key: 'CHILD-3', parentKey: 'PARENT-1' }),
      ];

      const groups = groupIssues(issues, [...issues, parentA, parentB], 'parent');

      expect(groups.map((g) => g.key)).toEqual(['PARENT-2', 'PARENT-1']);
      expect(groups[0].title).toBe('Parent Two');
      expect(groups[1].title).toBe('Parent One');
      expect(groups[1].issues.map((i) => i.key)).toEqual(['CHILD-1', 'CHILD-3']);
    });

    it('buckets issues with no parentKey under a "No Parent" group, sorted last', () => {
      const parentA = makeIssue({ key: 'PARENT-1', summary: 'Zed Parent' });
      const issues = [makeIssue({ key: 'CHILD-1', parentKey: 'PARENT-1' }), makeIssue({ key: 'ORPHAN-1' })];

      const groups = groupIssues(issues, [...issues, parentA], 'parent');

      expect(groups.map((g) => g.title)).toEqual(['Zed Parent', 'No Parent']);
      expect(groups[1].issues.map((i) => i.key)).toEqual(['ORPHAN-1']);
    });

    it('falls back to the parent key as the title when the parent is not found in allIssues and has no embedded parent field', () => {
      const issues = [makeIssue({ key: 'CHILD-1', parentKey: 'PARENT-UNKNOWN' })];

      const groups = groupIssues(issues, issues, 'parent');

      expect(groups[0].title).toBe('PARENT-UNKNOWN');
    });

    it('falls back to the embedded fields.Parent summary when the parent is not found in allIssues', () => {
      const issues = [
        makeIssue({
          key: 'CHILD-1',
          parentKey: 'PARENT-UNKNOWN',
          issue: { fields: { Parent: { fields: { summary: 'Real Parent Name' } } } },
        }),
      ];

      const groups = groupIssues(issues, issues, 'parent');

      expect(groups[0].title).toBe('Real Parent Name');
    });

    it('sorts by rank when both parents have one', () => {
      const parentLow = makeIssue({ key: 'PARENT-LOW', summary: 'Zeta', rank: '0|a' });
      const parentHigh = makeIssue({ key: 'PARENT-HIGH', summary: 'Alpha', rank: '0|b' });
      const issues = [
        makeIssue({ key: 'C1', parentKey: 'PARENT-HIGH' }),
        makeIssue({ key: 'C2', parentKey: 'PARENT-LOW' }),
      ];

      const groups = groupIssues(issues, [...issues, parentLow, parentHigh], 'parent');

      // Ranked before higher, regardless of alphabetical title order.
      expect(groups.map((g) => g.title)).toEqual(['Zeta', 'Alpha']);
    });

    it('falls back to alphabetical order when neither parent has a rank', () => {
      const parentUnranked1 = makeIssue({ key: 'PARENT-UNRANKED-1', summary: 'Zeta' });
      const parentUnranked2 = makeIssue({ key: 'PARENT-UNRANKED-2', summary: 'Alpha' });
      const issues = [
        makeIssue({ key: 'C1', parentKey: 'PARENT-UNRANKED-1' }),
        makeIssue({ key: 'C2', parentKey: 'PARENT-UNRANKED-2' }),
      ];

      const groups = groupIssues(issues, [...issues, parentUnranked1, parentUnranked2], 'parent');

      expect(groups.map((g) => g.title)).toEqual(['Alpha', 'Zeta']);
    });

    it('populates group.parent with the resolved parent issue (additive field)', () => {
      const parentA = makeIssue({
        key: 'PARENT-1',
        summary: 'Parent One',
        rollupStatuses: { rollup: { status: 'blocked' } },
      });
      const issues = [makeIssue({ key: 'CHILD-1', parentKey: 'PARENT-1' }), makeIssue({ key: 'ORPHAN-1' })];

      const groups = groupIssues(issues, [...issues, parentA], 'parent');

      const parentGroup = groups.find((g) => g.key === 'PARENT-1');
      const noParentGroup = groups.find((g) => g.key === 'no-parent');
      expect(parentGroup?.parent?.key).toBe('PARENT-1');
      expect(parentGroup?.parent?.rollupStatuses.rollup.status).toBe('blocked');
      expect(noParentGroup?.parent).toBeNull();
    });
  });

  describe('team grouping', () => {
    it('groups issues by team.name, alphabetically, with "No Team" last', () => {
      const issues = [
        makeIssue({ key: 'I-1', team: { name: 'Zeta Team' } }),
        makeIssue({ key: 'I-2', team: { name: 'Alpha Team' } }),
        makeIssue({ key: 'I-3' }),
        makeIssue({ key: 'I-4', team: { name: 'Alpha Team' } }),
      ];

      const groups = groupIssues(issues, issues, 'team');

      expect(groups.map((g) => g.title)).toEqual(['Alpha Team', 'Zeta Team', 'No Team']);
      expect(groups[0].issues.map((i) => i.key)).toEqual(['I-2', 'I-4']);
    });
  });

  describe('project grouping', () => {
    it('groups issues by projectKey, alphabetically, with "No Project" last', () => {
      const issues = [
        makeIssue({ key: 'I-1', projectKey: 'ZED' }),
        makeIssue({ key: 'I-2', projectKey: 'ABC' }),
        makeIssue({ key: 'I-3' }),
      ];

      const groups = groupIssues(issues, issues, 'project');

      expect(groups.map((g) => g.title)).toEqual(['ABC', 'ZED', 'No Project']);
    });
  });
});

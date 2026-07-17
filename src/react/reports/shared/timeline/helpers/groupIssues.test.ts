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

    it('falls back to the parent key as the title when the parent is not found in allIssues', () => {
      const issues = [makeIssue({ key: 'CHILD-1', parentKey: 'PARENT-UNKNOWN' })];

      const groups = groupIssues(issues, issues, 'parent');

      expect(groups[0].title).toBe('PARENT-UNKNOWN');
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

  describe('grandparent grouping', () => {
    it('groups issues by the parent-of-the-parent key and looks up its summary/rank from allIssues', () => {
      const grandparentA = makeIssue({ key: 'GP-1', summary: 'Grandparent One', rank: '0|b' });
      const grandparentB = makeIssue({ key: 'GP-2', summary: 'Grandparent Two', rank: '0|a' });
      const parentA = makeIssue({ key: 'PARENT-1', parentKey: 'GP-1' });
      const parentB = makeIssue({ key: 'PARENT-2', parentKey: 'GP-2' });
      const issues = [
        makeIssue({ key: 'CHILD-1', parentKey: 'PARENT-1' }),
        makeIssue({ key: 'CHILD-2', parentKey: 'PARENT-2' }),
        makeIssue({ key: 'CHILD-3', parentKey: 'PARENT-1' }),
      ];

      const groups = groupIssues(issues, [...issues, parentA, parentB, grandparentA, grandparentB], 'grandparent');

      expect(groups.map((g) => g.key)).toEqual(['GP-2', 'GP-1']);
      expect(groups[0].title).toBe('Grandparent Two');
      expect(groups[1].title).toBe('Grandparent One');
      expect(groups[1].issues.map((i) => i.key)).toEqual(['CHILD-1', 'CHILD-3']);
    });

    it('buckets issues under "No Grandparent" when the parent has no parentKey, sorted last', () => {
      const grandparentA = makeIssue({ key: 'GP-1', summary: 'Zed Grandparent' });
      const parentA = makeIssue({ key: 'PARENT-1', parentKey: 'GP-1' });
      const parentWithNoGrandparent = makeIssue({ key: 'PARENT-2', parentKey: null });
      const issues = [
        makeIssue({ key: 'CHILD-1', parentKey: 'PARENT-1' }),
        makeIssue({ key: 'CHILD-2', parentKey: 'PARENT-2' }),
      ];

      const groups = groupIssues(issues, [...issues, parentA, parentWithNoGrandparent, grandparentA], 'grandparent');

      expect(groups.map((g) => g.title)).toEqual(['Zed Grandparent', 'No Grandparent']);
      expect(groups[1].issues.map((i) => i.key)).toEqual(['CHILD-2']);
    });

    it('buckets issues under "No Grandparent" when the issue itself has no parentKey at all', () => {
      const issues = [makeIssue({ key: 'ORPHAN-1' })];

      const groups = groupIssues(issues, issues, 'grandparent');

      expect(groups).toHaveLength(1);
      expect(groups[0].title).toBe('No Grandparent');
    });

    it('buckets issues under "No Grandparent" when the parent itself is missing from allIssues', () => {
      const issues = [makeIssue({ key: 'CHILD-1', parentKey: 'PARENT-UNKNOWN' })];

      const groups = groupIssues(issues, issues, 'grandparent');

      expect(groups).toHaveLength(1);
      expect(groups[0].title).toBe('No Grandparent');
    });

    it('falls back to the grandparent key as the title when the grandparent is not found in allIssues', () => {
      const parentA = makeIssue({ key: 'PARENT-1', parentKey: 'GP-UNKNOWN' });
      const issues = [makeIssue({ key: 'CHILD-1', parentKey: 'PARENT-1' })];

      const groups = groupIssues(issues, [...issues, parentA], 'grandparent');

      expect(groups[0].title).toBe('GP-UNKNOWN');
    });

    it('sorts by rank when both grandparents have one, else alphabetically', () => {
      const grandparentLow = makeIssue({ key: 'GP-LOW', summary: 'Zeta', rank: '0|a' });
      const grandparentHigh = makeIssue({ key: 'GP-HIGH', summary: 'Alpha', rank: '0|b' });
      const parentLow = makeIssue({ key: 'PARENT-LOW', parentKey: 'GP-LOW' });
      const parentHigh = makeIssue({ key: 'PARENT-HIGH', parentKey: 'GP-HIGH' });
      const issues = [
        makeIssue({ key: 'C1', parentKey: 'PARENT-HIGH' }),
        makeIssue({ key: 'C2', parentKey: 'PARENT-LOW' }),
      ];

      const groups = groupIssues(
        issues,
        [...issues, parentLow, parentHigh, grandparentLow, grandparentHigh],
        'grandparent',
      );

      // Ranked before higher, regardless of alphabetical title order.
      expect(groups.map((g) => g.title)).toEqual(['Zeta', 'Alpha']);
    });

    it('populates group.parent with the resolved grandparent issue (additive field)', () => {
      const grandparentA = makeIssue({
        key: 'GP-1',
        summary: 'Grandparent One',
        rollupStatuses: { rollup: { status: 'blocked' } },
      });
      const parentA = makeIssue({ key: 'PARENT-1', parentKey: 'GP-1' });
      const issues = [makeIssue({ key: 'CHILD-1', parentKey: 'PARENT-1' }), makeIssue({ key: 'ORPHAN-1' })];

      const groups = groupIssues(issues, [...issues, parentA, grandparentA], 'grandparent');

      const grandparentGroup = groups.find((g) => g.key === 'GP-1');
      const noGrandparentGroup = groups.find((g) => g.key === 'no-grandparent');
      expect(grandparentGroup?.parent?.key).toBe('GP-1');
      expect(grandparentGroup?.parent?.rollupStatuses.rollup.status).toBe('blocked');
      expect(noGrandparentGroup?.parent).toBeNull();
    });

    describe('allDerivedIssues fallback (ancestors outside allIssues)', () => {
      // Reproduces the real-world bug: `allIssues` (the rolled-up set) is scoped to the primary
      // issue type and its descendants, so when reporting on Epics with hierarchy
      // Outcome > Initiative > Epic > Story, the Initiative and Outcome are NEVER present in
      // `allIssues` — even though they were fetched via JQL and are present in the full,
      // unfiltered `allDerivedIssues` set.
      it('resolves the grandparent via allDerivedIssues when neither parent nor grandparent are in allIssues', () => {
        const outcome = makeIssue({ key: 'OUTCOME-1', summary: 'Grow Revenue', rank: '0|a' });
        const initiative = makeIssue({ key: 'INIT-1', summary: 'Improve Checkout', parentKey: 'OUTCOME-1' });
        const epics = [
          makeIssue({ key: 'EPIC-1', parentKey: 'INIT-1' }),
          makeIssue({ key: 'EPIC-2', parentKey: 'INIT-1' }),
        ];

        // allIssues == just the primary issues (matches rolledupAndRolledBackIssuesAndReleases
        // scoped to primaryIssueType='Epic'-and-below); Initiative/Outcome are absent.
        const groups = groupIssues(epics, epics, 'grandparent', undefined, [...epics, initiative, outcome]);

        expect(groups.map((g) => g.title)).toEqual(['Grow Revenue']);
        expect(groups[0].issues.map((i) => i.key)).toEqual(['EPIC-1', 'EPIC-2']);
      });

      it('resolves the parent via allDerivedIssues when the parent is not in allIssues', () => {
        const initiative = makeIssue({ key: 'INIT-1', summary: 'Improve Checkout' });
        const epics = [makeIssue({ key: 'EPIC-1', parentKey: 'INIT-1' })];

        const groups = groupIssues(epics, epics, 'parent', undefined, [...epics, initiative]);

        expect(groups[0].title).toBe('Improve Checkout');
      });

      it('prefers the allIssues entry over allDerivedIssues when the same key is present in both', () => {
        const grandparentInAllIssues = makeIssue({ key: 'GP-1', summary: 'From allIssues', rank: '0|a' });
        const grandparentInDerived = makeIssue({ key: 'GP-1', summary: 'From allDerivedIssues' });
        const parent = makeIssue({ key: 'PARENT-1', parentKey: 'GP-1' });
        const issues = [makeIssue({ key: 'CHILD-1', parentKey: 'PARENT-1' })];

        const groups = groupIssues(issues, [...issues, parent, grandparentInAllIssues], 'grandparent', undefined, [
          grandparentInDerived,
        ]);

        expect(groups[0].title).toBe('From allIssues');
      });
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

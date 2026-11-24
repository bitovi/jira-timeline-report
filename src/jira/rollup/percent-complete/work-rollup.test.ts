import { describe, expect, it } from 'vitest';
import { epicParentRules, ParentRules, rollupPercentComplete, WorkRollup } from './percent-complete';
import { IssueOrRelease } from '../rollup';
import { WorkMissingSize } from '../work-size/work-settings';

/** spec/046 § Work rollup: known vs. averaged, gaps, byTeam. */

type Fixture = {
  key: string;
  parentKey?: string | null;
  team?: string;
  total?: number | null;
  completed?: number;
  done?: boolean;
};

function issue({ key, parentKey = null, team = 'A', total = null, completed = 0, done = false }: Fixture) {
  return {
    key,
    parentKey,
    type: 'Issue',
    team: { name: team },
    statusCategory: done ? 'Done' : 'In Progress',
    derivedTiming: { totalDaysOfWork: total, completedDaysOfWork: completed },
  } as unknown as IssueOrRelease;
}

/** bottom-up groups → rollups by key */
function rollup(
  groups: Fixture[][],
  { missingSize, parentRules }: { missingSize?: WorkMissingSize; parentRules?: ParentRules } = {},
) {
  const grouped = groups.map((group) => group.map(issue));
  const result = rollupPercentComplete(grouped, { missingSize, parentRules });
  const byKey: Record<string, WorkRollup> = {};
  result.forEach((level, g) => level.rollupData.forEach((data, i) => (byKey[grouped[g][i].key] = data)));
  return byKey;
}

function sumByTeam(r: WorkRollup) {
  const teams = Object.values(r.byTeam);
  const total = (f: (t: (typeof teams)[number]) => number) => teams.reduce((a, t) => a + f(t), 0);
  return {
    known: total((t) => t.knownWorkingDays),
    knownCompleted: total((t) => t.knownCompletedWorkingDays),
    averaged: total((t) => t.averagedWorkingDays),
    averagedCompleted: total((t) => t.averagedCompletedWorkingDays),
  };
}

function expectByTeamAddsUp(r: WorkRollup) {
  const sums = sumByTeam(r);
  expect(sums.known).toBeCloseTo(r.knownWorkingDays);
  expect(sums.knownCompleted).toBeCloseTo(r.knownCompletedWorkingDays);
  expect(sums.averaged).toBeCloseTo(r.averagedWorkingDays);
  expect(sums.averagedCompleted).toBeCloseTo(r.averagedCompletedWorkingDays);
}

// stories s1 (team A, 10d), s2 (team B, 6d), s3 (team B, no size) under epic e1 (team A, own size 40d)
const STORIES: Fixture[] = [
  { key: 's1', parentKey: 'e1', team: 'A', total: 10, completed: 5 },
  { key: 's2', parentKey: 'e1', team: 'B', total: 6, completed: 6 },
  { key: 's3', parentKey: 'e1', team: 'B', total: null },
];
const EPIC: Fixture = { key: 'e1', team: 'A', total: 40, completed: 10 };

describe('work rollup', () => {
  describe('childrenFirstThenParent (default)', () => {
    it('keeps averages separate from known days and reports the gap', () => {
      const r = rollup([STORIES, [{ ...EPIC, total: null }]]);
      // average of the story level = mean(10, 6) = 8
      expect(r.s3.source).toBe('average');
      expect(r.s3.averagedWorkingDays).toBe(8);
      expect(r.s3.knownWorkingDays).toBe(0);

      expect(r.e1.source).toBe('children');
      expect(r.e1.knownWorkingDays).toBe(16);
      expect(r.e1.knownCompletedWorkingDays).toBe(11);
      expect(r.e1.averagedWorkingDays).toBe(8);
      expect(r.e1.workingDaysWithAverages).toBe(24);
      expect(r.e1.unsizedIssueKeys.sort()).toEqual(['e1', 's3']);
      expect(r.e1.byTeam.A.knownWorkingDays).toBe(10);
      expect(r.e1.byTeam.B).toEqual({
        knownWorkingDays: 6,
        knownCompletedWorkingDays: 6,
        averagedWorkingDays: 8,
        averagedCompletedWorkingDays: 0,
      });
      expectByTeamAddsUp(r.e1);
    });

    it('a parent sized by its own estimate still lists its children’s gaps', () => {
      const r = rollup([STORIES, [EPIC]]);
      expect(r.e1.source).toBe('self');
      expect(r.e1.knownWorkingDays).toBe(40);
      expect(r.e1.averagedWorkingDays).toBe(0);
      expect(r.e1.unsizedIssueKeys).toEqual(['s3']);
      expect(r.e1.byTeam).toEqual({
        A: {
          knownWorkingDays: 40,
          knownCompletedWorkingDays: 10,
          averagedWorkingDays: 0,
          averagedCompletedWorkingDays: 0,
        },
      });
    });

    it('a Done item without a size takes on the average as completed', () => {
      const r = rollup([
        [
          { key: 'a', total: 4 },
          { key: 'b', done: true },
        ],
      ]);
      expect(r.b.averagedWorkingDays).toBe(4);
      expect(r.b.averagedCompletedWorkingDays).toBe(4);
    });
  });

  describe('missingSize = unsized', () => {
    it('adds 0 days, lists the gap, and byTeam still adds up', () => {
      const r = rollup([STORIES, [{ ...EPIC, total: null }]], { missingSize: 'unsized' });
      expect(r.s3.source).toBe('unsized');
      expect(r.s3.workingDaysWithAverages).toBe(0);
      expect(r.e1.averagedWorkingDays).toBe(0);
      expect(r.e1.knownWorkingDays).toBe(16);
      expect(r.e1.unsizedIssueKeys.sort()).toEqual(['e1', 's3']);
      expectByTeamAddsUp(r.e1);
    });
  });
});

describe('epic level follows its date rollup setting (spec § Scope: epics only)', () => {
  const ALL_SIZED = STORIES.filter((s) => s.total != null);
  // groups are [stories, epics]; only the epic group gets a rule
  const at = (rule: ParentRules[number]) => ({ parentRules: [null, rule] as ParentRules });

  it('maps only the epic level, low → high', () => {
    expect(
      epicParentRules([
        { type: 'Initiative', hierarchyLevel: 2, calculation: 'parentOnly' },
        { type: 'Epic', hierarchyLevel: 1, calculation: 'parentOnly' },
        { type: 'Story', hierarchyLevel: 0, calculation: 'parentOnly' },
      ]),
    ).toEqual([null, 'parentOnly', null]);
  });

  it('From parent: the epic’s own size, even with every story sized', () => {
    const r = rollup([ALL_SIZED, [EPIC]], at('parentOnly'));
    expect(r.e1).toMatchObject({ source: 'self', knownWorkingDays: 40, knownCompletedWorkingDays: 10 });
  });

  it('From parent with no own size: the epic is unsized, not its stories’ total', () => {
    const r = rollup([ALL_SIZED, [{ ...EPIC, total: null }]], { ...at('parentOnly'), missingSize: 'unsized' });
    expect(r.e1).toMatchObject({ source: 'unsized', workingDaysWithAverages: 0 });
  });

  it('From children: the stories’ total, even with a gap and an own size', () => {
    const r = rollup([STORIES, [EPIC]], at('childrenOnly'));
    expect(r.e1).toMatchObject({ source: 'children', knownWorkingDays: 16, averagedWorkingDays: 8 });
  });

  it('From parent, then children: own size if it has one, else the stories', () => {
    expect(rollup([ALL_SIZED, [EPIC]], at('parentFirstThenChildren')).e1.knownWorkingDays).toBe(40);
    expect(rollup([ALL_SIZED, [{ ...EPIC, total: null }]], at('parentFirstThenChildren')).e1.knownWorkingDays).toBe(16);
  });

  it('Earliest to latest keeps today’s rule (children first, then parent)', () => {
    expect(rollup([ALL_SIZED, [EPIC]], at('widestRange')).e1).toMatchObject({
      source: 'children',
      knownWorkingDays: 16,
    });
    expect(rollup([STORIES, [EPIC]], at('widestRange')).e1).toMatchObject({ source: 'self', knownWorkingDays: 40 });
  });
});

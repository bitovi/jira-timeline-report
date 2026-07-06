import { describe, test, expect } from 'vitest';
import type { IssueOrRelease } from '../types';
import { workTypePresence } from './workTypePresence';

const issue = (rollupStatuses: IssueOrRelease['rollupStatuses']): IssueOrRelease => ({
  key: 'K',
  summary: 'K',
  rollupStatuses,
});

describe('workTypePresence', () => {
  test('a work type shows only when some issue has issueKeys for it', () => {
    const issues = [
      issue({ rollup: { status: 'ontrack' }, design: { issueKeys: ['A'] }, dev: { issueKeys: [] } }),
      issue({ rollup: { status: 'ontrack' }, qa: { issueKeys: ['B'] } }),
    ];
    const { map, hasWorkList } = workTypePresence(issues);
    expect(map).toEqual({ design: true, dev: false, qa: true, uat: false });
    expect(hasWorkList.map((wt) => wt.type)).toEqual(['design', 'qa']);
  });

  test('preserves work-type order (design, dev, qa, uat)', () => {
    const issues = [issue({ rollup: { status: 'ontrack' }, uat: { issueKeys: ['A'] }, design: { issueKeys: ['B'] } })];
    const { hasWorkList } = workTypePresence(issues);
    expect(hasWorkList.map((wt) => wt.type)).toEqual(['design', 'uat']);
  });

  test('no issues → nothing present', () => {
    expect(workTypePresence([]).hasWorkList).toEqual([]);
  });
});

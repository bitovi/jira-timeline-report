import { describe, expect, it } from 'vitest';
import { matchesAllFilterRows, matchesFilterRow, FilterRow, FilterableIssueOrRelease } from './filter-rows';

const issue = (overrides: Partial<FilterableIssueOrRelease>): FilterableIssueOrRelease => ({
  status: 'In Progress',
  ...overrides,
});

const row = (overrides: Partial<FilterRow>): FilterRow => ({
  id: 'r1',
  field: 'jiraStatus',
  operator: 'is',
  value: [],
  ...overrides,
});

describe('matchesFilterRow', () => {
  it('empty value array always matches', () => {
    expect(matchesFilterRow(issue({}), row({ value: [] }))).toBe(true);
  });

  describe('jiraStatus field', () => {
    it('"is" matches if the issue status is any of the selected values (OR within row)', () => {
      const r = row({ field: 'jiraStatus', operator: 'is', value: ['Done', 'In Progress'] });
      expect(matchesFilterRow(issue({ status: 'In Progress' }), r)).toBe(true);
      expect(matchesFilterRow(issue({ status: 'Idea' }), r)).toBe(false);
    });

    it('"is not" matches if the issue status is none of the selected values', () => {
      const r = row({ field: 'jiraStatus', operator: 'is not', value: ['Done', 'Canceled'] });
      expect(matchesFilterRow(issue({ status: 'In Progress' }), r)).toBe(true);
      expect(matchesFilterRow(issue({ status: 'Done' }), r)).toBe(false);
    });

    it('release "is" matches if ANY child status is selected', () => {
      const release = issue({
        status: undefined,
        childStatuses: { children: [{ status: 'Done' }, { status: 'In Progress' }] },
      });
      const r = row({ field: 'jiraStatus', operator: 'is', value: ['In Progress'] });
      expect(matchesFilterRow(release, r)).toBe(true);

      const noMatchRelease = issue({
        status: undefined,
        childStatuses: { children: [{ status: 'Idea' }] },
      });
      expect(matchesFilterRow(noMatchRelease, r)).toBe(false);
    });

    it('release "is not" only excludes once EVERY child matches the selected values', () => {
      const r = row({ field: 'jiraStatus', operator: 'is not', value: ['Done', 'Canceled'] });

      const allMatch = issue({ status: undefined, childStatuses: { children: [{ status: 'Done' }] } });
      expect(matchesFilterRow(allMatch, r)).toBe(false);

      const mixed = issue({
        status: undefined,
        childStatuses: { children: [{ status: 'Done' }, { status: 'In Progress' }] },
      });
      expect(matchesFilterRow(mixed, r)).toBe(true);
    });
  });

  describe('rollupStatus field', () => {
    it('"is" ORs plain status values with "Newly ..." boolean values in a single row', () => {
      const r = row({
        field: 'rollupStatus',
        operator: 'is',
        value: ['blocked', 'warning', 'newlyStarted', 'newlyCompleted', 'newlyDated'],
      });

      expect(matchesFilterRow(issue({ rollupStatuses: { rollup: { status: 'blocked' } } }), r)).toBe(true);
      expect(
        matchesFilterRow(issue({ rollupStatuses: { rollup: { status: 'ontrack', newlyStarted: true } } }), r),
      ).toBe(true);
      expect(
        matchesFilterRow(issue({ rollupStatuses: { rollup: { status: 'ontrack', newlyCompleted: true } } }), r),
      ).toBe(true);
      expect(matchesFilterRow(issue({ rollupStatuses: { rollup: { status: 'ontrack', newlyDated: true } } }), r)).toBe(
        true,
      );
      expect(matchesFilterRow(issue({ rollupStatuses: { rollup: { status: 'ontrack' } } }), r)).toBe(false);
    });

    it('"is not" matches when none of the selected values apply', () => {
      const r = row({ field: 'rollupStatus', operator: 'is not', value: ['blocked', 'warning'] });
      expect(matchesFilterRow(issue({ rollupStatuses: { rollup: { status: 'ontrack' } } }), r)).toBe(true);
      expect(matchesFilterRow(issue({ rollupStatuses: { rollup: { status: 'blocked' } } }), r)).toBe(false);
    });

    it('missing rollupStatuses never matches a non-empty value list', () => {
      const r = row({ field: 'rollupStatus', operator: 'is', value: ['blocked'] });
      expect(matchesFilterRow(issue({ rollupStatuses: undefined }), r)).toBe(false);
    });
  });
});

describe('matchesAllFilterRows', () => {
  it('ANDs multiple rows together', () => {
    const rows: FilterRow[] = [
      row({ id: 'r1', field: 'jiraStatus', operator: 'is not', value: ['Done'] }),
      row({ id: 'r2', field: 'rollupStatus', operator: 'is', value: ['blocked'] }),
    ];

    const matches = issue({ status: 'In Progress', rollupStatuses: { rollup: { status: 'blocked' } } });
    expect(matchesAllFilterRows(matches, rows)).toBe(true);

    const failsRollup = issue({ status: 'In Progress', rollupStatuses: { rollup: { status: 'ontrack' } } });
    expect(matchesAllFilterRows(failsRollup, rows)).toBe(false);

    const failsJiraStatus = issue({ status: 'Done', rollupStatuses: { rollup: { status: 'blocked' } } });
    expect(matchesAllFilterRows(failsJiraStatus, rows)).toBe(false);
  });

  it('empty rows array always matches', () => {
    expect(matchesAllFilterRows(issue({}), [])).toBe(true);
  });
});

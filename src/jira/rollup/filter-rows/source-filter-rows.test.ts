import { describe, expect, it } from 'vitest';
import {
  matchesAllSourceFilterRows,
  matchesSourceFilterRow,
  SourceFilterRow,
  SourceFilterableIssue,
} from './source-filter-rows';

const issue = (overrides: Partial<SourceFilterableIssue>): SourceFilterableIssue => ({
  status: 'In Progress',
  type: 'Story',
  labels: [],
  ...overrides,
});

const row = (overrides: Partial<SourceFilterRow>): SourceFilterRow => ({
  id: 'r1',
  field: 'status',
  operator: 'is',
  value: [],
  ...overrides,
});

describe('matchesSourceFilterRow', () => {
  it.each(['status', 'issueType', 'labels'] as const)('%s: an empty value always matches', (field) => {
    expect(matchesSourceFilterRow(issue({}), row({ field, operator: 'is', value: [] }))).toBe(true);
    expect(matchesSourceFilterRow(issue({}), row({ field, operator: 'is not', value: [] }))).toBe(true);
  });

  describe('status', () => {
    it('"is" matches any of the selected values', () => {
      const r = row({ field: 'status', operator: 'is', value: ['Done', 'In Progress'] });
      expect(matchesSourceFilterRow(issue({ status: 'In Progress' }), r)).toBe(true);
      expect(matchesSourceFilterRow(issue({ status: 'Idea' }), r)).toBe(false);
    });

    it('"is not" matches none of the selected values', () => {
      const r = row({ field: 'status', operator: 'is not', value: ['Done', "Won't do"] });
      expect(matchesSourceFilterRow(issue({ status: 'In Progress' }), r)).toBe(true);
      expect(matchesSourceFilterRow(issue({ status: 'Done' }), r)).toBe(false);
    });
  });

  describe('issueType', () => {
    it('"is" matches the issue type', () => {
      const r = row({ field: 'issueType', operator: 'is', value: ['Epic', 'Bug'] });
      expect(matchesSourceFilterRow(issue({ type: 'Bug' }), r)).toBe(true);
      expect(matchesSourceFilterRow(issue({ type: 'Story' }), r)).toBe(false);
    });

    it('"is not" excludes the issue type', () => {
      const r = row({ field: 'issueType', operator: 'is not', value: ['Story'] });
      expect(matchesSourceFilterRow(issue({ type: 'Epic' }), r)).toBe(true);
      expect(matchesSourceFilterRow(issue({ type: 'Story' }), r)).toBe(false);
    });
  });

  describe('labels', () => {
    it('"is" matches an issue with any of the selected labels', () => {
      const r = row({ field: 'labels', operator: 'is', value: ['frontend', 'api'] });
      expect(matchesSourceFilterRow(issue({ labels: ['api', 'urgent'] }), r)).toBe(true);
      expect(matchesSourceFilterRow(issue({ labels: ['urgent'] }), r)).toBe(false);
    });

    it('"is not" matches an issue with none of the selected labels', () => {
      const r = row({ field: 'labels', operator: 'is not', value: ['wontfix'] });
      expect(matchesSourceFilterRow(issue({ labels: ['api'] }), r)).toBe(true);
      expect(matchesSourceFilterRow(issue({ labels: ['api', 'wontfix'] }), r)).toBe(false);
    });

    it('an issue with no labels fails "is" and passes "is not"', () => {
      expect(
        matchesSourceFilterRow(issue({ labels: [] }), row({ field: 'labels', operator: 'is', value: ['a'] })),
      ).toBe(false);
      expect(
        matchesSourceFilterRow(
          issue({ labels: undefined }),
          row({ field: 'labels', operator: 'is not', value: ['a'] }),
        ),
      ).toBe(true);
    });
  });
});

describe('matchesAllSourceFilterRows', () => {
  it('no rows always matches', () => {
    expect(matchesAllSourceFilterRows(issue({}), [])).toBe(true);
  });

  it('ANDs rows together', () => {
    const rows = [
      row({ id: 'a', field: 'status', operator: 'is not', value: ['Done'] }),
      row({ id: 'b', field: 'issueType', operator: 'is', value: ['Story'] }),
    ];
    expect(matchesAllSourceFilterRows(issue({ status: 'In Progress', type: 'Story' }), rows)).toBe(true);
    expect(matchesAllSourceFilterRows(issue({ status: 'Done', type: 'Story' }), rows)).toBe(false);
    expect(matchesAllSourceFilterRows(issue({ status: 'In Progress', type: 'Bug' }), rows)).toBe(false);
  });
});

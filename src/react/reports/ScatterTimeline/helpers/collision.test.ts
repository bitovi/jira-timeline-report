import { describe, test, expect } from 'vitest';
import { intersect, packIssuesIntoRows, sortIssuesByLeftPosition, filterIssuesWithDates } from './collision';
import { makeIssue, mixedMissingDueIssues } from '../fixtures';

describe('intersect', () => {
  test('overlapping ranges (either order)', () => {
    expect(intersect({ start: 10, end: 30 }, { start: 20, end: 40 })).toBe(true);
    expect(intersect({ start: 20, end: 40 }, { start: 10, end: 30 })).toBe(true);
  });

  test('touching boundaries do not overlap', () => {
    expect(intersect({ start: 10, end: 30 }, { start: 30, end: 50 })).toBe(false);
  });

  test('fully separate ranges do not overlap', () => {
    expect(intersect({ start: 10, end: 20 }, { start: 30, end: 40 })).toBe(false);
  });

  test('contained range overlaps', () => {
    expect(intersect({ start: 10, end: 50 }, { start: 20, end: 30 })).toBe(true);
  });
});

describe('packIssuesIntoRows', () => {
  test('non-overlapping issues all fit in one row', () => {
    const rows = packIssuesIntoRows([
      { key: 'A', leftPercentStart: 10, rightPercentEnd: 20 },
      { key: 'B', leftPercentStart: 30, rightPercentEnd: 40 },
      { key: 'C', leftPercentStart: 50, rightPercentEnd: 60 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].items).toHaveLength(3);
  });

  test('collision pushes overlapping issue to a second row', () => {
    const rows = packIssuesIntoRows([
      { key: 'A', leftPercentStart: 10, rightPercentEnd: 30 },
      { key: 'B', leftPercentStart: 20, rightPercentEnd: 40 }, // overlaps A
      { key: 'C', leftPercentStart: 50, rightPercentEnd: 60 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].items.map((i) => i.key)).toEqual(['A', 'C']);
    expect(rows[1].items.map((i) => i.key)).toEqual(['B']);
  });

  test('nested collisions require three rows', () => {
    const rows = packIssuesIntoRows([
      { key: 'A', leftPercentStart: 10, rightPercentEnd: 40 },
      { key: 'B', leftPercentStart: 20, rightPercentEnd: 35 }, // inside A
      { key: 'C', leftPercentStart: 25, rightPercentEnd: 50 }, // overlaps A and B
    ]);
    expect(rows).toHaveLength(3);
  });

  test('empty input yields no rows', () => {
    expect(packIssuesIntoRows([])).toEqual([]);
  });

  test('touching boundaries share a row (no overlap)', () => {
    const rows = packIssuesIntoRows([
      { key: 'A', leftPercentStart: 10, rightPercentEnd: 30 },
      { key: 'B', leftPercentStart: 30, rightPercentEnd: 50 },
    ]);
    expect(rows).toHaveLength(1);
  });
});

describe('sortIssuesByLeftPosition', () => {
  test('sorts ascending by leftPercentStart', () => {
    const issues = [
      { leftPercentStart: 50, key: 'C' },
      { leftPercentStart: 10, key: 'A' },
      { leftPercentStart: 30, key: 'B' },
    ];
    expect(sortIssuesByLeftPosition(issues).map((i) => i.key)).toEqual(['A', 'B', 'C']);
  });

  test('does not mutate the original array', () => {
    const issues = [
      { leftPercentStart: 50, key: 'C' },
      { leftPercentStart: 10, key: 'A' },
    ];
    sortIssuesByLeftPosition(issues);
    expect(issues.map((i) => i.key)).toEqual(['C', 'A']);
  });
});

describe('filterIssuesWithDates', () => {
  test('keeps only issues with a rollup due date', () => {
    const issues = [makeIssue({ key: 'A', due: new Date('2025-02-01') }), makeIssue({ key: 'B', due: null })];
    const result = filterIssuesWithDates(issues);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('A');
  });

  test('drops issues from the mixed fixture that lack a due date', () => {
    const result = filterIssuesWithDates(mixedMissingDueIssues);
    expect(result.map((i) => i.key)).toEqual(['PROJ-20', 'PROJ-22']);
  });

  test('empty input yields empty output', () => {
    expect(filterIssuesWithDates([])).toEqual([]);
  });
});

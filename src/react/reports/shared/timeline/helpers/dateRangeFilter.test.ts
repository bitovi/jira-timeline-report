import { describe, test, expect } from 'vitest';
import { filterIssuesByDateRange, filterIssuesKeepingUndated, parseISODateRangeBoundary } from './dateRangeFilter';
import type { IssueOrRelease } from '../types';

/** Build a minimal issue with only the fields these helpers read. */
const makeIssue = (overrides: { key: string; due: Date | null }): IssueOrRelease => ({
  key: overrides.key,
  summary: overrides.key,
  rollupStatuses: { rollup: { status: 'ontrack', due: overrides.due } },
});

describe('filterIssuesByDateRange', () => {
  const issues = [
    makeIssue({ key: 'A', due: new Date('2025-01-10') }),
    makeIssue({ key: 'B', due: new Date('2025-02-14') }),
    makeIssue({ key: 'C', due: new Date('2025-03-20') }),
  ];

  test('empty from/to returns the list unchanged (no outside-range issues)', () => {
    const { insideRange, outsideRange } = filterIssuesByDateRange(issues, {});
    expect(insideRange).toEqual(issues);
    expect(outsideRange).toEqual([]);
  });

  test('bounded window includes boundary dates and excludes outside dates', () => {
    const { insideRange, outsideRange } = filterIssuesByDateRange(issues, {
      from: new Date('2025-01-10'),
      to: new Date('2025-02-14'),
    });
    expect(insideRange.map((i) => i.key)).toEqual(['A', 'B']);
    expect(outsideRange.map((i) => i.key)).toEqual(['C']);
  });

  test('open-ended "from" only excludes issues before it', () => {
    const { insideRange, outsideRange } = filterIssuesByDateRange(issues, { from: new Date('2025-02-01') });
    expect(insideRange.map((i) => i.key)).toEqual(['B', 'C']);
    expect(outsideRange.map((i) => i.key)).toEqual(['A']);
  });

  test('open-ended "to" only excludes issues after it', () => {
    const { insideRange, outsideRange } = filterIssuesByDateRange(issues, { to: new Date('2025-02-01') });
    expect(insideRange.map((i) => i.key)).toEqual(['A']);
    expect(outsideRange.map((i) => i.key)).toEqual(['B', 'C']);
  });

  test('undated issues are excluded from a bounded window', () => {
    const withUndated = [...issues, makeIssue({ key: 'D', due: null })];
    const { insideRange, outsideRange } = filterIssuesByDateRange(withUndated, {
      from: new Date('2025-01-01'),
      to: new Date('2025-12-31'),
    });
    expect(insideRange.map((i) => i.key)).toEqual(['A', 'B', 'C']);
    expect(outsideRange.map((i) => i.key)).toEqual(['D']);
  });

  test('undated issues are retained (as inside) when the range is empty', () => {
    const withUndated = [...issues, makeIssue({ key: 'D', due: null })];
    const { insideRange, outsideRange } = filterIssuesByDateRange(withUndated, {});
    expect(insideRange).toEqual(withUndated);
    expect(outsideRange).toEqual([]);
  });
});

describe('filterIssuesKeepingUndated', () => {
  const issues = [
    makeIssue({ key: 'A', due: new Date('2025-01-10') }),
    makeIssue({ key: 'B', due: new Date('2025-02-14') }),
    makeIssue({ key: 'C', due: new Date('2025-03-20') }),
    makeIssue({ key: 'D', due: null }),
  ];

  test('returns the list unchanged when the range is empty', () => {
    expect(filterIssuesKeepingUndated(issues, {})).toEqual(issues);
  });

  test('keeps undated issues while filtering dated ones outside the window', () => {
    const result = filterIssuesKeepingUndated(issues, { from: new Date('2025-01-01'), to: new Date('2025-02-01') });
    expect(result.map((i) => i.key)).toEqual(['A', 'D']);
  });

  test('preserves the original relative order', () => {
    const reordered = [issues[3], issues[0], issues[2], issues[1]];
    const result = filterIssuesKeepingUndated(reordered, { from: new Date('2025-01-01'), to: new Date('2025-02-28') });
    expect(result.map((i) => i.key)).toEqual(['D', 'A', 'B']);
  });
});

describe('parseISODateRangeBoundary', () => {
  test('parses a valid ISO date into a local Date', () => {
    const date = parseISODateRangeBoundary('2025-03-14');
    expect(date).toEqual(new Date(2025, 2, 14));
  });

  test('returns undefined for empty string', () => {
    expect(parseISODateRangeBoundary('')).toBeUndefined();
    expect(parseISODateRangeBoundary(undefined)).toBeUndefined();
  });

  test('returns undefined for malformed input', () => {
    expect(parseISODateRangeBoundary('not-a-date')).toBeUndefined();
    expect(parseISODateRangeBoundary('2025-13-40')).toBeUndefined();
  });
});

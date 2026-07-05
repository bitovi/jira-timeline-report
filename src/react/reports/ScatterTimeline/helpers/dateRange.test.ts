import { describe, test, expect } from 'vitest';
import { computeDateRange, filterIssuesByDateRange, parseISODateRangeBoundary } from './dateRange';
import { makeIssue } from '../fixtures';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('computeDateRange', () => {
  test('uses min due − 30d and max due + 30d', () => {
    const issues = [
      makeIssue({ key: 'A', due: new Date('2025-03-01') }),
      makeIssue({ key: 'B', due: new Date('2025-05-01') }),
    ];
    const { rangeStart, rangeEnd } = computeDateRange(issues);
    expect(rangeStart.getTime()).toBe(new Date('2025-03-01').getTime() - DAY_MS * 30);
    expect(rangeEnd).toEqual(new Date('2025-05-01'));
  });

  test('empty list falls back to now ± 30d (no Invalid Date)', () => {
    const now = new Date('2025-06-15');
    const { rangeStart, rangeEnd } = computeDateRange([], now);
    expect(Number.isNaN(rangeStart.getTime())).toBe(false);
    expect(Number.isNaN(rangeEnd.getTime())).toBe(false);
    expect(rangeStart.getTime()).toBe(now.getTime() - DAY_MS * 30);
    expect(rangeEnd.getTime()).toBe(now.getTime() + DAY_MS * 30);
  });

  test('all-missing due dates falls back to now ± 30d', () => {
    const now = new Date('2025-06-15');
    const issues = [makeIssue({ key: 'A', due: null }), makeIssue({ key: 'B', due: null })];
    const { rangeStart, rangeEnd } = computeDateRange(issues, now);
    expect(Number.isNaN(rangeStart.getTime())).toBe(false);
    expect(Number.isNaN(rangeEnd.getTime())).toBe(false);
    expect(rangeEnd.getTime()).toBe(now.getTime() + DAY_MS * 30);
  });

  test('keys off rollupStatuses.rollup.due (the marker-positioning field), not rollupDates.due', () => {
    // Guards against the axis over-extending past the plotted markers: markers are positioned by
    // `rollupStatuses.rollup.due`, so the axis must be computed from the same field. Here the two
    // due fields disagree — the axis must follow the marker field (Feb), not the stray Dec date.
    const markerDue = new Date('2025-02-15');
    const issue = {
      ...makeIssue({ key: 'A', due: markerDue }),
      rollupDates: { start: null, due: new Date('2025-12-31'), dueTo: null },
    };
    const { rangeStart, rangeEnd } = computeDateRange([issue]);
    expect(rangeEnd).toEqual(markerDue);
    expect(rangeStart.getTime()).toBe(markerDue.getTime() - DAY_MS * 30);
  });
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

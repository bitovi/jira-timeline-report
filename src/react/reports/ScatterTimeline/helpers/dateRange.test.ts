import { describe, test, expect } from 'vitest';
import { computeDateRange } from './dateRange';
import { makeIssue } from '../fixtures';

// filterIssuesByDateRange / parseISODateRangeBoundary tests live in
// ../../shared/timeline/helpers/dateRangeFilter.test.ts now that the report-agnostic date-range
// filtering moved there for reuse by the Gantt.

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

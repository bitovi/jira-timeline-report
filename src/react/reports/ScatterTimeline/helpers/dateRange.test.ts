import { describe, test, expect } from 'vitest';
import { computeDateRange } from './dateRange';
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
});

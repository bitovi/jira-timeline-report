import { describe, test, expect } from 'vitest';
import { roundAndShiftDueDate } from './round-and-shift-due-date';
import { oneDayLater } from './date-helpers.js';

describe('roundAndShiftDueDate', () => {
  test('day rounding is identity + 1 day', () => {
    const due = new Date('2025-02-15T14:30:00');
    const result = roundAndShiftDueDate(due, 'day');
    expect(result).toEqual(oneDayLater(due));
  });

  test('unknown key falls back to identity (+1 day)', () => {
    const due = new Date('2025-02-15T14:30:00');
    expect(roundAndShiftDueDate(due, 'bogus')).toEqual(oneDayLater(due));
  });

  test('week rounding shifts a midweek due date to a later date', () => {
    const due = new Date('2025-02-12'); // Wednesday
    const result = roundAndShiftDueDate(due, 'week');
    expect(result.getTime()).toBeGreaterThan(due.getTime());
  });

  test('month rounding lands on the last day of month + 1', () => {
    const due = new Date('2025-02-10');
    const result = roundAndShiftDueDate(due, 'month');
    // month.end rounds to end of Feb (28th), then +1 day = Mar 1
    expect(result.getMonth()).toBe(2); // March
    expect(result.getDate()).toBe(1);
  });

  test('does not mutate the input date', () => {
    const due = new Date('2025-02-15T00:00:00');
    const before = due.getTime();
    roundAndShiftDueDate(due, 'month');
    expect(due.getTime()).toBe(before);
  });
});

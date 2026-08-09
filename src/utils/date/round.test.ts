import { describe, test, expect } from 'vitest';
import { roundDate } from './round.js';

/**
 * Guards the half-quarter boundaries against the extraction of HALF_QUARTERS into
 * half-quarters.js. `roundDate.halfQuarter` backs the `roundTo` setting used by the
 * Gantt grid, Scatter plot, Report of Reports, and route-data.
 *
 * These align to the *nearest* boundary and build local dates, so assertions read
 * local calendar parts rather than ISO strings.
 */
const parts = (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()];

describe('roundDate.halfQuarter', () => {
  test('start snaps back to the Feb 15 boundary', () => {
    expect(parts(roundDate.halfQuarter.start(new Date(2026, 2, 1)))).toEqual([2026, 2, 15]);
  });

  test('end snaps forward to the day before the next boundary', () => {
    expect(parts(roundDate.halfQuarter.end(new Date(2026, 2, 1)))).toEqual([2026, 3, 31]);
  });

  test('start snaps forward when the later boundary is nearer', () => {
    expect(parts(roundDate.halfQuarter.start(new Date(2026, 2, 25)))).toEqual([2026, 4, 1]);
  });

  test('a date on a boundary is left where it is', () => {
    expect(parts(roundDate.halfQuarter.start(new Date(2026, 7, 15)))).toEqual([2026, 8, 15]);
  });
});

import { describe, expect, test } from 'vitest';

import { formatDateValue, formatHowFarOut } from './relativeDate';

/** Local midnight on y-m-d (month is 1-based). */
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

// Mid-afternoon, so a "today" that isn't midnight can't push a date into the next day.
const TODAY = new Date(2026, 9, 29, 15, 30);

describe('formatHowFarOut', () => {
  test('today, whatever the hour', () => {
    expect(formatHowFarOut(day(2026, 10, 29), TODAY)).toBe('Today');
    expect(formatHowFarOut(new Date(2026, 9, 29, 23, 59), TODAY)).toBe('Today');
  });

  test('one day either side is singular', () => {
    expect(formatHowFarOut(day(2026, 10, 30), TODAY)).toBe('1 day out');
    expect(formatHowFarOut(day(2026, 10, 28), TODAY)).toBe('1 day ago');
  });

  test('13 days is days, 14 days is weeks', () => {
    expect(formatHowFarOut(day(2026, 11, 11), TODAY)).toBe('13 days out');
    expect(formatHowFarOut(day(2026, 11, 12), TODAY)).toBe('2 weeks out');
  });

  test('7 weeks is weeks, 8 weeks is months', () => {
    expect(formatHowFarOut(day(2026, 12, 17), TODAY)).toBe('7 weeks out');
    expect(formatHowFarOut(day(2026, 12, 24), TODAY)).toBe('2 months out');
  });

  test('23 months is months, 24 months is years', () => {
    expect(formatHowFarOut(day(2028, 9, 29), TODAY)).toBe('23 months out');
    expect(formatHowFarOut(day(2028, 10, 29), TODAY)).toBe('2 years out');
  });

  test('the spec example: 2027-06-01 from 2026-10-29 is 7 months out', () => {
    expect(formatHowFarOut(day(2027, 6, 1), TODAY)).toBe('7 months out');
  });

  test('past dates read "ago" at every unit', () => {
    expect(formatHowFarOut(day(2026, 10, 19), TODAY)).toBe('10 days ago');
    expect(formatHowFarOut(day(2026, 10, 8), TODAY)).toBe('3 weeks ago');
    expect(formatHowFarOut(day(2026, 4, 29), TODAY)).toBe('6 months ago');
    expect(formatHowFarOut(day(2023, 10, 29), TODAY)).toBe('3 years ago');
  });

  test('counts calendar days across a DST change', () => {
    // US DST ends 2026-11-01 and starts 2027-03-14: those days are 25 and 23 hours long locally.
    const beforeFallBack = new Date(2026, 9, 31, 12);
    expect(formatHowFarOut(day(2026, 11, 1), beforeFallBack)).toBe('1 day out');
    expect(formatHowFarOut(day(2026, 11, 2), beforeFallBack)).toBe('2 days out');
    const beforeSpringForward = new Date(2027, 2, 13, 0, 0);
    expect(formatHowFarOut(day(2027, 3, 14), beforeSpringForward)).toBe('1 day out');
    expect(formatHowFarOut(day(2027, 3, 15), beforeSpringForward)).toBe('2 days out');
  });

  test('reads a bare YYYY-MM-DD string as a local date, and accepts epoch ms', () => {
    expect(formatHowFarOut('2026-10-30', TODAY)).toBe('1 day out');
    expect(formatHowFarOut(day(2026, 10, 30).getTime(), TODAY)).toBe('1 day out');
  });

  test('missing or unparseable values are blank', () => {
    expect(formatHowFarOut(null, TODAY)).toBe('');
    expect(formatHowFarOut(undefined, TODAY)).toBe('');
    expect(formatHowFarOut('', TODAY)).toBe('');
    expect(formatHowFarOut('not a date', TODAY)).toBe('');
  });
});

describe('formatDateValue', () => {
  test("'date' (and no format) keeps the YYYY-MM-DD cell", () => {
    expect(formatDateValue('2026-12-01', undefined, TODAY)).toBe('2026-12-01');
    expect(formatDateValue('2026-12-01', 'date', TODAY)).toBe('2026-12-01');
    expect(formatDateValue(null, 'date', TODAY)).toBe('');
  });

  test("'relative' is How far out", () => {
    expect(formatDateValue(day(2027, 6, 1), 'relative', TODAY)).toBe('7 months out');
  });
});

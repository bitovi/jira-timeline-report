import { describe, test, expect } from 'vitest';
import { computeQuartersAndMonths } from './compute-quarters-and-months';

describe('computeQuartersAndMonths', () => {
  test('single month (January) expands to Q1', () => {
    const result = computeQuartersAndMonths(new Date(2025, 0, 15), new Date(2025, 0, 20));
    expect(result.months).toHaveLength(3);
    expect(result.months[0].name).toBe('Jan');
    expect(result.months[0].daysInMonth).toBe(31);
    expect(result.months[1].name).toBe('Feb');
    expect(result.months[2].name).toBe('Mar');
    expect(result.quarters).toHaveLength(1);
    expect(result.quarters[0].name).toBe('Q1');
  });

  test('multi-quarter range (Q1-Q2)', () => {
    const result = computeQuartersAndMonths(new Date(2025, 1, 1), new Date(2025, 4, 31));
    expect(result.quarters).toHaveLength(2);
    expect(result.months).toHaveLength(6);
  });

  test('leap-year February has 29 days', () => {
    const result = computeQuartersAndMonths(new Date(2024, 0, 1), new Date(2024, 11, 31));
    const feb = result.months[1];
    expect(feb.name).toBe('Feb');
    expect(feb.daysInMonth).toBe(29);
  });

  test('non-leap-year February has 28 days', () => {
    const result = computeQuartersAndMonths(new Date(2025, 0, 1), new Date(2025, 11, 31));
    const feb = result.months[1];
    expect(feb.daysInMonth).toBe(28);
  });

  test('century year 2000 February has 29 days (getFullYear fix, not getYear)', () => {
    const result = computeQuartersAndMonths(new Date(2000, 0, 1), new Date(2000, 2, 31));
    const feb = result.months[1];
    expect(feb.daysInMonth).toBe(29);
  });

  test('firstDay is start of first quarter, lastDay is end of last quarter', () => {
    const result = computeQuartersAndMonths(new Date(2025, 1, 15), new Date(2025, 1, 20));
    expect(result.firstDay.getMonth()).toBe(0); // Jan
    expect(result.firstDay.getDate()).toBe(1);
    // lastDay is the first day of the quarter after (April 1)
    expect(result.lastDay.getMonth()).toBe(3); // Apr
  });

  test('month daysInMonth values match calendar (Jan=31, Apr=30)', () => {
    const result = computeQuartersAndMonths(new Date(2025, 0, 1), new Date(2025, 5, 30));
    const days = result.months.map((m) => m.daysInMonth);
    // Jan Feb Mar Apr May Jun
    expect(days).toEqual([31, 28, 31, 30, 31, 30]);
  });
});

import { describe, test, expect } from 'vitest';
import { calculateTodayMargin, computeGridColumnCSS } from './grid';
import type { Month } from '../types';

describe('calculateTodayMargin', () => {
  test('midpoint of range is roughly 50%', () => {
    const firstDay = new Date('2025-01-01');
    const lastDay = new Date('2025-03-31');
    const today = new Date('2025-02-15');
    const margin = calculateTodayMargin(today, firstDay, lastDay);
    // ~mid-Q1, minus the 2-day visual offset
    expect(margin).toBeGreaterThan(45);
    expect(margin).toBeLessThan(55);
  });

  test('today before the range yields a negative margin', () => {
    const firstDay = new Date('2025-02-01');
    const lastDay = new Date('2025-03-31');
    const today = new Date('2025-01-15');
    expect(calculateTodayMargin(today, firstDay, lastDay)).toBeLessThan(0);
  });

  test('today after the range yields a margin over 100', () => {
    const firstDay = new Date('2025-01-01');
    const lastDay = new Date('2025-02-01');
    const today = new Date('2025-03-01');
    expect(calculateTodayMargin(today, firstDay, lastDay)).toBeGreaterThan(100);
  });
});

describe('computeGridColumnCSS', () => {
  const month = (name: string, number: number, daysInMonth: number): Month => ({
    date: new Date(2025, number, 1),
    name,
    number,
    daysInMonth,
  });

  test('maps each month to a fr value sized by days', () => {
    const months = [month('Jan', 0, 31), month('Feb', 1, 28), month('Mar', 2, 31)];
    expect(computeGridColumnCSS(months)).toBe('31fr 28fr 31fr');
  });

  test('leap-year February emits 29fr', () => {
    const months = [month('Feb', 1, 29)];
    expect(computeGridColumnCSS(months)).toBe('29fr');
  });

  test('empty months yields empty string', () => {
    expect(computeGridColumnCSS([])).toBe('');
  });
});

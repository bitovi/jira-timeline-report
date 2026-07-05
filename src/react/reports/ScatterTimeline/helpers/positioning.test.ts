import { describe, test, expect } from 'vitest';
import { calculatePositionPercentages, calculateTodayMargin, computeGridColumnCSS } from './positioning';
import type { Month, PositionConfig } from '../types';

describe('calculatePositionPercentages', () => {
  const base: Omit<PositionConfig, 'roundedDueDate'> = {
    textWidth: 100,
    widthOfArea: 1000,
    firstDay: new Date('2025-01-01'),
    lastDay: new Date('2025-03-31'),
  };

  test('width in percent is textWidth / widthOfArea', () => {
    const pos = calculatePositionPercentages({ ...base, roundedDueDate: new Date('2025-02-15') });
    expect(pos.widthInPercent).toBe(10);
  });

  test('midpoint due date positions near the middle of the timeline', () => {
    const pos = calculatePositionPercentages({ ...base, roundedDueDate: new Date('2025-02-15') });
    expect(pos.rightPercentEnd).toBeGreaterThan(40);
    expect(pos.rightPercentEnd).toBeLessThan(60);
  });

  test('issue at the very start of the timeline', () => {
    const pos = calculatePositionPercentages({ ...base, roundedDueDate: new Date('2025-01-01') });
    expect(pos.rightPercentEnd).toBeCloseTo(0, 5);
    expect(pos.endPercentFromRight).toBeCloseTo(100, 5);
  });

  test('issue at the end of the timeline', () => {
    const pos = calculatePositionPercentages({ ...base, roundedDueDate: new Date('2025-03-31') });
    expect(pos.rightPercentEnd).toBeCloseTo(100, 5);
    expect(pos.endPercentFromRight).toBeCloseTo(0, 5);
  });

  test('overflowsLeft is true when the label extends past the left edge', () => {
    // due near start + very wide text → leftPercentStart < 0
    const pos = calculatePositionPercentages({
      ...base,
      roundedDueDate: new Date('2025-01-05'),
      textWidth: 500, // 50% wide
    });
    expect(pos.leftPercentStart).toBeLessThan(0);
    expect(pos.overflowsLeft).toBe(true);
  });

  test('overflowsLeft is false when the label fits within the grid', () => {
    const pos = calculatePositionPercentages({ ...base, roundedDueDate: new Date('2025-02-15') });
    expect(pos.leftPercentStart).toBeGreaterThanOrEqual(0);
    expect(pos.overflowsLeft).toBe(false);
  });
});

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

import { describe, test, expect } from 'vitest';
import { calculatePositionPercentages } from './positioning';
import type { PositionConfig } from '../types';

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

// calculateTodayMargin and computeGridColumnCSS moved to shared/timeline/helpers/grid.test.ts

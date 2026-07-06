import { describe, expect, it } from 'vitest';
import { computeBarPosition } from './barPosition';
import type { AxisRange } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;
const range: AxisRange = { firstDay: new Date('2025-01-01'), lastDay: new Date('2025-01-31') };

describe('computeBarPosition', () => {
  it('positions a bar fully inside the range', () => {
    const pos = computeBarPosition(range, { start: new Date('2025-01-10'), due: new Date('2025-01-20') }, 'day');
    expect(pos.isEmpty).toBe(false);
    expect(pos.startExtends).toBe(false);
    expect(pos.endExtends).toBe(false);
    expect(pos.endIsBeforeFirstDay).toBe(false);
    expect(pos.startIsAfterLastDay).toBe(false);
    expect(pos.marginLeftPercent).toBeCloseTo((9 / 30) * 100, 5);
  });

  it('marks startExtends when the work starts before firstDay', () => {
    const pos = computeBarPosition(range, { start: new Date('2024-12-01'), due: new Date('2025-01-10') }, 'day');
    expect(pos.startExtends).toBe(true);
    expect(pos.marginLeftPercent).toBe(0);
  });

  it('marks endExtends when the work ends after lastDay', () => {
    const pos = computeBarPosition(range, { start: new Date('2025-01-20'), due: new Date('2025-02-15') }, 'day');
    expect(pos.endExtends).toBe(true);
  });

  it('marks endIsBeforeFirstDay when the work is entirely in the past', () => {
    const pos = computeBarPosition(range, { start: new Date('2024-11-01'), due: new Date('2024-12-01') }, 'day');
    expect(pos.endIsBeforeFirstDay).toBe(true);
  });

  it('returns isEmpty when both dates are null', () => {
    const pos = computeBarPosition(range, { start: null, due: null }, 'day');
    expect(pos).toEqual({
      isEmpty: true,
      startExtends: false,
      endExtends: false,
      endIsBeforeFirstDay: false,
      startIsAfterLastDay: false,
      widthPercent: 0,
      marginLeftPercent: 0,
    });
  });

  it('gives a single day a non-zero width', () => {
    const pos = computeBarPosition(range, { start: new Date('2025-01-10'), due: new Date('2025-01-10') }, 'day');
    const totalTime = range.lastDay.getTime() - range.firstDay.getTime();
    expect(pos.widthPercent).toBeCloseTo((DAY_MS / totalTime) * 100, 5);
  });

  it('rounds by week/month when roundTo is provided', () => {
    const pos = computeBarPosition(range, { start: new Date('2025-01-10'), due: new Date('2025-01-10') }, 'month');
    // Rounded to the full month → spans the whole visible range.
    expect(pos.widthPercent).toBeGreaterThan(90);
  });

  it('falls back to day (identity) rounding for an unknown roundTo key', () => {
    const dayPos = computeBarPosition(range, { start: new Date('2025-01-10'), due: new Date('2025-01-20') }, 'day');
    const unknownPos = computeBarPosition(
      range,
      { start: new Date('2025-01-10'), due: new Date('2025-01-20') },
      'not-a-real-strategy',
    );
    expect(unknownPos).toEqual(dayPos);
  });
});

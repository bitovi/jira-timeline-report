import { describe, test, expect } from 'vitest';
import { computeOccupiedDateExtent } from './trimRange';
import type { PlacedIssue } from '../types';

/** Build a minimal placed issue — the extent math only reads these three fields. */
const placed = (rightPercentEnd: number, widthInPercent: number, labelSide: 'left' | 'right'): PlacedIssue =>
  ({ rightPercentEnd, widthInPercent, labelSide }) as PlacedIssue;

const firstDay = new Date(2025, 0, 1);
const lastDay = new Date(2026, 0, 1);
const totalTime = lastDay.getTime() - firstDay.getTime();
const dateAtPercent = (percent: number) => new Date(firstDay.getTime() + (percent / 100) * totalTime);

describe('computeOccupiedDateExtent', () => {
  test('spans from the leftmost to the rightmost occupied edge across bands', () => {
    const bands = [
      { rows: [{ items: [placed(50, 10, 'left')] }] }, // occupies [40, 50]
      { rows: [{ items: [placed(60, 10, 'right')] }] }, // occupies [60, 70]
    ];
    const extent = computeOccupiedDateExtent(bands, firstDay, lastDay);
    expect(extent).not.toBeNull();
    expect(extent!.start.getTime()).toBe(dateAtPercent(40).getTime());
    expect(extent!.end.getTime()).toBe(dateAtPercent(70).getTime());
  });

  test('a right-flowing label extends the end past its marker', () => {
    const bands = [{ rows: [{ items: [placed(80, 15, 'right')] }] }]; // occupies [80, 95]
    const extent = computeOccupiedDateExtent(bands, firstDay, lastDay);
    expect(extent!.end.getTime()).toBe(dateAtPercent(95).getTime());
  });

  test('returns null when there is no content', () => {
    expect(computeOccupiedDateExtent([], firstDay, lastDay)).toBeNull();
    expect(computeOccupiedDateExtent([{ rows: [] }], firstDay, lastDay)).toBeNull();
    expect(computeOccupiedDateExtent([{ rows: [{ items: [] }] }], firstDay, lastDay)).toBeNull();
  });
});

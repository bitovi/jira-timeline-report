import { describe, test, expect } from 'vitest';
import { getDateRangePresets } from './quarterPresets';

describe('getDateRangePresets', () => {
  test('computes This-quarter / This-and-next-quarter windows relative to a mid-Q1 date', () => {
    const now = new Date(2025, 1, 15); // Feb 15, 2025 → Q1
    const presets = getDateRangePresets(now);

    expect(presets).toEqual([
      { label: 'This quarter', from: '2025-01-01', to: '2025-03-31' },
      { label: 'This and next quarter', from: '2025-01-01', to: '2025-06-30' },
    ]);
  });

  test('rolls over into the next year when the current quarter is Q4', () => {
    const now = new Date(2025, 10, 20); // Nov 20, 2025 → Q4
    const presets = getDateRangePresets(now);

    expect(presets).toEqual([
      { label: 'This quarter', from: '2025-10-01', to: '2025-12-31' },
      { label: 'This and next quarter', from: '2025-10-01', to: '2026-03-31' },
    ]);
  });
});

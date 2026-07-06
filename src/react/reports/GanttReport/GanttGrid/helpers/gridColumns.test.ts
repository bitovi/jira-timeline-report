import { describe, expect, it } from 'vitest';
import { computeGridTemplateColumns } from './gridColumns';
import type { Month } from '../types';

const makeMonth = (daysInMonth: number): Month => ({ date: new Date(), name: 'Jan', number: 1, daysInMonth });

describe('computeGridTemplateColumns', () => {
  it('produces gutter + month fr columns when there are no extra columns', () => {
    expect(computeGridTemplateColumns([makeMonth(31), makeMonth(28)], 0)).toBe('auto auto 31fr 28fr');
  });

  it('inserts a repeat(n, auto) segment for extra columns', () => {
    expect(computeGridTemplateColumns([makeMonth(31)], 1)).toBe('auto auto repeat(1, auto) 31fr');
  });

  it('handles an empty months list', () => {
    expect(computeGridTemplateColumns([], 0)).toBe('auto auto ');
  });
});

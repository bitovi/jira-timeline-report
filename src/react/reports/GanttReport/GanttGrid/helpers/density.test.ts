import { describe, expect, it } from 'vitest';
import { computeDensity, densityClasses } from './density';

describe('computeDensity', () => {
  it('is false at or below the threshold', () => {
    expect(computeDensity(20, false)).toBe(false);
    expect(computeDensity(0, false)).toBe(false);
  });

  it('is true above the threshold when not in breakdown mode', () => {
    expect(computeDensity(21, false)).toBe(true);
  });

  it('is forced false in breakdown mode, even above the threshold', () => {
    expect(computeDensity(100, true)).toBe(false);
  });
});

describe('densityClasses', () => {
  it('returns the dense class set', () => {
    expect(densityClasses(true)).toEqual({
      textSize: 'text-xs',
      bigBarSize: 'h-2',
      shadowBarSize: 'h-4',
      expandPadding: '',
    });
  });

  it('returns the normal class set', () => {
    expect(densityClasses(false)).toEqual({
      textSize: '',
      bigBarSize: 'h-4',
      shadowBarSize: 'h-6',
      expandPadding: 'pt-1 pb-0.5',
    });
  });
});

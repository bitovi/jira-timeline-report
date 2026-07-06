import { describe, test, expect } from 'vitest';
import { shouldUseDensityOptimizations } from './density';

describe('shouldUseDensityOptimizations', () => {
  test('20 or fewer issues: no optimization', () => {
    expect(shouldUseDensityOptimizations(15)).toBe(false);
    expect(shouldUseDensityOptimizations(20)).toBe(false); // boundary: not > 20
  });

  test('more than 20 issues: optimize', () => {
    expect(shouldUseDensityOptimizations(21)).toBe(true);
    expect(shouldUseDensityOptimizations(100)).toBe(true);
  });

  test('zero issues: no optimization', () => {
    expect(shouldUseDensityOptimizations(0)).toBe(false);
  });
});

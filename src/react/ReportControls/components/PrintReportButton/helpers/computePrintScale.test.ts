import { describe, it, expect } from 'vitest';

import { computePrintScale, PRINT_PAGE_CONTENT_WIDTH_PX } from './computePrintScale';

describe('computePrintScale', () => {
  it('returns 1 when content already fits within the available width', () => {
    expect(computePrintScale(500, 1000)).toBe(1);
    expect(computePrintScale(1000, 1000)).toBe(1);
  });

  it('returns a fractional scale when content is wider than the available width', () => {
    expect(computePrintScale(2000, 1000)).toBe(0.5);
  });

  it('never scales up', () => {
    expect(computePrintScale(100, 1000)).toBe(1);
  });

  it('defaults to the US Letter landscape print content width when unspecified', () => {
    expect(computePrintScale(PRINT_PAGE_CONTENT_WIDTH_PX * 2)).toBeCloseTo(0.5);
  });

  it('guards against zero/negative widths', () => {
    expect(computePrintScale(0, 1000)).toBe(1);
    expect(computePrintScale(-10, 1000)).toBe(1);
    expect(computePrintScale(1000, 0)).toBe(1);
  });
});

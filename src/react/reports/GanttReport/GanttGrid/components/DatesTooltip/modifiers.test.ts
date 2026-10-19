import { describe, expect, it } from 'vitest';
import { buildDatesTooltipModifiers } from './modifiers';

describe('buildDatesTooltipModifiers', () => {
  it('adds no modifiers without a boundary', () => {
    expect(buildDatesTooltipModifiers(null)).toEqual([]);
  });

  it('keeps the tooltip horizontally inside the boundary element', () => {
    const boundary = document.createElement('div');
    const [modifier] = buildDatesTooltipModifiers(boundary);
    expect(modifier.name).toBe('preventOverflow');
    expect(modifier.options).toMatchObject({ boundary, mainAxis: true, altAxis: false, padding: 0 });
  });
});

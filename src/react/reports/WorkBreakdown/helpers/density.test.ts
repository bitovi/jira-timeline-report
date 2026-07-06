import { describe, test, expect } from 'vitest';
import { density, fontSizeClass } from './density';

describe('density', () => {
  test('boundary counts map to tiers', () => {
    expect(density(4)).toBe('light');
    expect(density(5)).toBe('medium');
    expect(density(10)).toBe('medium');
    expect(density(11)).toBe('high');
    expect(density(20)).toBe('high');
    expect(density(21)).toBe('absurd');
  });

  test('zero cards → light', () => {
    expect(density(0)).toBe('light');
  });
});

describe('fontSizeClass', () => {
  test('high/absurd tiers force text-xs', () => {
    expect(fontSizeClass('high', 3)).toBe('text-xs');
    expect(fontSizeClass('absurd', 20)).toBe('text-xs');
  });

  test('medium tier with a long list shrinks to text-sm', () => {
    expect(fontSizeClass('medium', 7)).toBe('text-sm');
  });

  test('small lists use text-base', () => {
    expect(fontSizeClass('light', 4)).toBe('text-base');
    expect(fontSizeClass('medium', 4)).toBe('text-base');
  });

  test('mid-size default inherits (empty string)', () => {
    expect(fontSizeClass('light', 6)).toBe('');
    expect(fontSizeClass('medium', 6)).toBe('');
  });
});

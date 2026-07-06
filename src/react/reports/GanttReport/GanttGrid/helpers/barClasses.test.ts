import { describe, expect, it } from 'vitest';
import { barBorderClasses, barCornerClass } from './barClasses';

describe('barCornerClass', () => {
  it('rounds all corners when neither edge extends', () => {
    expect(barCornerClass({ startExtends: false, endExtends: false })).toBe('rounded');
  });
  it('rounds no corners when both edges extend', () => {
    expect(barCornerClass({ startExtends: true, endExtends: true })).toBe('rounded-none');
  });
  it('rounds only the right side when the start extends off-screen', () => {
    expect(barCornerClass({ startExtends: true, endExtends: false })).toBe('rounded-r');
  });
  it('rounds only the left side when the end extends off-screen', () => {
    expect(barCornerClass({ startExtends: false, endExtends: true })).toBe('rounded-l');
  });
});

describe('barBorderClasses', () => {
  it('draws a full border when neither edge extends', () => {
    expect(barBorderClasses({ startExtends: false, endExtends: false })).toEqual(['border']);
  });
  it('draws no border when both edges extend', () => {
    expect(barBorderClasses({ startExtends: true, endExtends: true })).toEqual(['border-0']);
  });
  it('draws right + top/bottom borders when the start extends off-screen', () => {
    expect(barBorderClasses({ startExtends: true, endExtends: false })).toEqual(['border-r', 'border-y']);
  });
  it('draws left + top/bottom borders when the end extends off-screen', () => {
    expect(barBorderClasses({ startExtends: false, endExtends: true })).toEqual(['border-l', 'border-y']);
  });
});

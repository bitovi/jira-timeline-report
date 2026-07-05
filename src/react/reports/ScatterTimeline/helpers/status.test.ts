import { describe, test, expect } from 'vitest';
import { getStatusColorClass } from './status';

describe('getStatusColorClass', () => {
  test('known statuses map to their color class', () => {
    expect(getStatusColorClass('complete')).toBe('color-text-and-bg-complete');
    expect(getStatusColorClass('ontrack')).toBe('color-text-and-bg-ontrack');
    expect(getStatusColorClass('behind')).toBe('color-text-and-bg-behind');
    expect(getStatusColorClass('blocked')).toBe('color-text-and-bg-blocked');
  });

  test('unknown status falls back to unknown', () => {
    expect(getStatusColorClass('not-a-real-status')).toBe('color-text-and-bg-unknown');
  });

  test('historical last-period variants map through', () => {
    expect(getStatusColorClass('behind-last-period')).toBe('color-text-and-bg-behind-last-period');
    expect(getStatusColorClass('ahead-last-period')).toBe('color-text-and-bg-ahead-last-period');
  });
});

import { describe, test, expect } from 'vitest';
import { childRollup } from './childRollup';

describe('childRollup', () => {
  test('all na → na', () => {
    expect(childRollup(['na', 'na', 'na', 'na'])).toBe('na');
  });

  test('all present are nodate → nodate', () => {
    expect(childRollup(['nodate', 'na', 'nodate', 'na'])).toBe('nodate');
  });

  test('picks the highest-priority present status', () => {
    expect(childRollup(['complete', 'ontrack', 'behind', 'na'])).toBe('behind');
    expect(childRollup(['complete', 'blocked', 'behind', 'ontrack'])).toBe('blocked');
    expect(childRollup(['ahead', 'ontrack', 'complete', 'na'])).toBe('ahead');
  });

  test('ignores nodate/na when a real status is present', () => {
    expect(childRollup(['nodate', 'complete', 'na', 'nodate'])).toBe('complete');
  });

  test('priority: blocked > behind > warning > ahead > ontrack > complete > notstarted', () => {
    expect(childRollup(['warning', 'behind'])).toBe('behind');
    expect(childRollup(['warning', 'ahead'])).toBe('warning');
    expect(childRollup(['ontrack', 'complete'])).toBe('ontrack');
    expect(childRollup(['complete', 'notstarted'])).toBe('complete');
  });
});

import { describe, expect, it } from 'vitest';
import { specialStatusTextClass } from './status';

describe('specialStatusTextClass', () => {
  it.each(['complete', 'blocked', 'warning'])('returns color-text-%s for special status %s', (status) => {
    expect(specialStatusTextClass(status)).toBe(`color-text-${status}`);
  });

  it.each(['ontrack', 'behind', 'unknown', 'notstarted', 'new'])(
    'returns empty string for non-special status %s',
    (status) => {
      expect(specialStatusTextClass(status)).toBe('');
    },
  );
});

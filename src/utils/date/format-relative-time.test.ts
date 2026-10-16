import { describe, expect, it } from 'vitest';

import { formatRelativeTime } from './format-relative-time';

const NOW = new Date('2026-10-15T12:00:00.000Z');
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString();

describe('formatRelativeTime', () => {
  it.each([
    [0, 'just now'],
    [59, 'just now'],
    [60, '1 minute ago'],
    [5 * 60, '5 minutes ago'],
    [2 * 60 * 60, '2 hours ago'],
    [24 * 60 * 60, 'yesterday'],
    [3 * 24 * 60 * 60, '3 days ago'],
    [8 * 24 * 60 * 60, 'last week'],
    [45 * 24 * 60 * 60, 'last month'],
    [400 * 24 * 60 * 60, 'last year'],
  ])('%i seconds ago reads "%s"', (seconds, expected) => {
    expect(formatRelativeTime(ago(seconds), NOW, 'en')).toBe(expected);
  });

  it('reads a time in the future (clock skew) as just now', () => {
    expect(formatRelativeTime(ago(-120), NOW, 'en')).toBe('just now');
  });

  it('returns null for something that is not a date', () => {
    expect(formatRelativeTime('not a date', NOW, 'en')).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';

import { isWithinWeek, startOfWeekUTC, weekContaining } from './currentWeek';

const at = (iso: string) => Date.parse(iso);

// 2026-08-17 is a Monday; 2026-08-23 the Sunday that closes its week.
const MONDAY = '2026-08-17T00:00:00.000Z';
const NEXT_MONDAY = '2026-08-24T00:00:00.000Z';

// See spec/027-status-updates § The week.
describe('startOfWeekUTC', () => {
  it('returns the Monday 00:00 UTC that starts the week', () => {
    expect(startOfWeekUTC(at('2026-08-20T13:45:00.000Z'))).toBe(at(MONDAY));
  });

  it('is idempotent on a Monday midnight', () => {
    expect(startOfWeekUTC(at(MONDAY))).toBe(at(MONDAY));
  });

  // The `day === 0 ? -6` branch — the one an off-by-one gets wrong, because Sunday is 0 and belongs to
  // the week that started six days earlier, not the one starting tomorrow.
  it('puts Sunday at the end of its week, not the start of the next', () => {
    expect(startOfWeekUTC(at('2026-08-23T23:59:59.999Z'))).toBe(at(MONDAY));
  });

  it('crosses a month boundary', () => {
    // Wednesday 2026-09-02 belongs to the week starting Monday 2026-08-31.
    expect(startOfWeekUTC(at('2026-09-02T09:00:00.000Z'))).toBe(at('2026-08-31T00:00:00.000Z'));
  });

  it('crosses a year boundary', () => {
    // Friday 2027-01-01 belongs to the week starting Monday 2026-12-28.
    expect(startOfWeekUTC(at('2027-01-01T12:00:00.000Z'))).toBe(at('2026-12-28T00:00:00.000Z'));
  });
});

describe('weekContaining', () => {
  it('is Monday to the following Monday', () => {
    expect(weekContaining(at('2026-08-20T13:45:00.000Z'))).toEqual({
      start: at(MONDAY),
      end: at(NEXT_MONDAY),
    });
  });

  it('gives the same window for every instant in the week', () => {
    const week = weekContaining(at(MONDAY));

    expect(weekContaining(at('2026-08-23T23:59:59.999Z'))).toEqual(week);
  });
});

describe('isWithinWeek', () => {
  const week = weekContaining(at('2026-08-20T00:00:00.000Z'));

  it('includes the Monday that opens the week', () => {
    expect(isWithinWeek(MONDAY, week)).toBe(true);
  });

  // Half-open, so the two boundaries the reader would most likely get wrong are asserted as a pair.
  it('includes Sunday 23:59 UTC and excludes the next Monday 00:00 UTC', () => {
    expect(isWithinWeek('2026-08-23T23:59:59.999Z', week)).toBe(true);
    expect(isWithinWeek(NEXT_MONDAY, week)).toBe(false);
  });

  it('excludes last week', () => {
    expect(isWithinWeek('2026-08-16T23:59:59.999Z', week)).toBe(false);
  });

  // Jira's own offset spelling, which is what the comment endpoint actually returns.
  it('reads Jira offset timestamps', () => {
    expect(isWithinWeek('2026-08-20T14:22:00.000+0000', week)).toBe(true);
  });

  it('is false for a missing or unparseable timestamp rather than throwing', () => {
    expect(isWithinWeek(undefined, week)).toBe(false);
    expect(isWithinWeek('', week)).toBe(false);
    expect(isWithinWeek('not a date', week)).toBe(false);
  });
});

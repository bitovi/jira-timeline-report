import { describe, expect, it } from 'vitest';
import { buildDatesTooltip, formatDateAndDiff } from './datesTooltip';
import { makeIssue } from '../fixtures';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

describe('formatDateAndDiff', () => {
  it('returns undefined when there is no date', () => {
    expect(formatDateAndDiff(null, null)).toBeUndefined();
  });

  it('formats the date with no diff when there is no prior-period date', () => {
    const date = new Date('2025-01-10');
    expect(formatDateAndDiff(date, null)).toBe(dateFormatter.format(date));
  });

  it('formats the date with no diff suffix when the dates are the same', () => {
    const date = new Date('2025-01-10');
    expect(formatDateAndDiff(date, new Date('2025-01-10'))).toBe(dateFormatter.format(date));
  });

  it('appends a "+" diff when the date moved later than the prior period', () => {
    const date = new Date('2025-01-17');
    const last = new Date('2025-01-10');
    expect(formatDateAndDiff(date, last)).toBe(`${dateFormatter.format(date)} +1w 0d`);
  });

  it('appends a "-" diff when the date moved earlier than the prior period', () => {
    const date = new Date('2025-01-10');
    const last = new Date('2025-01-17');
    expect(formatDateAndDiff(date, last)).toBe(`${dateFormatter.format(date)} -1w 0d`);
  });
});

describe('buildDatesTooltip', () => {
  it('returns undefined pills when the issue has no dates', () => {
    const issue = makeIssue({ key: 'A' });
    expect(buildDatesTooltip(issue)).toEqual({ startPill: undefined, endPill: undefined, durationPill: undefined });
  });

  it('builds start/end/duration pills for a dated issue', () => {
    const issue = makeIssue({ key: 'A', start: new Date('2025-01-06'), due: new Date('2025-01-20') });
    const result = buildDatesTooltip(issue);
    expect(result.startPill).toBe(dateFormatter.format(new Date('2025-01-06')));
    expect(result.endPill).toBe(dateFormatter.format(new Date('2025-01-20')));
    expect(result.durationPill).toBe('2w 0d');
  });

  it('includes a diff on the pills when the last period differs', () => {
    const issue = makeIssue({
      key: 'A',
      start: new Date('2025-01-06'),
      due: new Date('2025-01-20'),
      lastPeriod: { start: new Date('2025-01-01'), due: new Date('2025-01-13') },
    });
    const result = buildDatesTooltip(issue);
    expect(result.startPill).toContain('+');
    expect(result.endPill).toContain('+');
  });
});

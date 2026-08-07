import { describe, test, expect } from 'vitest';
import { halfQuarterTagToDate, parseHalfQuarterTag, tagsToDate } from './half-quarters.js';

/** ISO day of a returned date, or null. Asserting on strings keeps these timezone-proof. */
const day = (date: Date | null) => (date ? date.toISOString().split('T')[0] : null);

describe('halfQuarterTagToDate — start dates', () => {
  test.each([
    ['2026.Q1.T1', '2026-01-01'],
    ['2026.Q1.T2', '2026-02-15'],
    ['2026.Q2.T1', '2026-04-01'],
    ['2026.Q2.T2', '2026-05-15'],
    ['2026.Q3.T1', '2026-07-01'],
    ['2026.Q3.T2', '2026-08-15'],
    ['2026.Q4.T1', '2026-10-01'],
    ['2026.Q4.T2', '2026-11-15'],
  ])('%s starts on %s', (tag, expected) => {
    expect(day(halfQuarterTagToDate(tag, { isEndDate: false }))).toBe(expected);
  });
});

describe('halfQuarterTagToDate — end dates', () => {
  test.each([
    ['2026.Q1.T1', '2026-02-14'],
    ['2026.Q1.T2', '2026-03-31'],
    ['2026.Q2.T1', '2026-05-14'],
    ['2026.Q2.T2', '2026-06-30'],
    ['2026.Q3.T1', '2026-08-14'],
    ['2026.Q3.T2', '2026-09-30'],
    ['2026.Q4.T1', '2026-11-14'],
    ['2026.Q4.T2', '2026-12-31'],
  ])('%s ends on %s', (tag, expected) => {
    expect(day(halfQuarterTagToDate(tag, { isEndDate: true }))).toBe(expected);
  });
});

describe('halfQuarterTagToDate — whole-quarter tags', () => {
  test.each([
    ['2026.Q1', '2026-01-01', '2026-03-31'],
    ['2026.Q2', '2026-04-01', '2026-06-30'],
    ['2026.Q3', '2026-07-01', '2026-09-30'],
    ['2026.Q4', '2026-10-01', '2026-12-31'],
  ])('%s spans %s to %s', (tag, start, end) => {
    expect(day(halfQuarterTagToDate(tag, { isEndDate: false }))).toBe(start);
    expect(day(halfQuarterTagToDate(tag, { isEndDate: true }))).toBe(end);
  });
});

describe('parseHalfQuarterTag — accepted forms', () => {
  test('reads a prefixed tag', () => {
    expect(parseHalfQuarterTag('my-tag-25.Q2.T1')).toEqual({ year: 2025, quarter: 2, half: 1 });
  });

  test('reads a two-digit year as 2000s', () => {
    expect(parseHalfQuarterTag('FY26.Q1')).toEqual({ year: 2026, quarter: 1, half: null });
  });

  test('reads a four-digit year as written', () => {
    expect(parseHalfQuarterTag('1999.Q1')).toEqual({ year: 1999, quarter: 1, half: null });
  });

  test('reads a tag after a space', () => {
    expect(parseHalfQuarterTag('Roadmap 2026.Q2.T2')).toEqual({ year: 2026, quarter: 2, half: 2 });
  });

  test('treats a half other than T1/T2 as a whole quarter', () => {
    expect(parseHalfQuarterTag('2026.Q1.T3')).toEqual({ year: 2026, quarter: 1, half: null });
  });
});

describe('parseHalfQuarterTag — rejected forms', () => {
  test.each([
    ['no quarter', 'roadmap'],
    ['quarter out of range', '2026.Q5.T1'],
    ['tag not at the end', '2026.Q1.T1 roadmap'],
    ['empty string', ''],
    ['not a string', undefined],
  ])('rejects %s', (_label, input) => {
    expect(parseHalfQuarterTag(input)).toBeNull();
  });
});

describe('halfQuarterTagToDate — unparseable input', () => {
  test('returns null rather than throwing', () => {
    expect(halfQuarterTagToDate('roadmap', { isEndDate: false })).toBeNull();
  });

  test('a lenient T3 tag gets whole-quarter bounds', () => {
    expect(day(halfQuarterTagToDate('2026.Q1.T3', { isEndDate: false }))).toBe('2026-01-01');
    expect(day(halfQuarterTagToDate('2026.Q1.T3', { isEndDate: true }))).toBe('2026-03-31');
  });
});

describe('tagsToDate — single tag', () => {
  test('behaves like a direct lookup', () => {
    expect(day(tagsToDate('my-tag-25.Q2.T1', { isEndDate: false }))).toBe('2025-04-01');
    expect(day(tagsToDate('my-tag-25.Q2.T1', { isEndDate: true }))).toBe('2025-05-14');
  });
});

describe('tagsToDate — comma-separated string', () => {
  const labels = 'planning, 2026.Q3.T1, 2026.Q1.T2, roadmap';

  test('takes the earliest start', () => {
    expect(day(tagsToDate(labels, { isEndDate: false }))).toBe('2026-02-15');
  });

  test('takes the latest end', () => {
    expect(day(tagsToDate(labels, { isEndDate: true }))).toBe('2026-08-14');
  });
});

describe('tagsToDate — array', () => {
  test('takes the earliest start across entries', () => {
    expect(day(tagsToDate(['2026.Q4.T1', '2026.Q2.T2'], { isEndDate: false }))).toBe('2026-05-15');
  });

  test('takes the latest end across entries', () => {
    expect(day(tagsToDate(['2026.Q4.T1', '2026.Q2.T2'], { isEndDate: true }))).toBe('2026-11-14');
  });

  test('ignores entries that are not tags', () => {
    expect(day(tagsToDate(['roadmap', '2026.Q2.T2', ''], { isEndDate: false }))).toBe('2026-05-15');
  });

  test('splits comma-separated entries inside an array', () => {
    expect(day(tagsToDate(['planning, 2026.Q1.T1'], { isEndDate: false }))).toBe('2026-01-01');
  });
});

describe('tagsToDate — nothing usable', () => {
  test.each([
    ['an empty array', []],
    ['only non-tags', ['roadmap', 'planning']],
    ['an empty string', ''],
    ['undefined', undefined],
  ])('returns null for %s', (_label, input) => {
    expect(tagsToDate(input, { isEndDate: false })).toBeNull();
  });
});

describe('tagsToDate — output shape', () => {
  test('is UTC midnight, so isoDate carries no local offset', () => {
    expect(tagsToDate('2025.Q2.T1', { isEndDate: false })?.toISOString()).toBe('2025-04-01T00:00:00.000Z');
  });
});

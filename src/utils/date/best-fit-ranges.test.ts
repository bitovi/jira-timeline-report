import { describe, test, expect } from 'vitest';
import { bestFitRanges, bestFitRange } from './best-fit-ranges.js';

/**
 * `bestFitRanges` builds the labeled date columns across the top of the Auto Scheduler grid
 * (and the Estimate Analysis heat map). It picks a granularity from how long the span is —
 * days, weeks, months, quarters, years — then chops the span into columns at that size.
 *
 * The day granularity was unreachable in practice until it wasn't: `makeDateRanges` drops any
 * bucket covering a single business day, which is right for a trailing stub at week granularity
 * or coarser but wrong at day granularity, where one business day *is* a whole bucket. Every day
 * bucket collapsed and the function returned [], which crashed `gridUIData` in AutoScheduler.tsx
 * when it reached for the last column. Reported by a user who shortened a team's sprint length
 * from 10 to 5, halving their plan's length and dropping it under the ~12-calendar-day line where
 * day granularity gets selected.
 *
 * Dates are built and formatted in UTC, so these assertions are timezone-proof.
 */
const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));

type Range = { prettyStart: string; startDay: number; days: number; type: string };
const ranges = (start: Date, end: Date, maxBuckets = 12) => bestFitRanges(start, end, maxBuckets) as unknown as Range[];
const labels = (start: Date, end: Date, maxBuckets = 12) => ranges(start, end, maxBuckets).map((r) => r.prettyStart);

describe('bestFitRange — granularity selection', () => {
  // The span is divided by each granularity's average length; the first size that yields no more
  // than `maxBuckets` columns wins. 12 calendar days is the last span that still picks days, which
  // is the boundary that decides whether a plan lands in the day-granularity path at all.
  test.each([
    [11, 'days'],
    [12, 'days'],
    [13, 'weeks'],
    [89, 'months'],
    [364, 'quarters'],
    [3000, 'years'],
  ])('a %i day span uses %s', (daysApart, expected) => {
    expect(bestFitRange(daysApart, 12).name).toBe(expected);
  });
});

describe('bestFitRanges — day granularity', () => {
  // Regression: every one of these returned [] before, because each bucket spans exactly one
  // business day and the single-business-day filter threw them all away.
  test('gives one column per business day', () => {
    expect(labels(utc(2026, 9, 21), utc(2026, 9, 25))).toEqual(['Sep 21', 'Sep 22', 'Sep 23', 'Sep 24', 'Sep 25']);
  });

  test('skips the weekend', () => {
    // Mon Sep 21 -> Mon Sep 28. Sat 26 and Sun 27 get no column; Monday follows Friday.
    expect(labels(utc(2026, 9, 21), utc(2026, 9, 28))).toEqual([
      'Sep 21',
      'Sep 22',
      'Sep 23',
      'Sep 24',
      'Sep 25',
      'Sep 28',
    ]);
  });

  test('each column is one day wide and they tile without gaps', () => {
    const result = ranges(utc(2026, 9, 21), utc(2026, 9, 28));

    expect(result.every((r) => r.days === 1)).toBe(true);
    expect(result.every((r) => r.type === 'days')).toBe(true);
    // `startDay` is the 1-based business day offset the grid positions each column at.
    expect(result.map((r) => r.startDay)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test('a span of one business day still produces a column', () => {
    expect(labels(utc(2026, 9, 21), utc(2026, 9, 21))).toEqual(['Sep 21']);
  });

  test('never returns an empty set for a span containing business days', () => {
    // The crash condition: gridUIData reads `timeRanges[timeRanges.length - 1].startDay`.
    for (let offset = 0; offset <= 12; offset++) {
      const start = utc(2026, 9, 21);
      const end = new Date(start.getTime() + offset * 24 * 60 * 60 * 1000);
      expect(ranges(start, end).length, `span of ${offset} days`).toBeGreaterThan(0);
    }
  });
});

describe('bestFitRanges — coarser granularities still drop one-day stubs', () => {
  // The filter that broke day granularity is correct here and must stay: a span ending just past a
  // week boundary leaves a stub one business day wide, which would render as a sliver column beside
  // full-width ones.
  test('a trailing single-day stub gets no column of its own', () => {
    // Mon Sep 21 -> Mon Oct 5 is two whole weeks plus Oct 5 alone.
    const result = ranges(utc(2026, 9, 21), utc(2026, 10, 5));

    expect(result.map((r) => r.prettyStart)).toEqual(['Sep 21', 'Sep 28']);
    expect(result.map((r) => r.days)).toEqual([5, 5]);
    expect(result.every((r) => r.type === 'weeks')).toBe(true);
  });

  test('a partial first week keeps its column when it is more than one day wide', () => {
    // Thu Jan 1 2026 -> the first column covers Thu and Fri only, and is kept.
    const [first] = ranges(utc(2026, 1, 1), utc(2026, 2, 12));

    expect(first.prettyStart).toBe('Jan 1');
    expect(first.days).toBe(2);
  });
});

describe('bestFitRanges — spans starting on a weekend', () => {
  // A weekend start rolls the range's start forward to Monday while the clamped end rolls back to
  // the preceding Friday, producing a range that ends before it begins. Those were emitted as
  // `days: 0` columns. At day granularity the phantom shared its `startDay` with the real Monday
  // column, so the grid drew two columns into one slot.
  test('a weekend-only span yields no columns at all', () => {
    // Sat Sep 26 -> Sun Sep 27 2026 contains no business days.
    expect(ranges(utc(2026, 9, 26), utc(2026, 9, 27))).toEqual([]);
  });

  test('a span from Saturday to Monday yields exactly one column for the Monday', () => {
    expect(labels(utc(2026, 9, 26), utc(2026, 9, 28))).toEqual(['Sep 28']);
  });

  test('no column is zero-width and no two columns share a startDay', () => {
    const result = ranges(utc(2026, 9, 26), utc(2026, 9, 29));

    expect(result.map((r) => r.prettyStart)).toEqual(['Sep 28', 'Sep 29']);
    expect(result.every((r) => r.days > 0)).toBe(true);
    expect(new Set(result.map((r) => r.startDay)).size).toBe(result.length);
  });
});

describe('bestFitRanges — degenerate spans', () => {
  // These are the cases `gridUIData` handles by returning null and rendering a message instead of
  // a grid. They are legitimately uncolumnable, so the contract is an empty array rather than a throw.
  test('an end date before the start date yields no columns', () => {
    expect(ranges(utc(2026, 9, 25), utc(2026, 9, 21))).toEqual([]);
  });

  test('an invalid end date yields no columns instead of throwing', () => {
    // Reached when a team's sprint length is blank or non-numeric: the resulting NaN day count
    // makes an Invalid Date, which produced the same crash as the empty-range case.
    expect(ranges(utc(2026, 9, 21), new Date(NaN))).toEqual([]);
  });
});

/**
 * Still latent, and deliberately not asserted here: `getPreviousBusinessDay` and the weekly
 * `getStartOfNextRange` step with local `getDate`/`setDate` while every caller works in UTC. West of
 * UTC that lands a day early, so a handful of spans bucket differently there than they do in UTC or
 * east of it — which is why these tests pin dates with `Date.UTC` and assert on UTC-formatted
 * labels. Rejecting inverted ranges keeps the mixing from reaching the grid, but the underlying
 * local/UTC inconsistency is unfixed.
 */

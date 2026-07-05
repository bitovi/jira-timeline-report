import { mergeStartAndDueData } from '../../../../jira/rollup/dates/dates';
import type { RollupDateData } from '../../../../jira/rollup/dates/dates';
import type { IssueOrRelease } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Compute the `[rangeStart, rangeEnd]` window fed into `computeQuartersAndMonths`,
 * reproducing the legacy getter's behavior — including its empty / all-missing-date
 * fallback.
 *
 * Uses {@link mergeStartAndDueData} + `?? now` fallbacks rather than `Math.min/Math.max`,
 * which would yield `Infinity` (→ Invalid Date) for an empty list or all-missing due dates.
 * The window is expanded by 30 days on each side. The legacy getter keys the range off the
 * due date for both endpoints, so we do the same.
 *
 * Reads `rollupStatuses.rollup.due` — the same field used to position markers
 * ({@link plotting.ts}) and to filter by date range ({@link isIssueInDateRange}) — so the axis
 * always bounds the plotted markers. Keying off a different due field (e.g. `rollupDates.due`)
 * can stretch the axis past the markers, which is especially visible once a range filter narrows
 * the set.
 */
export const computeDateRange = (
  issues: IssueOrRelease[],
  now: Date = new Date(),
): { rangeStart: Date; rangeEnd: Date } => {
  const endDates: RollupDateData[] = issues.map((issue) => {
    const due = issue.rollupStatuses?.rollup?.due;
    return due ? { start: due, due } : {};
  });

  const { start, due } = mergeStartAndDueData(endDates);

  return {
    rangeStart: new Date((start ?? now).getTime() - DAY_MS * 30),
    rangeEnd: due ?? new Date(now.getTime() + DAY_MS * 30),
  };
};

/** Bounded date window used to filter issues by their rolled-up due date. Either side may be omitted for an open end. */
export interface DateRangeFilter {
  from?: Date;
  to?: Date;
}

/** Midnight of the same calendar day as `date`, so comparisons are day-granular regardless of time-of-day. */
const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** True when an issue's rolled-up due date falls within `[from, to]` (inclusive, either side optional). */
const isIssueInDateRange = (issue: IssueOrRelease, { from, to }: DateRangeFilter): boolean => {
  const due = issue.rollupStatuses?.rollup?.due;
  if (!due) {
    return false;
  }
  const dueDay = startOfDay(due);
  if (from && dueDay < startOfDay(from)) {
    return false;
  }
  if (to && dueDay > startOfDay(to)) {
    return false;
  }
  return true;
};

/**
 * Split `issues` (assumed to already have a rolled-up due date — see {@link partitionIssuesByDate})
 * into those whose due date falls inside `[from, to]` and those outside it.
 *
 * When both `from` and `to` are omitted, every issue is treated as "inside" (unbounded range —
 * reproduces today's behavior with no filtering).
 */
export const filterIssuesByDateRange = (
  issues: IssueOrRelease[],
  range: DateRangeFilter,
): { insideRange: IssueOrRelease[]; outsideRange: IssueOrRelease[] } => {
  if (!range.from && !range.to) {
    return { insideRange: issues, outsideRange: [] };
  }

  const insideRange: IssueOrRelease[] = [];
  const outsideRange: IssueOrRelease[] = [];
  for (const issue of issues) {
    (isIssueInDateRange(issue, range) ? insideRange : outsideRange).push(issue);
  }
  return { insideRange, outsideRange };
};

/** Parse an ISO `YYYY-MM-DD` string into a local `Date`, or `undefined` for empty/invalid input. */
export const parseISODateRangeBoundary = (value: string | undefined): Date | undefined => {
  if (!value) {
    return undefined;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return undefined;
  }
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  // Reject out-of-range month/day (e.g. "2025-13-40") — the Date constructor rolls those over
  // into a different, unintended date instead of producing an Invalid Date, so round-trip check.
  const isRoundTrip =
    date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day);
  return isRoundTrip ? date : undefined;
};

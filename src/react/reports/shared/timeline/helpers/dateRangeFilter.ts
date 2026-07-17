import type { IssueOrRelease } from '../types';

/** Bounded date window used to filter issues by their rolled-up due date. Either side may be omitted for an open end. */
export interface DateRangeFilter {
  from?: Date;
  to?: Date;
}

/** Midnight of the same calendar day as `date`, so comparisons are day-granular regardless of time-of-day. */
const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** True when an issue's rolled-up due date falls within `[from, to]` (inclusive, either side optional). */
export const isIssueInDateRange = (issue: IssueOrRelease, { from, to }: DateRangeFilter): boolean => {
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
 * Split `issues`
 * into those whose due date falls inside `[from, to]` and those outside it.
 *
 * When both `from` and `to` are omitted, every issue is treated as "inside" (unbounded range —
 * reproduces today's behavior with no filtering).
 */
export const filterIssuesByDateRange = <T extends IssueOrRelease>(
  issues: T[],
  range: DateRangeFilter,
): { insideRange: T[]; outsideRange: T[] } => {
  if (!range.from && !range.to) {
    return { insideRange: issues, outsideRange: [] };
  }

  const insideRange: T[] = [];
  const outsideRange: T[] = [];
  for (const issue of issues) {
    (isIssueInDateRange(issue, range) ? insideRange : outsideRange).push(issue);
  }
  return { insideRange, outsideRange };
};

/**
 * Filter `issues` by due-date range for reports (e.g. the Gantt) that don't track a separate
 * "outside range" bucket: issues without a due date are always kept — the range only judges
 * dated issues — and an empty range returns `issues` unchanged. Preserves the original order.
 */
export const filterIssuesKeepingUndated = <T extends IssueOrRelease>(issues: T[], range: DateRangeFilter): T[] => {
  if (!range.from && !range.to) {
    return issues;
  }
  return issues.filter((issue) => !issue.rollupStatuses?.rollup?.due || isIssueInDateRange(issue, range));
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

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
 */
export const computeDateRange = (
  issues: IssueOrRelease[],
  now: Date = new Date(),
): { rangeStart: Date; rangeEnd: Date } => {
  const endDates: RollupDateData[] = issues.map((issue) => {
    const due = issue.rollupDates.due;
    return due ? { start: due, due } : {};
  });

  const { start, due } = mergeStartAndDueData(endDates);

  return {
    rangeStart: new Date((start ?? now).getTime() - DAY_MS * 30),
    rangeEnd: due ?? new Date(now.getTime() + DAY_MS * 30),
  };
};

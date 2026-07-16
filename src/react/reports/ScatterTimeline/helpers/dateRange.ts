import { mergeStartAndDueData } from '../../../../jira/rollup/dates/dates';
import type { RollupDateData } from '../../../../jira/rollup/dates/dates';
import type { IssueOrRelease } from '../types';

export { filterIssuesByDateRange, parseISODateRangeBoundary } from '../../shared/timeline/helpers/dateRangeFilter';
export type { DateRangeFilter } from '../../shared/timeline/helpers/dateRangeFilter';

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
 * ({@link plotting.ts}) and to filter by date range (`isIssueInDateRange` in
 * `../../shared/timeline/helpers/dateRangeFilter`) — so the axis always bounds the plotted
 * markers. Keying off a different due field (e.g. `rollupDates.due`) can stretch the axis past
 * the markers, which is especially visible once a range filter narrows the set.
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

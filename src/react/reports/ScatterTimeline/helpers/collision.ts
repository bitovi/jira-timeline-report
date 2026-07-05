import type { Range, IssueOrRelease } from '../types';

/** Detect if two 1D ranges overlap. Touching boundaries do NOT count as overlap. */
export const intersect = (range1: Range, range2: Range): boolean =>
  range1.start < range2.end && range2.start < range1.end;

interface Packable {
  leftPercentStart: number;
  rightPercentEnd: number;
}

/**
 * Assign issues to non-overlapping rows using a greedy first-fit algorithm.
 *
 * Issues are assumed pre-sorted by `leftPercentStart` ascending (see
 * {@link sortIssuesByLeftPosition}). Each issue is placed in the first row where it does
 * not overlap any existing item; otherwise a new row is created.
 */
export const packIssuesIntoRows = <T extends Packable>(issues: T[]): Array<{ items: T[] }> => {
  const rows: Array<{ items: T[] }> = [];

  for (const issue of issues) {
    const fittingRow = rows.find(
      (row) =>
        !row.items.some(
          (item) => item.leftPercentStart < issue.rightPercentEnd && issue.leftPercentStart < item.rightPercentEnd,
        ),
    );

    if (fittingRow) {
      fittingRow.items.push(issue);
    } else {
      rows.push({ items: [issue] });
    }
  }

  return rows;
};

/** Sort issues left-to-right by `leftPercentStart` for optimal row packing. Non-mutating. */
export const sortIssuesByLeftPosition = <T extends { leftPercentStart: number }>(issues: T[]): T[] =>
  [...issues].sort((a, b) => a.leftPercentStart - b.leftPercentStart);

/**
 * Remove issues that lack a positioning due date.
 *
 * Filters on `rollupStatuses.rollup.due` — the same field used for positioning — so every
 * plotted issue is guaranteed to have a non-null date (no Invalid-Date markers).
 */
export const filterIssuesWithDates = (issues: IssueOrRelease[]): IssueOrRelease[] =>
  issues.filter((issue) => issue.rollupStatuses?.rollup?.due != null);

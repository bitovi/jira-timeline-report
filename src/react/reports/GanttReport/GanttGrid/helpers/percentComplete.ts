import type { IssueOrRelease } from '../types';

/**
 * Single source of truth for the % complete value, with the divide-by-zero guard.
 *
 * Returns `null` when there is no work to divide by (plan §Known issues #3 — was `NaN` in the
 * legacy code); the cell/modal render `null` as `—`.
 *
 * Unifies gantt-grid.js's `columnsToShow.getValue` + `getPercentComplete`.
 */
export const computePercentComplete = (issue: IssueOrRelease): number | null => {
  const { completedWorkingDays, totalWorkingDays } = issue.completionRollup;
  if (!totalWorkingDays) return null;
  return Math.round((completedWorkingDays * 100) / totalWorkingDays);
};

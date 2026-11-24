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
  const { completedWorkingDaysWithAverages, workingDaysWithAverages } = issue.completionRollup;
  if (!workingDaysWithAverages) return null;
  return Math.round((completedWorkingDaysWithAverages * 100) / workingDaysWithAverages);
};

/** Percent complete of the known work only (averaged placeholders left out); `null` when nothing is known. */
export const computeKnownPercentComplete = (issue: IssueOrRelease): number | null => {
  const { knownCompletedWorkingDays = 0, knownWorkingDays = 0 } = issue.completionRollup;
  if (!knownWorkingDays) return null;
  return Math.round((knownCompletedWorkingDays * 100) / knownWorkingDays);
};

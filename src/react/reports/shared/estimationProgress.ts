/**
 * The "is this issue estimated?" rule shared by the Estimation Progress report and the Table report's
 * Estimate Progress column (spec/044-planning-health-mvp §3).
 *
 * Both read the normalized values, so `storyPoints`, `storyPointsMedian` and `confidence` already
 * come through Team Configuration for the issue's team and level.
 */
import type { DerivedIssue } from '../../../jira/derived/derive';

export type EstimateProgress = 'Estimated' | 'Partially estimated' | 'Unestimated' | 'No children';

/** The four labels in planning order: least planned first. */
export const ESTIMATE_PROGRESS_ORDER: readonly EstimateProgress[] = [
  'No children',
  'Unestimated',
  'Partially estimated',
  'Estimated',
];

/** An estimate (`storyPoints ?? storyPointsMedian`) and a confidence. */
export function isEstimated(issue: Pick<DerivedIssue, 'storyPoints' | 'storyPointsMedian' | 'confidence'>): boolean {
  const estimate = issue.storyPoints ?? issue.storyPointsMedian ?? null;
  const confidence = issue.confidence ?? null;
  return estimate != null && confidence != null;
}

/** Classify a row from its direct children's counts. */
export function classifyEstimateProgress(childTotal: number, childEstimated: number): EstimateProgress {
  if (childTotal === 0) return 'No children';
  if (childEstimated === childTotal) return 'Estimated';
  if (childEstimated === 0) return 'Unestimated';
  return 'Partially estimated';
}

import { workTypes } from '../../../../../jira/derived/work-status/work-status';
import type { IssueOrRelease, WorkTypeWithWork } from '../types';

/**
 * Which of `workTypes` (design/dev/qa/uat) actually have work across the primary issues —
 * drives which breakdown bars to draw.
 *
 * Replaces gantt-grid.js's `hasWorkTypes`.
 */
export const computeWorkTypesWithWork = (issues: IssueOrRelease[]): WorkTypeWithWork[] =>
  workTypes.map((type) => ({
    type,
    hasWork: issues.some((i) => (i.rollupStatuses[type]?.issueKeys.length ?? 0) > 0),
  }));

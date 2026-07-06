import type { IssueOrRelease, WorkType } from '../types';
import { WORK_TYPES } from '../types';

/** Whether a single work type has any work across the given issues. */
export interface WorkTypePresence {
  type: WorkType;
  hasWork: boolean;
}

/**
 * Determine which work types have work across the primary issues — mirrors the legacy
 * `hasWorkTypes`. A work type "has work" if some issue has a non-empty
 * `rollupStatuses[type].issueKeys`.
 */
export const workTypePresence = (
  issues: IssueOrRelease[],
): { map: Record<WorkType, boolean>; list: WorkTypePresence[]; hasWorkList: WorkTypePresence[] } => {
  const map = {} as Record<WorkType, boolean>;
  const list = WORK_TYPES.map((type) => {
    const hasWork = issues.some((issue) => Boolean(issue.rollupStatuses[type]?.issueKeys?.length));
    map[type] = hasWork;
    return { type, hasWork };
  });
  return { map, list, hasWorkList: list.filter((wt) => wt.hasWork) };
};

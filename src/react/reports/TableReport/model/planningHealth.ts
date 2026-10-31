/**
 * Per-issue planning-health values for the Table report's Rolled-up Due Date and Estimate Progress
 * columns (spec/044-planning-health-mvp §4).
 *
 * Computed from every loaded issue linked by `parentKey`, NOT from the rollup pipeline: the rollup
 * only covers levels inside the selected hierarchy range, so with an Initiative → Initiative range an
 * initiative would never see its epics. Nothing here checks `hierarchyLevel` — a row looks at its
 * children, whatever level they are.
 */
import { classifyEstimateProgress, isEstimated } from '../../shared/estimationProgress';

import type { DerivedIssue } from '../../../../jira/derived/derive';
import type { EstimateProgress } from '../../shared/estimationProgress';

export interface PlanningHealth {
  rolledUpDue: Date | null;
  /** From the issue's direct children: Estimated / Partially estimated / Unestimated / No children. */
  estimateProgress: EstimateProgress;
}

type PlanningIssue = Pick<
  DerivedIssue,
  'key' | 'parentKey' | 'dueDate' | 'storyPoints' | 'storyPointsMedian' | 'confidence'
>;

/** Planning-health values for every issue in `issues`, keyed by issue key. */
export function computePlanningHealth(issues: readonly PlanningIssue[]): Map<string, PlanningHealth> {
  const childrenByParentKey = new Map<string, PlanningIssue[]>();
  for (const issue of issues) {
    if (!issue.parentKey) continue;
    const siblings = childrenByParentKey.get(issue.parentKey);
    if (siblings) siblings.push(issue);
    else childrenByParentKey.set(issue.parentKey, [issue]);
  }

  const rolledUpDueByKey = new Map<string, Date | null>();
  const visiting = new Set<string>();

  // The latest rolled-up due date among the children, else the issue's own due date. An issue
  // reached again while it is still being walked (a `parentKey` cycle) contributes its own date.
  const rolledUpDue = (issue: PlanningIssue): Date | null => {
    const cached = rolledUpDueByKey.get(issue.key);
    if (cached !== undefined) return cached;
    if (visiting.has(issue.key)) return issue.dueDate ?? null;

    visiting.add(issue.key);
    let latest: Date | null = null;
    for (const child of childrenByParentKey.get(issue.key) ?? []) {
      const due = rolledUpDue(child);
      if (due && (!latest || due.getTime() > latest.getTime())) latest = due;
    }
    visiting.delete(issue.key);

    const result = latest ?? issue.dueDate ?? null;
    rolledUpDueByKey.set(issue.key, result);
    return result;
  };

  const health = new Map<string, PlanningHealth>();
  for (const issue of issues) {
    const children = childrenByParentKey.get(issue.key) ?? [];
    health.set(issue.key, {
      rolledUpDue: rolledUpDue(issue),
      estimateProgress: classifyEstimateProgress(children.length, children.filter(isEstimated).length),
    });
  }
  return health;
}

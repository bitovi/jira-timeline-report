/**
 * Per-issue planning-health values for the Table report's Rolled-up Start Date, Rolled-up Due Date
 * and Estimate Progress columns (spec/044-planning-health-mvp §4).
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
  /** The earliest start date among the issue's children (recursively), else its own. */
  rolledUpStart: Date | null;
  /** The latest due date among the issue's children (recursively), else its own. */
  rolledUpDue: Date | null;
  /** From the issue's direct children: Estimated / Partially estimated / Unestimated / No children. */
  estimateProgress: EstimateProgress;
}

type PlanningIssue = Pick<
  DerivedIssue,
  'key' | 'parentKey' | 'startDate' | 'dueDate' | 'storyPoints' | 'storyPointsMedian' | 'confidence'
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

  /**
   * Roll a date up the `parentKey` tree: the date `wins` picks among the children's rolled-up dates,
   * else the issue's `own` date when no child has one. An issue reached again while it is still
   * being walked (a `parentKey` cycle) contributes its own date.
   */
  const rollUp = (own: (issue: PlanningIssue) => Date | null, wins: (a: Date, b: Date) => boolean) => {
    const byKey = new Map<string, Date | null>();
    const visiting = new Set<string>();
    const walk = (issue: PlanningIssue): Date | null => {
      const cached = byKey.get(issue.key);
      if (cached !== undefined) return cached;
      if (visiting.has(issue.key)) return own(issue);

      visiting.add(issue.key);
      let best: Date | null = null;
      for (const child of childrenByParentKey.get(issue.key) ?? []) {
        const date = walk(child);
        if (date && (!best || wins(date, best))) best = date;
      }
      visiting.delete(issue.key);

      const result = best ?? own(issue);
      byKey.set(issue.key, result);
      return result;
    };
    return walk;
  };

  const rolledUpStart = rollUp(
    (issue) => issue.startDate ?? null,
    (a, b) => a.getTime() < b.getTime(),
  );
  const rolledUpDue = rollUp(
    (issue) => issue.dueDate ?? null,
    (a, b) => a.getTime() > b.getTime(),
  );

  const health = new Map<string, PlanningHealth>();
  for (const issue of issues) {
    const children = childrenByParentKey.get(issue.key) ?? [];
    health.set(issue.key, {
      rolledUpStart: rolledUpStart(issue),
      rolledUpDue: rolledUpDue(issue),
      estimateProgress: classifyEstimateProgress(children.length, children.filter(isEstimated).length),
    });
  }
  return health;
}

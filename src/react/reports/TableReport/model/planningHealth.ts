/**
 * Per-issue planning-health values for the Table report's Rolled-up Start Date, Rolled-up Due Date
 * and Estimate Progress columns (spec/044-planning-health-mvp §4).
 *
 * Computed from every loaded issue linked by `parentKey`, NOT from the rollup pipeline: the pipeline
 * only covers levels inside the selected hierarchy range, so with an Increment → Increment range an
 * increment would never see its epics. The hierarchy range decides which rows show, never which
 * loaded children count.
 *
 * The rolled-up dates follow the Timing Calculation settings: each issue applies its level's method
 * (`From Epics`, `From Epic`, earliest-to-latest, …) from `src/jira/rollup/dates/dates.ts` — the same
 * functions the Gantt's pipeline uses — to its own `derivedTiming` and its children's rolled-up dates.
 */
import { getStartAndDueData, rollupDateMethods } from '../../../../jira/rollup/dates/dates';
import { classifyEstimateProgress, isEstimated } from '../../shared/estimationProgress';

import type { DerivedIssue } from '../../../../jira/derived/derive';
import type { RollupDateData } from '../../../../jira/rollup/dates/dates';
import type { IssueOrRelease } from '../../../../jira/rollup/rollup';
import type { CalculationType } from '../../../../jira/shared/types';
import type { EstimateProgress } from '../../shared/estimationProgress';

export interface PlanningHealth {
  /** The rolled-up start per the Timing Calculation settings, over every loaded level below. */
  rolledUpStart: Date | null;
  /** The rolled-up due per the Timing Calculation settings, over every loaded level below. */
  rolledUpDue: Date | null;
  /** From the issue's direct children: Estimated / Partially estimated / Unestimated / No children. */
  estimateProgress: EstimateProgress;
}

type PlanningIssue = Pick<
  DerivedIssue,
  'key' | 'parentKey' | 'hierarchyLevel' | 'derivedTiming' | 'storyPoints' | 'storyPointsMedian' | 'confidence'
>;

/** One Timing Calculation setting: the method a hierarchy level uses to get its dates. */
export type TimingCalculation = { hierarchyLevel: number; calculation: CalculationType };

/** The pipeline's fallback when a level has no setting. */
const DEFAULT_CALCULATION: CalculationType = 'childrenFirstThenParent';

/** Planning-health values for every issue in `issues`, keyed by issue key. */
export function computePlanningHealth(
  issues: readonly PlanningIssue[],
  timingCalculations: readonly TimingCalculation[] = [],
): Map<string, PlanningHealth> {
  const childrenByParentKey = new Map<string, PlanningIssue[]>();
  for (const issue of issues) {
    if (!issue.parentKey) continue;
    const siblings = childrenByParentKey.get(issue.parentKey);
    if (siblings) siblings.push(issue);
    else childrenByParentKey.set(issue.parentKey, [issue]);
  }

  const calculationByLevel = new Map(timingCalculations.map((t) => [t.hierarchyLevel, t.calculation]));

  /**
   * Roll dates up the `parentKey` tree, applying each issue's level method to its own timing and its
   * children's results. An issue reached again while it is still being walked (a `parentKey` cycle)
   * contributes its own dates.
   */
  const datesByKey = new Map<string, RollupDateData>();
  const visiting = new Set<string>();
  const rollUp = (issue: PlanningIssue): RollupDateData => {
    const cached = datesByKey.get(issue.key);
    if (cached) return cached;
    if (visiting.has(issue.key)) return getStartAndDueData(issue.derivedTiming ?? null);

    visiting.add(issue.key);
    const childDates = (childrenByParentKey.get(issue.key) ?? []).map(rollUp);
    visiting.delete(issue.key);

    const method = rollupDateMethods[calculationByLevel.get(issue.hierarchyLevel) ?? DEFAULT_CALCULATION];
    const result = method(issue as unknown as IssueOrRelease<unknown>, childDates);
    datesByKey.set(issue.key, result);
    return result;
  };

  const health = new Map<string, PlanningHealth>();
  for (const issue of issues) {
    const children = childrenByParentKey.get(issue.key) ?? [];
    const dates = rollUp(issue);
    health.set(issue.key, {
      rolledUpStart: dates.start ?? null,
      rolledUpDue: dates.due ?? null,
      estimateProgress: classifyEstimateProgress(children.length, children.filter(isEstimated).length),
    });
  }
  return health;
}

/**
 * This module provides functions to roll up warning issues within a hierarchical structure.
 * It identifies issues with a 'warning' label and aggregates them up through the hierarchy levels.
 **/
import {
  rollupGroupedHierarchy,
  groupIssuesByHierarchyLevelOrType,
  zipRollupDataOntoGroupedData,
  IssueOrRelease,
  isDerivedRelease,
  isDerivedIssue
} from "../rollup";

export type WithWarningIssues<T = unknown> = { warningIssues: IssueOrRelease<T>[] };

// these functions shouldn't be used eventually for performance ...
export function rollupWarningIssues<T>(
  issuesOrReleases: IssueOrRelease<T>[],
  rollupTimingLevelsAndCalculations: Array<{
    type: string;
    hierarchyLevel?: number;
  }>
): IssueOrRelease<T & WithWarningIssues<T>>[] {
  const groupedIssues = groupIssuesByHierarchyLevelOrType(
    issuesOrReleases,
    rollupTimingLevelsAndCalculations
  );

  const rolledUpWarnings = rollupWarningIssuesForGroupedHierarchy(groupedIssues);

  const zipped = zipRollupDataOntoGroupedData(groupedIssues, rolledUpWarnings, (item, values) => ({
    ...item,
    warningIssues: values,
  }));

  return zipped.flat();
}

export function rollupWarningIssuesForGroupedHierarchy<T>(groupedHierarchy: IssueOrRelease<T>[][]) {
  return rollupGroupedHierarchy(groupedHierarchy, {
    createRollupDataFromParentAndChild(issueOrRelease, children: IssueOrRelease<T>[][]) {
      if (isDerivedRelease(issueOrRelease)) return [...children.flat(1)];
      
      const lowerCaseLabels = (issueOrRelease.labels || []).map((label) => label.toLowerCase());
      const hasWarningLabel = lowerCaseLabels.some((label) => label === "warning");
      const hasWarningStatus = isDerivedIssue(issueOrRelease) && issueOrRelease?.status === "warning";

      const addParent =
      hasWarningLabel || hasWarningStatus
          ? [issueOrRelease]
          : [];
      return [...children.flat(1), ...addParent];
    },
  });
}

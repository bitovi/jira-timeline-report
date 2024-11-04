/**
 * This module provides functions to roll up warning issues within a hierarchical structure.
 * It identifies issues with a 'warning' label and aggregates them up through the hierarchy levels.
 **/
import {
  rollupGroupedHierarchy,
  groupIssuesByHierarchyLevelOrType,
  zipRollupDataOntoGroupedData,
  IssueOrRelease,
  isDerivedIssue,
} from "../rollup";

export type WithWarningIssues = { warningIssues: IssueOrRelease[] };

export function rollupWarningIssuesForGroupedHierarchy(
  groupedHierarchy: IssueOrRelease<WithWarningIssues>[][]
) {
  return rollupGroupedHierarchy(groupedHierarchy, {
    createRollupDataFromParentAndChild(issueOrRelease, children) {
      const warningIssues = children.flat(1);
      // releases don't have a status
      if (isDerivedIssue(issueOrRelease)) {
        const lowerCaseLabels = (issueOrRelease.labels || []).map((label) => label.toLowerCase());
        if (lowerCaseLabels.some((label) => label === "warning")) {
          warningIssues.push(issueOrRelease);
        }
      }
      return warningIssues;
    },
  });
}

// these functions shouldn't be used eventually for performance ...
export function rollupWarningIssues(
  issuesOrReleases: IssueOrRelease<WithWarningIssues>[],
  rollupTimingLevelsAndCalculations: Array<{
    type: string;
    hierarchyLevel?: number;
  }>
) {
  const groupedIssues = groupIssuesByHierarchyLevelOrType(
    issuesOrReleases,
    rollupTimingLevelsAndCalculations
  );

  const rolledUpWarnings = rollupWarningIssuesForGroupedHierarchy(groupedIssues);

  const zipped = zipRollupDataOntoGroupedData(groupedIssues, rolledUpWarnings, "warningIssues");

  return zipped.flat();
}

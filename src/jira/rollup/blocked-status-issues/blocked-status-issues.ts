/**
 * This module provides functions to roll up blocked issues within a hierarchical structure.
 * It identifies issues with a 'blocked' status and aggregates them up through the hierarchy levels.
 **/
import {
  rollupGroupedHierarchy,
  groupIssuesByHierarchyLevelOrType,
  zipRollupDataOntoGroupedData,
  IssueOrRelease,
  isDerivedIssue,
  isDerivedRelease
} from "../rollup";

export type WithBlockedStatuses<T = unknown> = { blockedStatusIssues: IssueOrRelease<T>[] };

/** *
 * @param {IssueOrRelease[]} issuesOrReleases
 * @param {Array<{ type: string; hierarchyLevel: number }>} rollupTimingLevelsAndCalculations
 * @returns {IssueOrRelease[]} - The list of issues or releases with rolled-up blocked status issues added.
 */
// these functions shouldn't be used eventually for performance ...
export function rollupBlockedStatusIssues<T>(
  issuesOrReleases: IssueOrRelease<T>[],
  rollupTimingLevelsAndCalculations: Array<{
    type: string;
    hierarchyLevel?: number;
  }>
): IssueOrRelease<T & WithBlockedStatuses<T>>[] {
  const groupedIssues = groupIssuesByHierarchyLevelOrType(
    issuesOrReleases,
    rollupTimingLevelsAndCalculations
  );
  const rolledUpBlockers = rollupBlockedIssuesForGroupedHierarchy(groupedIssues);

  const zipped = zipRollupDataOntoGroupedData(groupedIssues, rolledUpBlockers, (item, values) => ({
    ...item,
    blockedStatusIssues: values,
  }));
  return zipped.flat();
}

/** *
 * @param {IssueOrRelease[][]} groupedHierarchy - The grouped hierarchy of issues or releases, from low to high levels.
 * @returns {RollupResponse<IssueOrRelease[], Meta>} - The rolled-up blocked issues for each hierarchy level.
 */
export function rollupBlockedIssuesForGroupedHierarchy<T>(groupedHierarchy: IssueOrRelease<T>[][]) {
  return rollupGroupedHierarchy(groupedHierarchy, {
    createRollupDataFromParentAndChild(issueOrRelease, children: IssueOrRelease<T>[][]) {
      if (isDerivedRelease(issueOrRelease)) return [...children.flat(1)];
      
      const lowerCaseLabels = (issueOrRelease.labels || []).map((label) => label.toLowerCase());
      const hasBlockedLabel = lowerCaseLabels.some((label) => label === "blocked");
      const hasBlockedStatus = isDerivedIssue(issueOrRelease) && issueOrRelease?.derivedStatus?.statusType === "blocked"

      const addParent =
      hasBlockedLabel || hasBlockedStatus
          ? [issueOrRelease]
          : [];
      return [...children.flat(1), ...addParent];
    },
  });
}

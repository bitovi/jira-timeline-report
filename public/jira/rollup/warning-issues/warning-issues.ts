/**
 * This module provides functions to roll up warning issues within a hierarchical structure.
 * It identifies issues with a 'warning' label and aggregates them up through the hierarchy levels.
 **/
import {
  rollupGroupedHierarchy,
  groupIssuesByHierarchyLevelOrType,
  zipRollupDataOntoGroupedData,
  IssueOrRelease,
  RollupResponse,
  ReportingHierarchyIssueOrRelease,
  isDerivedIssue,
} from "../rollup";

/**
 * @param {IssueOrRelease[][]} groupedHierarchy
 * @returns {RollupResponse}
 */
export function rollupWarningIssuesForGroupedHierarchy<CustomFields, Meta>(
  groupedHierarchy: IssueOrRelease<CustomFields>[][]
): RollupResponse<IssueOrRelease<CustomFields>[], Meta> {
  return rollupGroupedHierarchy<
    CustomFields,
    IssueOrRelease<CustomFields>[],
    Meta
  >(groupedHierarchy, {
    createRollupDataFromParentAndChild(
      issueOrRelease: ReportingHierarchyIssueOrRelease<CustomFields>,
      children: IssueOrRelease<CustomFields>[][]
    ): IssueOrRelease<CustomFields>[] {
      const warningIssues = children.flat(1);
      // releases don't have a status
      if (isDerivedIssue(issueOrRelease)) {
        const lowerCaseLabels = (issueOrRelease.labels || []).map((label) =>
          label.toLowerCase()
        );
        if (lowerCaseLabels.some((label) => label === "warning")) {
          warningIssues.push(issueOrRelease);
        }
      }
      return warningIssues;
    },
  });
}

/**
 * @param {IssueOrRelease[]} issuesOrReleases
 * @param {Array<{ type: string; hierarchyLevel?: number }>} rollupTimingLevelsAndCalculations
 * @returns {IssueOrRelease[]}
 */
// these functions shouldn't be used eventually for performance ...
export function rollupWarningIssues<CustomFields, Meta>(
  issuesOrReleases: IssueOrRelease<CustomFields>[],
  rollupTimingLevelsAndCalculations: Array<{
    type: string;
    hierarchyLevel?: number;
  }>
): IssueOrRelease<CustomFields>[] {
  const groupedIssues = groupIssuesByHierarchyLevelOrType(
    issuesOrReleases,
    rollupTimingLevelsAndCalculations
  );

  const rolledUpWarnings = rollupWarningIssuesForGroupedHierarchy<
    CustomFields,
    Meta
  >(groupedIssues);

  const zipped = zipRollupDataOntoGroupedData<
    CustomFields,
    IssueOrRelease<CustomFields>[],
    Meta
  >(groupedIssues, rolledUpWarnings, "warningIssues");

  return zipped.flat();
}

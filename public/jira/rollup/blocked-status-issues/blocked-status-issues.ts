/**
 * This module provides functions to roll up blocked issues within a hierarchical structure.
 * It identifies issues with a 'blocked' status and aggregates them up through the hierarchy levels.
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
/** *
 * @template CustomFields, Meta
 * @param {IssueOrRelease<CustomFields>[][]} groupedHierarchy - The grouped hierarchy of issues or releases, from low to high levels.
 * @returns {RollupResponse<IssueOrRelease<CustomFields>[], Meta>} - The rolled-up blocked issues for each hierarchy level.
 */
export function rollupBlockedIssuesForGroupedHierarchy<CustomFields, Meta>(
  groupedHierarchy: IssueOrRelease<CustomFields>[][]
): RollupResponse<IssueOrRelease<CustomFields>[], Meta> {
  return rollupGroupedHierarchy<
    CustomFields,
    IssueOrRelease<CustomFields>[],
    Meta
  >(groupedHierarchy, {
    createRollupDataFromParentAndChild(
      issueOrRelease: ReportingHierarchyIssueOrRelease<CustomFields>,
      children: IssueOrRelease<CustomFields>[][],
      hierarchyLevel: number,
      metadata: Meta
    ): IssueOrRelease<CustomFields>[] {
      const blockedIssues = children.flat(1);
      // releases don't have a status
      if (
        isDerivedIssue(issueOrRelease) &&
        issueOrRelease?.derivedStatus?.statusType === "blocked"
      ) {
        blockedIssues.push(issueOrRelease);
      }
      return blockedIssues;
    },
  });
}
/** *
 * @template CustomFields, Meta
 * @param {IssueOrRelease<CustomFields>[]} issuesOrReleases
 * @param {Array<{ type: string; hierarchyLevel: number }>} rollupTimingLevelsAndCalculations
 * @returns {IssueOrRelease<CustomFields>[]} - The list of issues or releases with rolled-up blocked status issues added.
 */
// these functions shouldn't be used eventually for performance ...
export function rollupBlockedStatusIssues<CustomFields, Meta>(
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
  const rolledUpBlockers = rollupBlockedIssuesForGroupedHierarchy<
    CustomFields,
    Meta
  >(groupedIssues);
  console.log(rolledUpBlockers);

  const zipped = zipRollupDataOntoGroupedData<
    CustomFields,
    IssueOrRelease<CustomFields>[],
    Meta
  >(groupedIssues, rolledUpBlockers, "blockedStatusIssues");
  return zipped.flat();
}

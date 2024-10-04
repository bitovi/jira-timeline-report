import {
  rollupGroupedHierarchy,
  groupIssuesByHierarchyLevelOrType,
  zipRollupDataOntoGroupedData,
  IssueOrRelease,
  RollupResponse,
  ReportingHierarchyIssueOrRelease,
  isDerivedIssue,
} from "../rollup";

export interface ChildStatuses {
  self: { key: string; status: string | null };
  children: Array<{ key: string; status: string | null }>;
}

/**
 * @param {IssueOrRelease[][]} groupedHierarchy - The grouped hierarchy of issues or releases, from low to high levels.
 * @returns {RollupResponse} - The rolled-up child statuses for each hierarchy level.
 */
export function rollupChildStatusesForGroupedHierarchy<CustomFields, Meta>(
  groupedHierarchy: IssueOrRelease<CustomFields>[][]
): RollupResponse<ChildStatuses, Meta> {
  return rollupGroupedHierarchy<CustomFields, ChildStatuses, Meta>(
    groupedHierarchy,
    {
      createRollupDataFromParentAndChild(
        issueOrRelease: ReportingHierarchyIssueOrRelease<CustomFields>,
        children: ChildStatuses[]
      ): ChildStatuses {
        const key = issueOrRelease.key;
        let status: string | null = null;

        if (isDerivedIssue(issueOrRelease)) {
          status = issueOrRelease.status;
        }

        return {
          self: { key, status },
          children: children.map((child) => child.self),
        };
      },
    }
  );
}

/**
 * @param {IssueOrRelease[]} issuesOrReleases
 * @param {Array<{ type: string; hierarchyLevel?: number }>} rollupTimingLevelsAndCalculations
 * @returns {IssueOrRelease[]}
 */
export function rollupChildStatuses<CustomFields, Meta>(
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

  const rolledUpChildStatuses = rollupChildStatusesForGroupedHierarchy<
    CustomFields,
    Meta
  >(groupedIssues);

  const zipped = zipRollupDataOntoGroupedData<
    CustomFields,
    ChildStatuses,
    Meta
  >(groupedIssues, rolledUpChildStatuses, "childStatuses");

  return zipped.flat();
}

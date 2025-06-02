/**
 * This module provides functions to roll up child statuses within a hierarchical structure.
 * It aggregates the status of each issue or release along with its child issues across different hierarchy levels.
 */
import {
  rollupGroupedHierarchy,
  groupIssuesByHierarchyLevelOrType,
  zipRollupDataOntoGroupedData,
  IssueOrRelease,
  isDerivedIssue,
} from '../rollup';

export interface ChildStatuses {
  self: { key: string; status: string | null };
  children: Array<{ key: string; status: string | null }>;
}

export type WithChildStatuses = { childStatuses?: ChildStatuses };

export function rollupChildStatuses<T>(
  issuesOrReleases: IssueOrRelease<T>[],
  rollupTimingLevelsAndCalculations: Array<{
    type: string;
    hierarchyLevel?: number;
  }>,
): IssueOrRelease<T & WithChildStatuses>[] {
  const groupedIssues = groupIssuesByHierarchyLevelOrType(issuesOrReleases, rollupTimingLevelsAndCalculations);

  const rolledUpChildStatuses = rollupChildStatusesForGroupedHierarchy(groupedIssues);

  const zipped = zipRollupDataOntoGroupedData(groupedIssues, rolledUpChildStatuses, (item, values) => ({
    ...item,
    childStatuses: values,
  }));

  return zipped.flat();
}

/**
 * @param groupedHierarchy - The grouped hierarchy of issues or releases, from low to high levels.
 * @returns - The rolled-up child statuses for each hierarchy level.
 */
export function rollupChildStatusesForGroupedHierarchy(groupedHierarchy: IssueOrRelease<WithChildStatuses>[][]) {
  return rollupGroupedHierarchy(groupedHierarchy, {
    createRollupDataFromParentAndChild(issueOrRelease, children: ChildStatuses[]) {
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
  });
}

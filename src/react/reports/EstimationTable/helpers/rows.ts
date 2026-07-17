import type { EstimationIssue, TableRow } from '../types';

/**
 * Build a `getChildren` lookup from a flat issue list using each issue's own
 * `reportingHierarchy.childKeys` — the React analog of table-grid.js's
 * `makeGetChildrenFromReportingIssues` (kept local so it types against this report's
 * `EstimationIssue` rather than the generic `IssueOrRelease<T>` pipeline type).
 */
export const makeGetChildren = (allIssues: EstimationIssue[]): ((issue: EstimationIssue) => EstimationIssue[]) => {
  const byKey = new Map(allIssues.map((issue) => [issue.key, issue] as const));
  return (issue) =>
    (issue.reportingHierarchy?.childKeys ?? [])
      .map((key) => byKey.get(key))
      .filter((child): child is EstimationIssue => !!child);
};

/**
 * Recursively flatten each primary issue and all its descendants into depth-tagged rows
 * (parent first, then each child subtree in order). Always fully expanded — the report has no
 * collapse UI. Replaces table-grid.js's `tableRows` getter.
 */
export const buildTableRows = (primaryIssues: EstimationIssue[], allIssues: EstimationIssue[]): TableRow[] => {
  const getChildren = makeGetChildren(allIssues);
  const childrenRecursive = (issue: EstimationIssue, depth = 0): TableRow[] => [
    { depth, issue },
    ...getChildren(issue).flatMap((child) => childrenRecursive(child, depth + 1)),
  ];
  return primaryIssues.flatMap((issue) => childrenRecursive(issue));
};

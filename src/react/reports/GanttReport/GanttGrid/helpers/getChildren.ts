import type { IssueOrRelease } from '../types';

/**
 * Build a `getChildren` lookup from a flat issue list using each issue's own
 * `reportingHierarchy.childKeys` (rather than `src/jira/rollup/rollup.ts`'s
 * `makeGetChildrenFromReportingIssues`, whose generic `IssueOrRelease<T>` pipeline type isn't
 * compatible with the Gantt's local, flattened `IssueOrRelease`).
 */
export const makeGetChildren = (allIssues: IssueOrRelease[]): ((issue: IssueOrRelease) => IssueOrRelease[]) => {
  const byKey = new Map(allIssues.map((issue) => [issue.key, issue] as const));
  return (issue: IssueOrRelease) =>
    issue.reportingHierarchy.childKeys.map((key) => byKey.get(key)).filter((child): child is IssueOrRelease => !!child);
};

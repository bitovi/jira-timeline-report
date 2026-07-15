import type { CanObservable } from '../../../../../hooks/useCanObservable/useCanObservable';
import { useCanObservable } from '../../../../../hooks/useCanObservable/useCanObservable';

/** The minimal issue/release shape this hook reads. */
export interface MinimalChildStatusIssue {
  key: string;
  type?: string;
  status?: string;
  reportingHierarchy?: { childKeys?: string[] };
}

/** Stable empty observable used when a caller doesn't supply one. */
const emptyIssuesObs: CanObservable<MinimalChildStatusIssue[]> = {
  value: [],
  getData: () => [],
  get: () => [],
  set: () => undefined,
  on: () => undefined,
  off: () => undefined,
} as unknown as CanObservable<MinimalChildStatusIssue[]>;

/**
 * Derives the Work Breakdown's CHILD issue type name and its selectable Jira Status values (no
 * counts — unlike `useSelectableStatuses`/`useSelectableRollupStatuses` — since there's no single
 * "child issue type" route-data concept to tally against; this reads the actual children present
 * across all cards instead).
 *
 * @param primaryIssuesObs The cards — used for `reportingHierarchy.childKeys`.
 * @param allIssuesObs Every issue/release — used to look up each child by key.
 */
export const useSelectableChildStatuses = (
  primaryIssuesObs?: CanObservable<MinimalChildStatusIssue[]>,
  allIssuesObs?: CanObservable<MinimalChildStatusIssue[]>,
) => {
  const primaryIssues = useCanObservable(primaryIssuesObs ?? emptyIssuesObs);
  const allIssues = useCanObservable(allIssuesObs ?? emptyIssuesObs);

  const byKey = new Map((allIssues ?? []).map((issue) => [issue.key, issue]));

  const children: MinimalChildStatusIssue[] = [];
  for (const primary of primaryIssues ?? []) {
    for (const key of primary.reportingHierarchy?.childKeys ?? []) {
      const child = byKey.get(key);
      if (child) {
        children.push(child);
      }
    }
  }

  const childType = children.find((child) => child.type)?.type ?? '';

  const statuses = new Set<string>();
  for (const child of children) {
    if (child.status) {
      statuses.add(child.status);
    }
  }

  return {
    childType,
    statusOptions: [...statuses].sort().map((status) => ({ label: status, value: status })),
  };
};

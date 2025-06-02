import type { MinimalDerivedIssue } from './useDerivedIssues';

import { useDerivedIssues } from './useDerivedIssues';
import { useSelectedIssueType } from './useSelectedIssueType';

export const useSelectableStatuses = () => {
  const derivedIssues = useDerivedIssues();
  const { selectedIssueType } = useSelectedIssueType();

  return getStatusesFromDerivedIssues(selectedIssueType, derivedIssues || []);
};

const getStatusesFromDerivedIssues = (issueType: string, derivedIssues: MinimalDerivedIssue[]) => {
  const filtered = derivedIssues.filter(({ type }) => type === issueType);
  const statusCount: Record<string, number> = {};

  for (const { status } of filtered) {
    if (!statusCount[status]) {
      statusCount[status] = 0;
    }

    statusCount[status]++;
  }

  return [...new Set(filtered.map(({ status }) => status))].map((status) => ({
    label: `${status} (${statusCount[status]})`,
    value: status,
  }));
};

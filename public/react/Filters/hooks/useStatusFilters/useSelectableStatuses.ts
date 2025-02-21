import type { MinimalDerivedIssue } from "../../shared/hooks/useDerivedIssues";

import { useDerivedIssues } from "../../shared/hooks/useDerivedIssues";

export const useSelectableStatuses = () => {
  const derivedIssues = useDerivedIssues();

  return getStatusesFromDerivedIssues(derivedIssues || []);
};

const getStatusesFromDerivedIssues = (derivedIssues: MinimalDerivedIssue[]) => {
  const statusCount: Record<string, number> = {};

  for (const { status } of derivedIssues) {
    if (!statusCount[status]) {
      statusCount[status] = 0;
    }

    statusCount[status]++;
  }

  return [...new Set(derivedIssues.map(({ status }) => status))].map((status) => ({
    label: `${status} (${statusCount[status]})`,
    value: status,
  }));
};

import type { FC } from 'react';
import React, { useMemo } from 'react';
import type { DerivedIssue } from '../../../jira/derived/derive';
import { useRouteData } from '../../hooks/useRouteData/useRouteData';
import { ChecklistDropdown } from './ChecklistDropdown';
import {
  EXCLUDED_STATUSES_BY_DEFAULT,
  EXCLUDED_ISSUE_TYPES_BY_DEFAULT,
  computeEffectiveFilter,
} from './flowMetricsDefaults';

export const FlowMetricsViewSettings: FC = () => {
  const [derivedIssues] = useRouteData<DerivedIssue[] | undefined>('derivedIssues');
  const [statusFilter, setStatusFilter] = useRouteData<string[] | undefined>('flowMetricsStatusFilter');
  const [issueTypeFilter, setIssueTypeFilter] = useRouteData<string[] | undefined>('flowMetricsIssueTypeFilter');
  const { statusOptions, issueTypeOptions } = useMemo(() => {
    const issues = derivedIssues ?? [];
    const statuses = new Set<string>();
    const issueTypes = new Set<string>();
    for (const issue of issues) {
      if (issue.status) statuses.add(issue.status);
      if (issue.type) issueTypes.add(issue.type);
    }
    return {
      statusOptions: [...statuses].sort(),
      issueTypeOptions: [...issueTypes].sort(),
    };
  }, [derivedIssues]);

  // Compute the display value for the checklist. When the user hasn't touched the
  // filter (raw value is [] from route data), show the same defaults that FlowMetrics
  // applies when filtering, so the UI and the data are always in sync.
  const effectiveStatusFilter = computeEffectiveFilter(statusFilter, statusOptions, EXCLUDED_STATUSES_BY_DEFAULT);
  const effectiveIssueTypeFilter = computeEffectiveFilter(
    issueTypeFilter,
    issueTypeOptions,
    EXCLUDED_ISSUE_TYPES_BY_DEFAULT,
  );

  const row = 'grid grid-cols-[150px_1fr] gap-6 py-4';
  const label = 'uppercase text-sm font-semibold text-zinc-800 self-center';

  return (
    <div>
      <div className={row}>
        <p className={label}>Status</p>
        <ChecklistDropdown options={statusOptions} value={effectiveStatusFilter} onChange={setStatusFilter} />
      </div>

      <div className={row}>
        <p className={label}>Issue type</p>
        <ChecklistDropdown options={issueTypeOptions} value={effectiveIssueTypeFilter} onChange={setIssueTypeFilter} />
      </div>
    </div>
  );
};

import type { FC } from 'react';
import React, { useMemo } from 'react';
import type { DerivedIssue } from '../../../jira/derived/derive';
import { useRouteData } from '../../hooks/useRouteData/useRouteData';
import { ChecklistDropdown } from '../FlowMetrics/ChecklistDropdown';

export const TimeInStatusViewSettings: FC = () => {
  const [derivedIssues] = useRouteData<DerivedIssue[] | undefined>('derivedIssues');
  const [statusFilter, setStatusFilter] = useRouteData<string[] | undefined>('timeInStatusStatusFilter');

  // Which status columns the charts show, not which issues: the Filters panel filters issues.
  // Includes past statuses from the changelog, which the panel's Jira Status field doesn't list.
  const statusOptions = useMemo(() => {
    const issues = derivedIssues ?? [];
    const statuses = new Set<string>();
    for (const issue of issues) {
      if (issue.status) statuses.add(issue.status);
      for (const entry of (issue as any).issue?.changelog ?? []) {
        for (const item of entry.items ?? []) {
          if (item.field === 'status') {
            if (item.fromString) statuses.add(item.fromString);
            if (item.toString) statuses.add(item.toString);
          }
        }
      }
    }
    return [...statuses].sort();
  }, [derivedIssues]);

  const row = 'grid grid-cols-[150px_1fr] gap-6 py-4';
  const label = 'uppercase text-sm font-semibold text-zinc-800 self-center';

  return (
    <div>
      <div className={row}>
        <p className={label}>Show statuses</p>
        <ChecklistDropdown options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
      </div>
    </div>
  );
};

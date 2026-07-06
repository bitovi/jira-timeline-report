import React from 'react';
import type { IssueOrRelease } from '../../types';
import { countIssuesByStatus, getStatusColorClass, getStatusLabel } from '../../helpers';

export interface StatusLegendProps {
  /** Issues to summarize. Each contributes its rollup status to the counts. Renders nothing when empty. */
  issues: IssueOrRelease[];
}

/**
 * Scatter Plot footer legend — a colored dot + label + count for every status present among
 * the plotted issues. Renders `null` when there are no issues to summarize.
 */
export const StatusLegend: React.FC<StatusLegendProps> = ({ issues }) => {
  const counts = countIssuesByStatus(issues.map((issue) => issue.rollupStatuses.rollup.status));

  if (counts.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 m-0 p-0 list-none" aria-label="Status legend">
      {counts.map(({ status, count }) => (
        <li key={status} className="inline-flex items-center gap-1.5 text-sm">
          <span
            className={`${getStatusColorClass(status)} w-3 h-3 shrink-0 rounded-full inline-block`}
            aria-hidden="true"
          />
          <span className="color-text-notstarted">{getStatusLabel(status)}</span>
          <span className="font-semibold tabular-nums">{count}</span>
        </li>
      ))}
    </ul>
  );
};

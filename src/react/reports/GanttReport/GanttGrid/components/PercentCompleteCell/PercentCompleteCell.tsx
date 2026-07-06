import React from 'react';
import { computePercentComplete } from '../../helpers/percentComplete';
import type { IssueOrRelease } from '../../types';

export interface PercentCompleteCellProps {
  issue: IssueOrRelease;
  textSizeClass: string;
  onClick: (issue: IssueOrRelease) => void;
}

/**
 * The "% complete" column cell — shows `—` when there's no work to divide by (plan §Known
 * issues #3; was `NaN` in the legacy code) or `n%`. Clicking opens the percent-complete modal.
 *
 * Ports gantt-grid.js's `columnsToShow` percent-complete column.
 */
export const PercentCompleteCell: React.FC<PercentCompleteCellProps> = ({ issue, textSizeClass, onClick }) => {
  const percent = computePercentComplete(issue);
  return (
    <div
      onClick={() => onClick(issue)}
      className={`${textSizeClass} text-right pointer pt-1 pb-0.5 px-1 hover:bg-neutral-41`}
    >
      {percent === null ? '—' : `${percent}%`}
    </div>
  );
};

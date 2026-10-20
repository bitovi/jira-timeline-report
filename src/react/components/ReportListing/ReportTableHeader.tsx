import type { FC } from 'react';

import React from 'react';

/**
 * The saved-reports table's columns: star, type, name, owner, last updated, delete. Shared by the header and every
 * row so the two can't drift out of line. See spec/041-saved-reports-redesign/phase1/plan.md § 6.
 */
export const REPORT_TABLE_GRID = 'grid grid-cols-[40px_170px_minmax(0,1fr)_120px_120px_40px] gap-3 px-4';

export interface ReportTableHeaderProps {
  className?: string;
}

/** Column labels. Sticks to the top of whatever scroll container it sits in. */
export const ReportTableHeader: FC<ReportTableHeaderProps> = ({ className = '' }) => (
  <div
    role="row"
    className={`${REPORT_TABLE_GRID} sticky top-0 z-10 items-center border-b border-neutral-41 bg-white py-2 text-xs font-semibold uppercase tracking-wide text-neutral-300 ${className}`}
  >
    <span role="columnheader">
      <span className="sr-only">Starred</span>
    </span>
    <span role="columnheader">Type</span>
    <span role="columnheader">Name</span>
    <span role="columnheader">Owner</span>
    <span role="columnheader">Last updated</span>
    <span role="columnheader">
      <span className="sr-only">Actions</span>
    </span>
  </div>
);

export default ReportTableHeader;
